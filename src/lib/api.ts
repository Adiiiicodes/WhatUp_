/**
 * @fileoverview Production-grade API client with retry logic, error handling, and logging
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Structured error handling
 * - Request/response logging
 * - Token management
 * - Type-safe responses
 */

import type { User, Message, Conversation, AuthResponse, ApiResponse } from '../types/chat';
import { logger } from './logger';
import { 
  AppError, 
  NetworkError, 
  AuthError, 
  RateLimitError, 
  ServerError,
  createErrorFromStatus,
  ErrorCode,
} from './errors';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Error types for better error handling
export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

export class ApiRequestError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
  }
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, Rate limit, Server errors
};

// Request interceptor type
type RequestInterceptor = (config: RequestInit) => RequestInit | Promise<RequestInit>;
type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;

class ApiClient {
  private token: string | null = null;
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private readonly log = logger.child({ component: 'ApiClient' });

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index >= 0) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index >= 0) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  /**
   * Normalize error response to consistent ApiError format
   */
  private normalizeError(error: unknown, status?: number): ApiError {
    if (error instanceof ApiRequestError) {
      return { code: error.code, message: error.message, status: error.status };
    }

    if (typeof error === 'string') {
      return { code: 'UNKNOWN_ERROR', message: error, status };
    }

    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      return {
        code: (err.code as string) || 'UNKNOWN_ERROR',
        message: (err.message as string) || 'An unknown error occurred',
        status: (err.status as number) || status,
        details: err.details,
      };
    }

    return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred', status };
  }

  /**
   * Create standardized ApiResponse
   */
  private createResponse<T>(success: boolean, data?: T, error?: ApiError | string): ApiResponse<T> {
    if (success && data !== undefined) {
      return { success: true, data };
    }
    
    const normalizedError = typeof error === 'string' 
      ? { code: 'ERROR', message: error } 
      : error;
    
    return { 
      success: false, 
      error: normalizedError || { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' }
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(config: RequestInit): Promise<RequestInit> {
    let result = config;
    for (const interceptor of this.requestInterceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let result = response;
    for (const interceptor of this.responseInterceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  /**
   * Core request method with retry logic and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const requestId = logger.generateRequestId();
    const timer = this.log.time(`request:${endpoint}`);

    const headers: HeadersInit = {
      'X-Request-ID': requestId,
      ...options.headers,
    };

    // Only set Content-Type for requests with a body
    if (options.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    let config: RequestInit = { ...options, headers };
    
    // Apply request interceptors
    config = await this.applyRequestInterceptors(config);

    try {
      this.log.debug({ 
        endpoint, 
        method: config.method || 'GET',
        requestId,
        retryCount,
      }, 'Making API request');

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      // Handle retry for specific status codes
      if (
        this.retryConfig.retryStatusCodes.includes(response.status) &&
        retryCount < this.retryConfig.maxRetries
      ) {
        const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount); // Exponential backoff
        this.log.warn({ 
          status: response.status, 
          delayMs: delay, 
          attempt: retryCount + 1,
          maxRetries: this.retryConfig.maxRetries,
          requestId,
        }, 'Request failed, retrying');
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      // Parse response
      let data: unknown;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Try parsing as JSON anyway (some servers don't set content-type correctly)
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      timer();

      // Handle non-OK responses
      if (!response.ok) {
        const error = this.normalizeError(data, response.status);
        this.log.warn({ 
          endpoint, 
          status: response.status, 
          error,
          requestId,
        }, 'API request failed');
        
        const result = this.createResponse<T>(false, undefined, error);
        return this.applyResponseInterceptors(result);
      }

      // Handle backend response format
      const responseData = data as Record<string, unknown>;
      
      // If response already has success/data structure, return as-is
      if ('success' in responseData) {
        const result = data as ApiResponse<T>;
        return this.applyResponseInterceptors(result);
      }

      // Wrap raw data in ApiResponse format
      const result = this.createResponse<T>(true, data as T);
      return this.applyResponseInterceptors(result);

    } catch (error) {
      timer();
      
      // Network error - retry if allowed
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount);
        this.log.warn({ 
          error, 
          delayMs: delay, 
          attempt: retryCount + 1,
          requestId,
        }, 'Network error, retrying');
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      const normalizedError = this.normalizeError(error);
      this.log.error({ 
        endpoint, 
        error: normalizedError,
        requestId,
      }, 'API request failed after retries');
      
      const result = this.createResponse<T>(false, undefined, normalizedError);
      return this.applyResponseInterceptors(result);
    }
  }

  /**
   * Type guard to check if response is successful
   */
  isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
    return response.success && response.data !== undefined;
  }

  /**
   * Get error message from response
   */
  getErrorMessage(response: ApiResponse<unknown>): string {
    if (response.success) return '';
    
    if (typeof response.error === 'string') {
      return response.error;
    }
    
    if (response.error && typeof response.error === 'object') {
      return response.error.message || 'An error occurred';
    }
    
    return response.message || 'An unknown error occurred';
  }

  // Auth endpoints
  async signup(email: string, password: string, name: string) {
    const res = await this.request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async login(email: string, password: string) {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async logout() {
    const res = await this.request<null>('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
    return res;
  }

  async setPassword(email: string, password: string) {
    return this.request<{ message: string }>('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<User>('/api/auth/me');
  }

  // Google OAuth methods (matching mobile app)
  async googleNativeAuth(idToken: string) {
    const res = await this.request<AuthResponse>('/api/auth/google/native', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async exchangeGoogleCode(code: string) {
    const res = await this.request<AuthResponse>('/api/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  // Users
  async getUsers() {
    return this.request<User[]>('/api/users');
  }

  async getUserById(id: string) {
    return this.request<User>(`/api/users/${id}`);
  }

  async deleteUser(userId: string) {
    return this.request<{ deleted: boolean }>(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Conversations
  async getConversations() {
    return this.request<Conversation[]>('/api/conversations');
  }

  async createConversation(participantId: string) {
    return this.request<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    });
  }

  async getConversation(id: string) {
    return this.request<Conversation>(`/api/conversations/${id}`);
  }

  // Messages
  async getMessages(conversationId: string) {
    return this.request<Message[]>(`/api/messages?conversationId=${conversationId}`);
  }

  async sendMessage(params: {
    conversationId: string;
    receiverId: string;
    content: string;
    type?: string;
    mediaUrl?: string;
    mediaMetadata?: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      path: string;
      width?: number;
      height?: number;
      duration?: number;
    };
  }) {
    return this.request<Message>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async deleteMessage(messageId: string, conversationId: string, deleteForEveryone: boolean = false) {
    return this.request<{ deleted: boolean }>(`/api/messages/${messageId}?conversationId=${conversationId}&deleteForEveryone=${deleteForEveryone}`, {
      method: 'DELETE',
    });
  }

  // File upload - uses signed URL for direct upload to Supabase
  async getUploadUrl(filename: string, conversationId: string) {
    return this.request<{
      signedUrl: string;
      token: string;
      path: string;
      publicUrl: string;
    }>('/api/files/get-upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename, conversationId }),
    });
  }

  async uploadFile(
    file: File,
    conversationId: string,
    receiverId: string,
    type: 'image' | 'document' | 'voice'
  ): Promise<ApiResponse<Message>> {
    try {
      // Step 1: Get signed upload URL from backend
      const urlRes = await this.getUploadUrl(file.name, conversationId);
      if (!urlRes.success || !urlRes.data) {
        return { success: false, error: 'Failed to get upload URL' };
      }

      const { signedUrl, path, publicUrl } = urlRes.data;

      // Step 2: Upload file directly to Supabase using the signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        return { success: false, error: 'Failed to upload file to storage' };
      }

      // Step 3: Send message with the file URL
      const messageRes = await this.sendMessage({
        conversationId,
        receiverId,
        content: '', // No text content for file messages
        type,
        mediaUrl: publicUrl,
        mediaMetadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          path,
        },
      });

      return messageRes;
    } catch (error) {
      this.log.error({ error, conversationId, fileName: file.name }, 'File upload error');
      return { success: false, error: 'Failed to upload file' };
    }
  }

  // Legacy file upload through backend (fallback)
  async uploadFileLegacy(
    file: File,
    conversationId: string,
    receiverId: string,
    type: 'image' | 'document' | 'voice'
  ) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);
    formData.append('receiverId', receiverId);
    formData.append('type', type);

    const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    return response.json() as Promise<ApiResponse<Message>>;
  }

  getFileUrl(fileId: string) {
    return `${API_BASE_URL}/api/files/${fileId}`;
  }

  // Admin endpoints
  async adminLogin(id: string, pass: string) {
    return this.request<{ token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ id, pass }),
    });
  }

  async adminGetUsers() {
    return this.request<User[]>('/api/admin/users');
  }

  async adminGetConversations() {
    return this.request<Conversation[]>('/api/admin/conversations');
  }

  async adminDeleteConversation(conversationId: string) {
    return this.request<{ deleted: boolean }>(`/api/admin/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async makeAdmin(userId: string) {
    return this.request<{ message: string }>('/api/admin/make-admin', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
