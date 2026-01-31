/**
 * @fileoverview Production-grade logging infrastructure
 * 
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Context support (userId, requestId, timestamps)
 * - Development vs Production modes
 * - Structured logging format
 * - Performance optimized (no-op in production for debug)
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId, action: 'sendMessage' }, 'Message sent');
 *   logger.error({ error, context }, 'Failed to send message');
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  requestId?: string;
  conversationId?: string;
  action?: string;
  component?: string;
  duration?: number;
  error?: Error | unknown;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

// Log level hierarchy for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private readonly minLevel: LogLevel;
  private readonly isDev: boolean;

  constructor() {
    this.isDev = process.env.NODE_ENV !== 'production';
    this.minLevel = this.isDev ? 'debug' : 'info';
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  /**
   * Generate a unique request ID for tracing
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const { level, message, timestamp, context } = entry;
    
    if (this.isDev) {
      // Pretty print for development
      const contextStr = context ? ` ${JSON.stringify(context, this.errorReplacer)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    }
    
    // Structured JSON for production (compatible with log aggregators)
    return JSON.stringify({
      ...entry,
      context: context ? this.serializeContext(context) : undefined,
    }, this.errorReplacer);
  }

  /**
   * Serialize context for JSON output, handling Error objects
   */
  private serializeContext(context: LogContext): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (value instanceof Error) {
        serialized[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      } else {
        serialized[key] = value;
      }
    }
    
    return serialized;
  }

  /**
   * JSON replacer to handle Error objects and circular refs
   */
  private errorReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    return value;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, context: LogContext | string, message?: string): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    let logContext: LogContext | undefined;
    let logMessage: string;

    if (typeof context === 'string') {
      logMessage = context;
      logContext = undefined;
    } else {
      logContext = context;
      logMessage = message || '';
    }

    const entry: LogEntry = {
      level,
      message: logMessage,
      timestamp,
      context: logContext,
    };

    const formatted = this.formatEntry(entry);

    // Output to appropriate console method
    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }

    // In production, also send errors to external service (Sentry, etc.)
    if (!this.isDev && level === 'error' && logContext?.error) {
      this.reportToExternalService(entry);
    }
  }

  /**
   * Report errors to external monitoring service
   * Implement Sentry integration here
   */
  private reportToExternalService(entry: LogEntry): void {
    // TODO: Integrate with Sentry
    // import * as Sentry from '@sentry/nextjs';
    // Sentry.captureException(entry.context?.error, {
    //   extra: entry.context,
    // });
  }

  /**
   * Debug level - development only, stripped in production
   */
  debug(context: LogContext | string, message?: string): void {
    this.log('debug', context, message);
  }

  /**
   * Info level - general operational information
   */
  info(context: LogContext | string, message?: string): void {
    this.log('info', context, message);
  }

  /**
   * Warn level - potentially harmful situations
   */
  warn(context: LogContext | string, message?: string): void {
    this.log('warn', context, message);
  }

  /**
   * Error level - error events, failures
   */
  error(context: LogContext | string, message?: string): void {
    this.log('error', context, message);
  }

  /**
   * Create a child logger with preset context
   */
  child(baseContext: LogContext): ChildLogger {
    return new ChildLogger(this, baseContext);
  }

  /**
   * Performance timing helper
   */
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.debug({ action: label, duration }, `${label} completed in ${duration}ms`);
    };
  }
}

/**
 * Child logger with preset context
 */
class ChildLogger {
  constructor(
    private readonly parent: Logger,
    private readonly baseContext: LogContext
  ) {}

  debug(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.parent.debug(this.baseContext, context);
    } else {
      this.parent.debug({ ...this.baseContext, ...context }, message);
    }
  }

  info(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.parent.info(this.baseContext, context);
    } else {
      this.parent.info({ ...this.baseContext, ...context }, message);
    }
  }

  warn(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.parent.warn(this.baseContext, context);
    } else {
      this.parent.warn({ ...this.baseContext, ...context }, message);
    }
  }

  error(context: LogContext | string, message?: string): void {
    if (typeof context === 'string') {
      this.parent.error(this.baseContext, context);
    } else {
      this.parent.error({ ...this.baseContext, ...context }, message);
    }
  }

  /**
   * Performance timing helper with child context
   */
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.debug({ action: label, duration }, `${label} completed in ${duration}ms`);
    };
  }
}

// Singleton logger instance
export const logger = new Logger();

// Export default for convenience
export default logger;
