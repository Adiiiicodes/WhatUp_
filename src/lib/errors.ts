/**
 * @fileoverview Custom error classes for structured error handling
 * 
 * Features:
 * - Typed error classes with specific properties
 * - Discriminated unions for error state management
 * - Serializable errors for logging/transmission
 * - Retry-awareness for transient errors
 */

/**
 * Error codes for categorizing errors
 */
export const ErrorCode = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  OFFLINE: 'OFFLINE',
  
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // API errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Socket errors
  SOCKET_DISCONNECTED: 'SOCKET_DISCONNECTED',
  SOCKET_TIMEOUT: 'SOCKET_TIMEOUT',
  
  // File errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  
  // Generic
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Base error class for application errors
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCodeType;
  abstract readonly isRetryable: boolean;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error for logging/transmission
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      isRetryable: this.isRetryable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends AppError {
  readonly code = ErrorCode.NETWORK_ERROR;
  readonly isRetryable = true;
  readonly status?: number;

  constructor(message: string, status?: number, context?: Record<string, unknown>) {
    super(message, context);
    this.status = status;
  }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends AppError {
  readonly code = ErrorCode.TIMEOUT;
  readonly isRetryable = true;
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, context?: Record<string, unknown>) {
    super(message, context);
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Offline/connectivity errors
 */
export class OfflineError extends AppError {
  readonly code = ErrorCode.OFFLINE;
  readonly isRetryable = true;

  constructor(message = 'No internet connection', context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
  readonly code: typeof ErrorCode.UNAUTHORIZED | typeof ErrorCode.TOKEN_EXPIRED | typeof ErrorCode.INVALID_CREDENTIALS;
  readonly isRetryable = false;

  constructor(
    message: string,
    code: typeof ErrorCode.UNAUTHORIZED | typeof ErrorCode.TOKEN_EXPIRED | typeof ErrorCode.INVALID_CREDENTIALS = ErrorCode.UNAUTHORIZED,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.code = code;
  }
}

/**
 * Authorization errors (user lacks permissions)
 */
export class ForbiddenError extends AppError {
  readonly code = ErrorCode.FORBIDDEN;
  readonly isRetryable = false;

  constructor(message = 'Access denied', context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  readonly code = ErrorCode.VALIDATION_ERROR;
  readonly isRetryable = false;
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]> = {}, context?: Record<string, unknown>) {
    super(message, context);
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  readonly code = ErrorCode.NOT_FOUND;
  readonly isRetryable = false;
  readonly resource?: string;

  constructor(message: string, resource?: string, context?: Record<string, unknown>) {
    super(message, context);
    this.resource = resource;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  readonly code = ErrorCode.RATE_LIMITED;
  readonly isRetryable = true;
  readonly retryAfterMs?: number;

  constructor(message = 'Rate limit exceeded', retryAfterMs?: number, context?: Record<string, unknown>) {
    super(message, context);
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Server errors (5xx)
 */
export class ServerError extends AppError {
  readonly code = ErrorCode.SERVER_ERROR;
  readonly isRetryable = true;
  readonly status: number;

  constructor(message: string, status: number = 500, context?: Record<string, unknown>) {
    super(message, context);
    this.status = status;
  }
}

/**
 * Socket connection errors
 */
export class SocketError extends AppError {
  readonly code: typeof ErrorCode.SOCKET_DISCONNECTED | typeof ErrorCode.SOCKET_TIMEOUT;
  readonly isRetryable = true;

  constructor(
    message: string,
    code: typeof ErrorCode.SOCKET_DISCONNECTED | typeof ErrorCode.SOCKET_TIMEOUT = ErrorCode.SOCKET_DISCONNECTED,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.code = code;
  }
}

/**
 * File upload errors
 */
export class FileError extends AppError {
  readonly code: typeof ErrorCode.FILE_TOO_LARGE | typeof ErrorCode.INVALID_FILE_TYPE | typeof ErrorCode.UPLOAD_FAILED;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: typeof ErrorCode.FILE_TOO_LARGE | typeof ErrorCode.INVALID_FILE_TYPE | typeof ErrorCode.UPLOAD_FAILED,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.code = code;
    this.isRetryable = code === ErrorCode.UPLOAD_FAILED;
  }
}

/**
 * Generic unknown error wrapper
 */
export class UnknownError extends AppError {
  readonly code = ErrorCode.UNKNOWN;
  readonly isRetryable = false;
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown, context?: Record<string, unknown>) {
    super(message, context);
    this.originalError = originalError;
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new UnknownError(error.message, error);
  }

  if (typeof error === 'string') {
    return new UnknownError(error);
  }

  return new UnknownError('An unknown error occurred', error);
}

/**
 * Create error from HTTP status code
 */
export function createErrorFromStatus(status: number, message: string, context?: Record<string, unknown>): AppError {
  switch (status) {
    case 401:
      return new AuthError(message, ErrorCode.UNAUTHORIZED, context);
    case 403:
      return new ForbiddenError(message, context);
    case 404:
      return new NotFoundError(message, undefined, context);
    case 408:
      return new TimeoutError(message, 0, context);
    case 422:
      return new ValidationError(message, {}, context);
    case 429:
      return new RateLimitError(message, undefined, context);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, status, context);
    default:
      if (status >= 400 && status < 500) {
        return new ValidationError(message, {}, context);
      }
      return new UnknownError(message, undefined, context);
  }
}

// ============================================
// Discriminated Union Types for UI State
// ============================================

/**
 * Represents loading state for async operations
 */
export type AsyncState<T, E = AppError> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

/**
 * Type guards for AsyncState
 */
export function isIdle<T, E>(state: AsyncState<T, E>): state is { status: 'idle' } {
  return state.status === 'idle';
}

export function isLoading<T, E>(state: AsyncState<T, E>): state is { status: 'loading' } {
  return state.status === 'loading';
}

export function isSuccess<T, E>(state: AsyncState<T, E>): state is { status: 'success'; data: T } {
  return state.status === 'success';
}

export function isError<T, E>(state: AsyncState<T, E>): state is { status: 'error'; error: E } {
  return state.status === 'error';
}

/**
 * Helper to create AsyncState values
 */
export const AsyncState = {
  idle: <T, E = AppError>(): AsyncState<T, E> => ({ status: 'idle' }),
  loading: <T, E = AppError>(): AsyncState<T, E> => ({ status: 'loading' }),
  success: <T, E = AppError>(data: T): AsyncState<T, E> => ({ status: 'success', data }),
  error: <T, E = AppError>(error: E): AsyncState<T, E> => ({ status: 'error', error }),
};
