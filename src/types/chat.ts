/**
 * @fileoverview Enhanced type definitions with discriminated unions
 * 
 * Features:
 * - Strict TypeScript types
 * - Discriminated unions for state management
 * - Type guards for safe type narrowing
 */

// ============================================
// User Types
// ============================================

export type UserStatus = 'online' | 'offline';

export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
  status: UserStatus;
  lastSeen?: Date;
  createdAt: Date;
  isAdmin?: boolean;
}

export interface AuthUser {
  _id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ============================================
// Message Types
// ============================================

export type MessageType = 'text' | 'image' | 'document' | 'voice' | 'video';

export interface MediaMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  path?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface BaseMessage {
  _id: string;
  conversationId: string;
  senderId: string | User;
  receiverId?: string | User;
  isRead: boolean;
  isEdited?: boolean;
  replyToId?: string;
  timestamp?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Legacy Message interface for backwards compatibility
export interface Message extends BaseMessage {
  type: MessageType;
  content?: string;
  fileUrl?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  mediaMetadata?: MediaMetadata;
}

// Type guards for message types
export function isTextMessage(message: Message): boolean {
  return message.type === 'text';
}

export function isImageMessage(message: Message): boolean {
  return message.type === 'image';
}

export function isDocumentMessage(message: Message): boolean {
  return message.type === 'document';
}

export function isVoiceMessage(message: Message): boolean {
  return message.type === 'voice';
}

export function isVideoMessage(message: Message): boolean {
  return message.type === 'video';
}

export function isMediaMessage(message: Message): boolean {
  return message.type !== 'text';
}

// ============================================
// Conversation Types
// ============================================

export interface Conversation {
  _id: string;
  conversationId?: string;
  participants: Array<string | User>;
  messages?: Message[];
  lastMessage?: Message;
  lastUpdated?: Date;
  unreadCount?: { [userId: string]: number };
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// API Response Types
// ============================================

export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

// Discriminated union for API responses
export type ApiResponse<T = unknown> =
  | { success: true; data: T; error?: never; message?: string }
  | { success: false; data?: never; error: ApiError | string; message?: string };

// Type guards for API responses
export function isApiSuccess<T>(response: ApiResponse<T>): response is { success: true; data: T } {
  return response.success === true && 'data' in response;
}

export function isApiError<T>(response: ApiResponse<T>): response is { success: false; error: ApiError | string } {
  return response.success === false;
}

// Helper to extract error message
export function getApiErrorMessage(response: ApiResponse<unknown>): string {
  if (response.success) return '';
  if (typeof response.error === 'string') return response.error;
  return response.error?.message || response.message || 'An unknown error occurred';
}

// ============================================
// File Types
// ============================================

export interface FileInfo {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  isCached?: boolean;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ============================================
// Auth State (Discriminated Union)
// ============================================

export type AuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; token: string }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: string };

// Type guards for auth state
export function isAuthLoading(state: AuthState): state is { status: 'loading' } {
  return state.status === 'loading';
}

export function isAuthenticated(state: AuthState): state is { status: 'authenticated'; user: User; token: string } {
  return state.status === 'authenticated';
}

export function isUnauthenticated(state: AuthState): state is { status: 'unauthenticated' } {
  return state.status === 'unauthenticated';
}

export function isAuthError(state: AuthState): state is { status: 'error'; error: string } {
  return state.status === 'error';
}

// ============================================
// Socket Connection State
// ============================================

export type SocketState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; socketId: string }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'error'; error: string };

// ============================================
// UI State Types
// ============================================

export type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Pagination state
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Infinite scroll state for messages
export interface MessageListState {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

// ============================================
// Form State Types
// ============================================

export interface FormFieldState<T> {
  value: T;
  error: string | null;
  touched: boolean;
}

export interface LoginFormState {
  email: FormFieldState<string>;
  password: FormFieldState<string>;
  isSubmitting: boolean;
  submitError: string | null;
}

export interface SignupFormState {
  email: FormFieldState<string>;
  password: FormFieldState<string>;
  confirmPassword: FormFieldState<string>;
  name: FormFieldState<string>;
  isSubmitting: boolean;
  submitError: string | null;
}

// ============================================
// Event Types
// ============================================

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: number;
}

export interface ReadReceipt {
  messageId: string;
  readerId: string;
  readAt: Date;
}

// ============================================
// Constants
// ============================================

export const MESSAGE_TYPES: readonly MessageType[] = ['text', 'image', 'document', 'voice', 'video'] as const;

export const MAX_FILE_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 20 * 1024 * 1024, // 20MB
  document: 25 * 1024 * 1024, // 25MB
} as const;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg'] as const;
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

