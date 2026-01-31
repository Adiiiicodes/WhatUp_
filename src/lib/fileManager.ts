// src/lib/fileManager.ts
// File manager utility for web with IndexedDB caching

import { logger } from './logger';

const log = logger.child({ module: 'FileManager' });

const DB_NAME = 'whatup_file_cache';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const METADATA_STORE = 'metadata';

export interface CachedFile {
  id: string;
  url: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  fileSize: number;
  cachedAt: number;
  lastAccessed: number;
  duration?: number; // For voice/video
}

export interface FileMetadata {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  isCached: boolean;
  cachedAt?: number;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

class FileManager {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;
  private maxCacheSize = 100 * 1024 * 1024; // 100MB max cache
  private maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.dbReady = this.initDB();
  }

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        log.error({ error: request.error }, 'Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        log.debug('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Files store - stores actual file blobs
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const fileStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          fileStore.createIndex('url', 'url', { unique: true });
          fileStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Metadata store - stores file info without blobs
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
          metaStore.createIndex('url', 'url', { unique: true });
        }
        log.info('IndexedDB upgrade completed');
      };
    });
  }

  /**
   * Get a file from cache or download it
   */
  async getFile(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<{ blob: Blob; fromCache: boolean }> {
    // Try cache first
    const cached = await this.getFromCache(url);
    if (cached) {
      // Update last accessed time
      await this.updateLastAccessed(cached.id);
      log.debug({ url }, 'File retrieved from cache');
      return { blob: cached.blob, fromCache: true };
    }

    // Download the file
    const blob = await this.downloadFile(url, onProgress);
    
    // Cache it in the background
    this.cacheFile(url, blob).catch((error) => {
      log.error({ error, url }, 'Failed to cache file');
    });

    return { blob, fromCache: false };
  }

  /**
   * Download a file with progress tracking
   */
  async downloadFile(url: string, onProgress?: ProgressCallback): Promise<Blob> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body || !total || !onProgress) {
      // No streaming support or no progress callback needed
      return response.blob();
    }

    // Stream the response with progress
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      onProgress({
        loaded,
        total,
        percentage: Math.round((loaded / total) * 100),
      });
    }

    // Combine chunks into blob
    const blob = new Blob(chunks, {
      type: response.headers.get('content-type') || 'application/octet-stream',
    });

    return blob;
  }

  /**
   * Get file from IndexedDB cache
   */
  async getFromCache(url: string): Promise<CachedFile | null> {
    try {
      const db = await this.dbReady;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('url');
        const request = index.get(url);

        request.onsuccess = () => {
          const cached = request.result as CachedFile | undefined;
          
          // Check if cache is expired
          if (cached && Date.now() - cached.cachedAt > this.maxCacheAge) {
            this.removeFromCache(cached.id).catch((error) => {
              log.warn({ error, id: cached.id }, 'Failed to remove expired cache');
            });
            resolve(null);
            return;
          }

          resolve(cached || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.error({ error, url }, 'Cache read error');
      return null;
    }
  }

  /**
   * Cache a file in IndexedDB
   */
  async cacheFile(url: string, blob: Blob, metadata?: Partial<FileMetadata>): Promise<void> {
    try {
      // Check cache size and cleanup if needed
      await this.ensureCacheSpace(blob.size);

      const db = await this.dbReady;
      const id = this.generateId(url);
      const now = Date.now();

      const cachedFile: CachedFile = {
        id,
        url,
        blob,
        mimeType: blob.type || metadata?.mimeType || 'application/octet-stream',
        fileName: metadata?.fileName || this.extractFileName(url),
        fileSize: blob.size,
        cachedAt: now,
        lastAccessed: now,
        duration: metadata?.duration,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(cachedFile);

        request.onsuccess = () => {
          log.debug({ url, fileSize: blob.size }, 'File cached successfully');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.error({ error, url }, 'Cache write error');
    }
  }

  /**
   * Check if a file is cached
   */
  async isCached(url: string): Promise<boolean> {
    const cached = await this.getFromCache(url);
    return cached !== null;
  }

  /**
   * Get file metadata (from cache or by fetching headers)
   */
  async getFileMetadata(url: string): Promise<FileMetadata | null> {
    try {
      // Check cache first
      const cached = await this.getFromCache(url);
      if (cached) {
        return {
          id: cached.id,
          url: cached.url,
          fileName: cached.fileName,
          fileSize: cached.fileSize,
          mimeType: cached.mimeType,
          duration: cached.duration,
          isCached: true,
          cachedAt: cached.cachedAt,
        };
      }

      // Fetch just headers
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) return null;

      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');

      return {
        id: this.generateId(url),
        url,
        fileName: this.extractFileName(url),
        fileSize: contentLength ? parseInt(contentLength, 10) : 0,
        mimeType: contentType || 'application/octet-stream',
        isCached: false,
      };
    } catch (error) {
      log.error({ error, url }, 'Failed to get file metadata');
      return null;
    }
  }

  /**
   * Remove a file from cache
   */
  async removeFromCache(id: string): Promise<void> {
    try {
      const db = await this.dbReady;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          log.debug({ id }, 'File removed from cache');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.error({ error, id }, 'Cache delete error');
    }
  }

  /**
   * Clear all cached files
   */
  async clearCache(): Promise<void> {
    try {
      const db = await this.dbReady;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          log.info('Cache cleared');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.error({ error }, 'Cache clear error');
    }
  }

  /**
   * Get total cache size
   */
  async getCacheSize(): Promise<number> {
    try {
      const db = await this.dbReady;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        let totalSize = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            totalSize += (cursor.value as CachedFile).fileSize;
            cursor.continue();
          } else {
            resolve(totalSize);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.error({ error }, 'Failed to get cache size');
      return 0;
    }
  }

  /**
   * Ensure there's space in the cache by removing old files
   */
  private async ensureCacheSpace(neededSize: number): Promise<void> {
    const currentSize = await this.getCacheSize();
    
    if (currentSize + neededSize <= this.maxCacheSize) {
      return;
    }

    // Need to free up space - remove oldest accessed files
    try {
      const db = await this.dbReady;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('cachedAt');
      
      let freedSpace = 0;
      const targetFreeSpace = neededSize + (this.maxCacheSize * 0.2); // Free 20% extra

      return new Promise((resolve, reject) => {
        const request = index.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && freedSpace < targetFreeSpace) {
            const file = cursor.value as CachedFile;
            freedSpace += file.fileSize;
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.error({ error }, 'Cache cleanup error');
    }
  }

  /**
   * Update last accessed time for a cached file
   */
  private async updateLastAccessed(id: string): Promise<void> {
    try {
      const db = await this.dbReady;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const file = getRequest.result as CachedFile;
        if (file) {
          file.lastAccessed = Date.now();
          store.put(file);
        }
      };
    } catch (error) {
      log.warn({ error, id }, 'Failed to update last accessed');
    }
  }

  /**
   * Create a blob URL for a file (downloads if not cached)
   */
  async createObjectURL(url: string, onProgress?: ProgressCallback): Promise<string> {
    const { blob } = await this.getFile(url, onProgress);
    return URL.createObjectURL(blob);
  }

  /**
   * Revoke a blob URL
   */
  revokeObjectURL(objectUrl: string): void {
    URL.revokeObjectURL(objectUrl);
  }

  /**
   * Download and save file to user's device
   */
  async downloadToDevice(url: string, fileName?: string, onProgress?: ProgressCallback): Promise<void> {
    const { blob } = await this.getFile(url, onProgress);
    
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName || this.extractFileName(url);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Get audio duration from a blob
   */
  async getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      });
      audio.addEventListener('error', () => {
        reject(new Error('Failed to load audio'));
        URL.revokeObjectURL(audio.src);
      });
      audio.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Get video duration from a blob
   */
  async getVideoDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.addEventListener('loadedmetadata', () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      });
      video.addEventListener('error', () => {
        reject(new Error('Failed to load video'));
        URL.revokeObjectURL(video.src);
      });
      video.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Get image dimensions from a blob
   */
  async getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      });
      img.addEventListener('error', () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(img.src);
      });
      img.src = URL.createObjectURL(blob);
    });
  }

  // Utility methods
  private generateId(url: string): string {
    // Simple hash function for generating IDs
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `file_${Math.abs(hash).toString(36)}`;
  }

  private extractFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/');
      return segments[segments.length - 1] || 'download';
    } catch {
      return 'download';
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Check if a mime type is supported
   */
  isVoiceMessage(mimeType: string): boolean {
    return ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/ogg', 'audio/wav'].includes(mimeType);
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideoFile(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  isDocumentFile(mimeType: string): boolean {
    return !this.isImageFile(mimeType) && !this.isVideoFile(mimeType) && !this.isVoiceMessage(mimeType);
  }
}

export const fileManager = new FileManager();
export default fileManager;
