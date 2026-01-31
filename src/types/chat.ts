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

export interface MediaMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  path?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | User;
  receiverId?: string | User;
  content?: string;
  type: 'text' | 'image' | 'document' | 'voice' | 'video';
  fileUrl?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  isRead: boolean;
  isEdited?: boolean;
  replyToId?: string;
  timestamp?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  mediaMetadata?: MediaMetadata;
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

