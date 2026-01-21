// src/lib/socketClient.ts
// Socket.IO client for real-time communication with the backend

import { io, Socket } from 'socket.io-client';
import type { Message } from '../types/chat';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export interface SocketResponse {
  success: boolean;
  error?: string;
}

export interface MessageResponse extends SocketResponse {
  message?: Message;
}

class SocketClient {
  private socket: Socket | null = null;
  private messageHandlers: ((event: NewMessageEvent) => void)[] = [];
  private updatedHandlers: ((event: UpdatedMessageEvent) => void)[] = [];
  private deletedHandlers: ((event: { messageId: string; conversationId: string }) => void)[] = [];
  private typingHandlers: ((event: TypingEvent) => void)[] = [];
  private statusHandlers: ((event: UserStatusEvent) => void)[] = [];

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('message:new', (payload: NewMessageEvent) => {
      this.messageHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('message:updated', (payload: UpdatedMessageEvent) => {
      this.updatedHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('message:deleted', (payload: { messageId: string; conversationId: string }) => {
      this.deletedHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('user:typing', (payload: TypingEvent) => {
      this.typingHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('user:status', (payload: UserStatusEvent) => {
      this.statusHandlers.forEach((handler) => handler(payload));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Join a conversation room
  joinConversation(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }
      this.socket.emit('conversation:join', { conversationId }, (response: SocketResponse) => {
        resolve(response.success);
      });
    });
  }

  // Leave a conversation room
  leaveConversation(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }
      this.socket.emit('conversation:leave', { conversationId }, (response: SocketResponse) => {
        resolve(response.success);
      });
    });
  }

  // Send a message
  sendMessage(payload: MessagePayload): Promise<MessageResponse> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.socket.emit('message:send', payload, (response: MessageResponse) => {
        resolve(response);
      });
    });
  }

  // Edit a message
  editMessage(payload: EditMessagePayload): Promise<SocketResponse> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.socket.emit('message:edit', payload, (response: SocketResponse) => {
        resolve(response);
      });
    });
  }

  // Delete a message
  deleteMessage(messageId: string, conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }
      this.socket.emit('message:delete', { messageId, conversationId }, (response: SocketResponse) => {
        resolve(response.success);
      });
    });
  }

  // Mark conversation as read
  markAsRead(conversationId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }
      this.socket.emit('message:mark-read', { conversationId }, (response: SocketResponse) => {
        resolve(response.success);
      });
    });
  }

  // Typing indicators
  startTyping(conversationId: string) {
    this.socket?.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string) {
    this.socket?.emit('typing:stop', { conversationId });
  }

  // Event handlers
  onNewMessage(handler: (event: NewMessageEvent) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onMessageUpdated(handler: (event: UpdatedMessageEvent) => void) {
    this.updatedHandlers.push(handler);
    return () => {
      this.updatedHandlers = this.updatedHandlers.filter((h) => h !== handler);
    };
  }

  onMessageDeleted(handler: (event: { messageId: string; conversationId: string }) => void) {
    this.deletedHandlers.push(handler);
    return () => {
      this.deletedHandlers = this.deletedHandlers.filter((h) => h !== handler);
    };
  }

  onTyping(handler: (event: TypingEvent) => void) {
    this.typingHandlers.push(handler);
    return () => {
      this.typingHandlers = this.typingHandlers.filter((h) => h !== handler);
    };
  }

  onUserStatus(handler: (event: UserStatusEvent) => void) {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketClient = new SocketClient();
export default socketClient;
