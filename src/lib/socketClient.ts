/**
 * @fileoverview Production-grade Socket.IO client with reconnection logic
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong for connection health
 * - Typed events with TypeScript
 * - Offline message queue
 * - Connection state management
 * - Event handler cleanup
 * - Performance optimized with throttling
 */

import { io, Socket } from 'socket.io-client';
import type { Message } from '@/types/chat';
import { logger } from './logger';
import { SocketError, ErrorCode } from './errors';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================
// Type Definitions
// ============================================

export interface MessagePayload {
  conversationId: string;
  receiverId: string;
  content?: string;
  type?: 'text' | 'image' | 'document' | 'voice';
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: string;
}

export interface EditMessagePayload {
  conversationId: string;
  messageId: string;
  content: string;
}

export interface NewMessageEvent {
  message: Message;
  sender: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface UpdatedMessageEvent {
  messageId: string;
  conversationId: string;
  content: string;
  sender: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface DeletedMessageEvent {
  messageId: string;
  conversationId: string;
  deletedForEveryone: boolean;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

export interface UserStatusEvent {
  userId: string;
  status: 'online' | 'offline';
}

export interface SocketResponse<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export type MessageResponse = SocketResponse<Message>;

// Socket event types for type safety
export interface ServerToClientEvents {
  'message:new': (payload: NewMessageEvent) => void;
  'message:updated': (payload: UpdatedMessageEvent) => void;
  'message:deleted': (payload: DeletedMessageEvent) => void;
  'user:typing': (payload: TypingEvent) => void;
  'user:status': (payload: UserStatusEvent) => void;
  'pong': () => void;
}

export interface ClientToServerEvents {
  'conversation:join': (payload: { conversationId: string }, callback: (response: SocketResponse) => void) => void;
  'conversation:leave': (payload: { conversationId: string }, callback: (response: SocketResponse) => void) => void;
  'message:send': (payload: MessagePayload, callback: (response: MessageResponse) => void) => void;
  'message:edit': (payload: EditMessagePayload, callback: (response: SocketResponse) => void) => void;
  'message:delete': (payload: { messageId: string; conversationId: string; deleteForEveryone?: boolean }, callback: (response: SocketResponse) => void) => void;
  'message:mark-read': (payload: { conversationId: string }, callback: (response: SocketResponse) => void) => void;
  'typing:start': (payload: { conversationId: string }) => void;
  'typing:stop': (payload: { conversationId: string }) => void;
  'ping': () => void;
}

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Event handler types
type EventHandler<T> = (event: T) => void;

// ============================================
// Reconnection Configuration
// ============================================

interface ReconnectConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// ============================================
// Offline Queue Item
// ============================================

interface QueuedMessage {
  id: string;
  type: 'send' | 'edit' | 'delete' | 'markRead';
  payload: unknown;
  timestamp: number;
  retryCount: number;
}

// ============================================
// Socket Client Class
// ============================================

class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private token: string | null = null;
  private reconnectConfig: ReconnectConfig = DEFAULT_RECONNECT_CONFIG;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongTime = 0;
  
  // Connection state
  private _connectionState: ConnectionState = 'disconnected';
  private connectionStateHandlers: Set<EventHandler<ConnectionState>> = new Set();
  
  // Event handlers using Sets for O(1) add/remove
  private messageHandlers: Set<EventHandler<NewMessageEvent>> = new Set();
  private updatedHandlers: Set<EventHandler<UpdatedMessageEvent>> = new Set();
  private deletedHandlers: Set<EventHandler<DeletedMessageEvent>> = new Set();
  private typingHandlers: Set<EventHandler<TypingEvent>> = new Set();
  private statusHandlers: Set<EventHandler<UserStatusEvent>> = new Set();
  
  // Offline message queue
  private offlineQueue: Map<string, QueuedMessage> = new Map();
  
  // Joined conversations for auto-rejoin
  private joinedConversations: Set<string> = new Set();
  
  // Logger instance
  private readonly log = logger.child({ component: 'SocketClient' });

  // ============================================
  // Connection State Management
  // ============================================

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.log.info({ state }, 'Connection state changed');
      this.connectionStateHandlers.forEach(handler => handler(state));
    }
  }

  onConnectionStateChange(handler: EventHandler<ConnectionState>): () => void {
    this.connectionStateHandlers.add(handler);
    // Immediately notify of current state
    handler(this._connectionState);
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  // ============================================
  // Connection Management
  // ============================================

  connect(token: string): void {
    if (this.socket?.connected) {
      this.log.debug('Already connected, skipping');
      return;
    }

    this.token = token;
    this.setConnectionState('connecting');
    this.reconnectAttempts = 0;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection manually
      timeout: 10000,
    });

    this.setupEventListeners();
    this.log.info({ url: SOCKET_URL }, 'Initiating socket connection');
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.log.info({ socketId: this.socket?.id }, 'Socket connected');
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.processOfflineQueue();
      this.rejoinConversations();
    });

    this.socket.on('disconnect', (reason) => {
      this.log.warn({ reason }, 'Socket disconnected');
      this.stopHeartbeat();
      
      if (reason === 'io server disconnect') {
        // Server forcefully disconnected, don't auto-reconnect (likely auth issue)
        this.setConnectionState('disconnected');
      } else {
        // Connection lost, attempt to reconnect
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.log.error({ error: error.message }, 'Socket connection error');
      this.setConnectionState('reconnecting');
      this.scheduleReconnect();
    });

    // Message events
    this.socket.on('message:new', (payload) => {
      this.log.debug({ messageId: payload.message._id }, 'New message received');
      this.messageHandlers.forEach(handler => handler(payload));
    });

    this.socket.on('message:updated', (payload) => {
      this.log.debug({ messageId: payload.messageId }, 'Message updated');
      this.updatedHandlers.forEach(handler => handler(payload));
    });

    this.socket.on('message:deleted', (payload) => {
      this.log.debug({ messageId: payload.messageId }, 'Message deleted');
      this.deletedHandlers.forEach(handler => handler(payload));
    });

    this.socket.on('user:typing', (payload) => {
      this.typingHandlers.forEach(handler => handler(payload));
    });

    this.socket.on('user:status', (payload) => {
      this.log.debug({ userId: payload.userId, status: payload.status }, 'User status changed');
      this.statusHandlers.forEach(handler => handler(payload));
    });

    // Heartbeat response
    this.socket.on('pong', () => {
      this.lastPongTime = Date.now();
    });
  }

  // ============================================
  // Heartbeat / Keep-Alive
  // ============================================

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (!this.socket?.connected) return;

      // Check if we missed too many pongs (connection might be stale)
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      if (timeSinceLastPong > 35000) { // 35 seconds without pong
        this.log.warn({ timeSinceLastPong }, 'Connection appears stale, reconnecting');
        this.socket?.disconnect();
        return;
      }

      this.socket.emit('ping');
    }, 15000); // Ping every 15 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ============================================
  // Reconnection Logic
  // ============================================

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.reconnectConfig.maxRetries) {
      this.log.error({ attempts: this.reconnectAttempts }, 'Max reconnection attempts reached');
      this.setConnectionState('disconnected');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectConfig.initialDelayMs * Math.pow(this.reconnectConfig.backoffMultiplier, this.reconnectAttempts),
      this.reconnectConfig.maxDelayMs
    );

    this.log.info({ attempt: this.reconnectAttempts + 1, delayMs: delay }, 'Scheduling reconnection');

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.token) {
        this.socket?.connect();
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ============================================
  // Conversation Room Management
  // ============================================

  private async rejoinConversations(): Promise<void> {
    for (const conversationId of this.joinedConversations) {
      try {
        await this.joinConversation(conversationId);
      } catch (error) {
        this.log.error({ error, conversationId }, 'Failed to rejoin conversation');
      }
    }
  }

  async joinConversation(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        this.joinedConversations.add(conversationId);
        resolve(false);
        return;
      }

      this.socket.emit('conversation:join', { conversationId }, (response) => {
        if (response.success) {
          this.joinedConversations.add(conversationId);
          this.log.debug({ conversationId }, 'Joined conversation');
        }
        resolve(response.success);
      });
    });
  }

  async leaveConversation(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.joinedConversations.delete(conversationId);
      
      if (!this.socket?.connected) {
        resolve(true);
        return;
      }

      this.socket.emit('conversation:leave', { conversationId }, (response) => {
        this.log.debug({ conversationId }, 'Left conversation');
        resolve(response.success);
      });
    });
  }

  // ============================================
  // Offline Queue Management
  // ============================================

  private queueMessage(item: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.offlineQueue.set(id, {
      ...item,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    });
    this.log.debug({ queueId: id, type: item.type }, 'Message queued for offline delivery');
    return id;
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.size === 0) return;

    this.log.info({ queueSize: this.offlineQueue.size }, 'Processing offline queue');

    for (const [id, item] of this.offlineQueue) {
      try {
        switch (item.type) {
          case 'send':
            await this.sendMessage(item.payload as MessagePayload);
            break;
          case 'edit':
            await this.editMessage(item.payload as EditMessagePayload);
            break;
          case 'delete':
            const deletePayload = item.payload as { messageId: string; conversationId: string };
            await this.deleteMessage(deletePayload.messageId, deletePayload.conversationId);
            break;
          case 'markRead':
            const readPayload = item.payload as { conversationId: string };
            await this.markAsRead(readPayload.conversationId);
            break;
        }
        this.offlineQueue.delete(id);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= 3) {
          this.offlineQueue.delete(id);
          this.log.error({ queueId: id, error }, 'Failed to process queued message after retries');
        }
      }
    }
  }

  // ============================================
  // Message Operations
  // ============================================

  async sendMessage(payload: MessagePayload): Promise<MessageResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        // Queue for later delivery
        this.queueMessage({ type: 'send', payload });
        resolve({ success: false, error: 'Not connected - message queued' });
        return;
      }

      const timer = this.log.time('sendMessage');
      this.socket.emit('message:send', payload, (response) => {
        timer();
        if (!response.success) {
          this.log.warn({ error: response.error }, 'Failed to send message');
        }
        resolve(response);
      });
    });
  }

  async editMessage(payload: EditMessagePayload): Promise<SocketResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        this.queueMessage({ type: 'edit', payload });
        resolve({ success: false, error: 'Not connected - edit queued' });
        return;
      }

      this.socket.emit('message:edit', payload, (response) => {
        resolve(response);
      });
    });
  }

  async deleteMessage(messageId: string, conversationId: string, deleteForEveryone: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        this.queueMessage({ type: 'delete', payload: { messageId, conversationId, deleteForEveryone } });
        resolve(false);
        return;
      }

      this.socket.emit('message:delete', { messageId, conversationId, deleteForEveryone }, (response) => {
        resolve(response.success);
      });
    });
  }

  async markAsRead(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        this.queueMessage({ type: 'markRead', payload: { conversationId } });
        resolve(false);
        return;
      }

      this.socket.emit('message:mark-read', { conversationId }, (response) => {
        resolve(response.success);
      });
    });
  }

  // ============================================
  // Typing Indicators (throttled)
  // ============================================

  private typingThrottles: Map<string, number> = new Map();

  startTyping(conversationId: string): void {
    const now = Date.now();
    const lastEmit = this.typingThrottles.get(conversationId) || 0;
    
    // Throttle to max once per second
    if (now - lastEmit < 1000) return;
    
    this.typingThrottles.set(conversationId, now);
    this.socket?.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.typingThrottles.delete(conversationId);
    this.socket?.emit('typing:stop', { conversationId });
  }

  // ============================================
  // Event Subscription (O(1) add/remove)
  // ============================================

  onNewMessage(handler: EventHandler<NewMessageEvent>): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onMessageUpdated(handler: EventHandler<UpdatedMessageEvent>): () => void {
    this.updatedHandlers.add(handler);
    return () => this.updatedHandlers.delete(handler);
  }

  onMessageDeleted(handler: EventHandler<DeletedMessageEvent>): () => void {
    this.deletedHandlers.add(handler);
    return () => this.deletedHandlers.delete(handler);
  }

  onTyping(handler: EventHandler<TypingEvent>): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onUserStatus(handler: EventHandler<UserStatusEvent>): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  // ============================================
  // Cleanup
  // ============================================

  cleanup(): void {
    this.messageHandlers.clear();
    this.updatedHandlers.clear();
    this.deletedHandlers.clear();
    this.typingHandlers.clear();
    this.statusHandlers.clear();
    this.connectionStateHandlers.clear();
    this.socket?.removeAllListeners();
    this.log.debug('Event handlers cleared');
  }

  disconnect(): void {
    this.cancelReconnect();
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.token = null;
    this.joinedConversations.clear();
    this.setConnectionState('disconnected');
    this.log.info('Socket disconnected');
  }

  // ============================================
  // Status Getters
  // ============================================

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get offlineQueueSize(): number {
    return this.offlineQueue.size;
  }
}

// Singleton export
export const socketClient = new SocketClient();
export default socketClient;
