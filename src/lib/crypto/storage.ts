/**
 * Secure Storage Layer for E2EE
 * Uses IndexedDB for persistent key storage in web browsers
 *
 * SECURITY NOTES:
 * - IndexedDB is origin-bound (same-origin policy)
 * - Data is NOT encrypted by default
 * - Consider adding encryption-at-rest for sensitive keys
 * - Never use localStorage for private keys (XSS risk)
 */

import type {
  CryptoStorage,
  SerializedKeyPair,
  SerializedSignedPreKey,
} from './types';

const DB_NAME = 'whatup-crypto-store';
const DB_VERSION = 1;

// Object store names
const STORES = {
  IDENTITY: 'identityKeys',
  PRE_KEYS: 'preKeys',
  SIGNED_PRE_KEYS: 'signedPreKeys',
  SESSIONS: 'sessions',
  REMOTE_IDENTITIES: 'remoteIdentities',
  CONFIG: 'config',
} as const;

/**
 * Open/create the IndexedDB database
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Identity keys store
      if (!db.objectStoreNames.contains(STORES.IDENTITY)) {
        db.createObjectStore(STORES.IDENTITY, { keyPath: 'id' });
      }

      // Pre-keys store (one-time keys)
      if (!db.objectStoreNames.contains(STORES.PRE_KEYS)) {
        db.createObjectStore(STORES.PRE_KEYS, { keyPath: 'keyId' });
      }

      // Signed pre-keys store
      if (!db.objectStoreNames.contains(STORES.SIGNED_PRE_KEYS)) {
        db.createObjectStore(STORES.SIGNED_PRE_KEYS, { keyPath: 'keyId' });
      }

      // Sessions store
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        db.createObjectStore(STORES.SESSIONS, { keyPath: 'address' });
      }

      // Remote identity keys store
      if (!db.objectStoreNames.contains(STORES.REMOTE_IDENTITIES)) {
        db.createObjectStore(STORES.REMOTE_IDENTITIES, { keyPath: 'id' });
      }

      // Config store (device ID, registration ID, etc.)
      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Generic get operation
 */
const dbGet = async <T>(
  storeName: string,
  key: IDBValidKey
): Promise<T | null> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
    tx.oncomplete = () => db.close();
  });
};

/**
 * Generic put operation
 */
const dbPut = async <T>(storeName: string, value: T): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
};

/**
 * Generic delete operation
 */
const dbDelete = async (storeName: string, key: IDBValidKey): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
};

/**
 * Clear all stores
 */
const dbClearAll = async (): Promise<void> => {
  const db = await openDatabase();
  const storeNames = Object.values(STORES);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');

    for (const storeName of storeNames) {
      tx.objectStore(storeName).clear();
    }

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
};

/**
 * IndexedDB-based crypto storage implementation
 */
export class IndexedDBCryptoStorage implements CryptoStorage {
  // ============================================
  // Identity Key
  // ============================================

  async storeIdentityKey(keyPair: SerializedKeyPair): Promise<void> {
    await dbPut(STORES.IDENTITY, {
      id: 'main',
      ...keyPair,
      createdAt: new Date().toISOString(),
    });
  }

  async getIdentityKey(): Promise<SerializedKeyPair | null> {
    const result = await dbGet<{
      id: string;
      publicKey: string;
      privateKey: string;
    }>(STORES.IDENTITY, 'main');

    if (!result) return null;

    return {
      publicKey: result.publicKey,
      privateKey: result.privateKey,
    };
  }

  // ============================================
  // Registration ID
  // ============================================

  async storeRegistrationId(registrationId: number): Promise<void> {
    await dbPut(STORES.CONFIG, {
      key: 'registrationId',
      value: registrationId,
    });
  }

  async getRegistrationId(): Promise<number | null> {
    const result = await dbGet<{ key: string; value: number }>(
      STORES.CONFIG,
      'registrationId'
    );
    return result?.value ?? null;
  }

  // ============================================
  // Device ID
  // ============================================

  async storeDeviceId(deviceId: string): Promise<void> {
    await dbPut(STORES.CONFIG, {
      key: 'deviceId',
      value: deviceId,
    });
  }

  async getDeviceId(): Promise<string | null> {
    const result = await dbGet<{ key: string; value: string }>(
      STORES.CONFIG,
      'deviceId'
    );
    return result?.value ?? null;
  }

  // ============================================
  // Device UUID (from server after registration)
  // ============================================

  async storeDeviceUuid(deviceUuid: string): Promise<void> {
    await dbPut(STORES.CONFIG, {
      key: 'deviceUuid',
      value: deviceUuid,
    });
  }

  async getDeviceUuid(): Promise<string | null> {
    const result = await dbGet<{ key: string; value: string }>(
      STORES.CONFIG,
      'deviceUuid'
    );
    return result?.value ?? null;
  }

  // ============================================
  // Pre-Keys (One-Time Keys)
  // ============================================

  async storePreKey(keyId: number, keyPair: SerializedKeyPair): Promise<void> {
    await dbPut(STORES.PRE_KEYS, {
      keyId,
      ...keyPair,
      createdAt: new Date().toISOString(),
    });
  }

  async loadPreKey(keyId: number): Promise<SerializedKeyPair | null> {
    const result = await dbGet<{
      keyId: number;
      publicKey: string;
      privateKey: string;
    }>(STORES.PRE_KEYS, keyId);

    if (!result) return null;

    return {
      publicKey: result.publicKey,
      privateKey: result.privateKey,
    };
  }

  async removePreKey(keyId: number): Promise<void> {
    await dbDelete(STORES.PRE_KEYS, keyId);
  }

  // ============================================
  // Signed Pre-Key
  // ============================================

  async storeSignedPreKey(signedPreKey: SerializedSignedPreKey): Promise<void> {
    await dbPut(STORES.SIGNED_PRE_KEYS, {
      ...signedPreKey,
      createdAt: new Date().toISOString(),
    });
  }

  async loadSignedPreKey(
    keyId: number
  ): Promise<SerializedSignedPreKey | null> {
    const result = await dbGet<SerializedSignedPreKey>(
      STORES.SIGNED_PRE_KEYS,
      keyId
    );
    return result;
  }

  // ============================================
  // Sessions
  // ============================================

  async storeSession(address: string, sessionData: string): Promise<void> {
    await dbPut(STORES.SESSIONS, {
      address,
      sessionData,
      updatedAt: new Date().toISOString(),
    });
  }

  async loadSession(address: string): Promise<string | null> {
    const result = await dbGet<{ address: string; sessionData: string }>(
      STORES.SESSIONS,
      address
    );
    return result?.sessionData ?? null;
  }

  async removeSession(address: string): Promise<void> {
    await dbDelete(STORES.SESSIONS, address);
  }

  // ============================================
  // Remote Identity Keys
  // ============================================

  private getRemoteIdentityId(userId: string, deviceId: string): string {
    return `${userId}:${deviceId}`;
  }

  async storeRemoteIdentityKey(
    userId: string,
    deviceId: string,
    publicKey: string
  ): Promise<void> {
    await dbPut(STORES.REMOTE_IDENTITIES, {
      id: this.getRemoteIdentityId(userId, deviceId),
      userId,
      deviceId,
      publicKey,
      firstSeen: new Date().toISOString(),
    });
  }

  async loadRemoteIdentityKey(
    userId: string,
    deviceId: string
  ): Promise<string | null> {
    const result = await dbGet<{
      id: string;
      publicKey: string;
    }>(STORES.REMOTE_IDENTITIES, this.getRemoteIdentityId(userId, deviceId));

    return result?.publicKey ?? null;
  }

  async isTrustedIdentity(
    userId: string,
    deviceId: string,
    publicKey: string
  ): Promise<boolean> {
    const storedKey = await this.loadRemoteIdentityKey(userId, deviceId);

    // First time seeing this identity - trust on first use (TOFU)
    if (!storedKey) {
      await this.storeRemoteIdentityKey(userId, deviceId, publicKey);
      return true;
    }

    // Check if the key matches what we've seen before
    return storedKey === publicKey;
  }

  // ============================================
  // Clear All Data
  // ============================================

  async clearAll(): Promise<void> {
    await dbClearAll();
  }
}

// Singleton instance
let storageInstance: IndexedDBCryptoStorage | null = null;

/**
 * Get the crypto storage instance
 */
export const getCryptoStorage = (): CryptoStorage => {
  if (!storageInstance) {
    storageInstance = new IndexedDBCryptoStorage();
  }
  return storageInstance;
};

/**
 * Check if IndexedDB is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
};

/**
 * Generate a unique device ID for this browser instance
 */
export const generateDeviceId = (): string => {
  // Combine crypto random with timestamp for uniqueness
  const randomPart = crypto.getRandomValues(new Uint8Array(16));
  const base64 = btoa(String.fromCharCode(...randomPart));
  const timestamp = Date.now().toString(36);
  return `web-${timestamp}-${base64.slice(0, 12)}`;
};

/**
 * Get device name based on browser/platform
 */
export const getDeviceName = (): string => {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown';

  // Detect browser
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
};
