// src/types/chat.ts

export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline';
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

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | User;
  receiverId?: string | User;
  content?: string;
  type: 'text' | 'image' | 'document' | 'voice';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  isRead: boolean;
  timestamp?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  } | string;
  message?: string;
}

