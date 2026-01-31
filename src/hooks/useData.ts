/**
 * @fileoverview Custom hooks for data fetching with caching and optimistic updates
 * 
 * Features:
 * - Data caching
 * - Optimistic updates
 * - Error handling
 * - Loading states
 * - Pagination support
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import apiClient from '@/lib/api';
import { logger } from '@/lib/logger';
import type { Message, Conversation, User, ApiResponse } from '@/types/chat';
import { useSocket } from '@/contexts/SocketContext';
import { extractId } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface MediaMetadataInput {
  fileName: string;
  fileSize: number;
  mimeType: string;
  path: string;
  width?: number;
  height?: number;
  duration?: number;
}

interface UseMessagesOptions {
  conversationId: string;
  pollingInterval?: number;
  enabled?: boolean;
}

interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendMessage: (content: string, type?: Message['type'], mediaUrl?: string, metadata?: MediaMetadataInput) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  optimisticAddMessage: (message: Message) => void;
  optimisticRemoveMessage: (messageId: string) => void;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createConversation: (participantId: string) => Promise<Conversation | null>;
}

interface UseUsersReturn {
  users: User[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getUserById: (id: string) => User | undefined;
}

// ============================================
// Message Cache (O(1) lookups)
// ============================================

class MessageCache {
  private cache = new Map<string, Map<string, Message>>();
  private order = new Map<string, string[]>();

  get(conversationId: string): Message[] {
    const messages = this.cache.get(conversationId);
    if (!messages) return [];
    
    const order = this.order.get(conversationId) || [];
    return order.map(id => messages.get(id)).filter((m): m is Message => m !== undefined);
  }

  set(conversationId: string, messages: Message[]): void {
    const messageMap = new Map<string, Message>();
    const orderList: string[] = [];
    
    for (const msg of messages) {
      messageMap.set(msg._id, msg);
      orderList.push(msg._id);
    }
    
    this.cache.set(conversationId, messageMap);
    this.order.set(conversationId, orderList);
  }

  add(conversationId: string, message: Message): void {
    let messageMap = this.cache.get(conversationId);
    if (!messageMap) {
      messageMap = new Map();
      this.cache.set(conversationId, messageMap);
    }
    
    let orderList = this.order.get(conversationId);
    if (!orderList) {
      orderList = [];
      this.order.set(conversationId, orderList);
    }
    
    if (!messageMap.has(message._id)) {
      messageMap.set(message._id, message);
      orderList.push(message._id);
    } else {
      messageMap.set(message._id, message);
    }
  }

  remove(conversationId: string, messageId: string): void {
    const messageMap = this.cache.get(conversationId);
    if (messageMap) {
      messageMap.delete(messageId);
    }
    
    const orderList = this.order.get(conversationId);
    if (orderList) {
      const index = orderList.indexOf(messageId);
      if (index >= 0) {
        orderList.splice(index, 1);
      }
    }
  }

  clear(conversationId?: string): void {
    if (conversationId) {
      this.cache.delete(conversationId);
      this.order.delete(conversationId);
    } else {
      this.cache.clear();
      this.order.clear();
    }
  }
}

// Global message cache instance
const messageCache = new MessageCache();

// ============================================
// useMessages Hook
// ============================================

export function useMessages({
  conversationId,
  pollingInterval = 3000,
  enabled = true,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>(() => messageCache.get(conversationId));
  const [isLoading, setIsLoading] = useState(messages.length === 0);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { onNewMessage, onMessageDeleted, onMessageUpdated } = useSocket();
  const log = useMemo(() => logger.child({ component: 'useMessages', conversationId }), [conversationId]);
  const isMountedRef = useRef(true);

  // Fetch messages from API
  const fetchMessages = useCallback(async (showLoading = true) => {
    if (!enabled || !conversationId) return;
    
    if (showLoading && messages.length === 0) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    
    try {
      const res = await apiClient.getMessages(conversationId);
      
      if (!isMountedRef.current) return;
      
      if (res.success && res.data) {
        messageCache.set(conversationId, res.data);
        setMessages(res.data);
        setError(null);
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to fetch messages';
        log.warn({ error: errorMsg }, 'Failed to fetch messages');
        setError(errorMsg);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      log.error({ error: err }, 'Error fetching messages');
      setError('Failed to fetch messages');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, [conversationId, enabled, messages.length, log]);

  // Initial fetch and polling
  useEffect(() => {
    isMountedRef.current = true;
    fetchMessages(true);
    
    const interval = setInterval(() => fetchMessages(false), pollingInterval);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchMessages, pollingInterval]);

  // Listen for socket events
  useEffect(() => {
    const unsubNew = onNewMessage((event) => {
      if (event.message.conversationId === conversationId) {
        log.debug({ messageId: event.message._id }, 'New message received via socket');
        messageCache.add(conversationId, event.message);
        setMessages(prev => {
          // Check if message already exists (avoid duplicates from optimistic update)
          if (prev.some(m => m._id === event.message._id)) {
            return prev.map(m => m._id === event.message._id ? event.message : m);
          }
          return [...prev, event.message];
        });
      }
    });

    const unsubDeleted = onMessageDeleted((event) => {
      if (event.conversationId === conversationId) {
        log.debug({ messageId: event.messageId }, 'Message deleted via socket');
        messageCache.remove(conversationId, event.messageId);
        setMessages(prev => prev.filter(m => m._id !== event.messageId));
      }
    });

    const unsubUpdated = onMessageUpdated((event) => {
      if (event.conversationId === conversationId) {
        log.debug({ messageId: event.messageId }, 'Message updated via socket');
        setMessages(prev => prev.map(m => 
          m._id === event.messageId ? { ...m, content: event.content, isEdited: true } : m
        ));
      }
    });

    return () => {
      unsubNew();
      unsubDeleted();
      unsubUpdated();
    };
  }, [conversationId, onNewMessage, onMessageDeleted, onMessageUpdated, log]);

  // Optimistic add message
  const optimisticAddMessage = useCallback((message: Message) => {
    messageCache.add(conversationId, message);
    setMessages(prev => [...prev, message]);
  }, [conversationId]);

  // Optimistic remove message
  const optimisticRemoveMessage = useCallback((messageId: string) => {
    messageCache.remove(conversationId, messageId);
    setMessages(prev => prev.filter(m => m._id !== messageId));
  }, [conversationId]);

  // Send message with optimistic update
  const sendMessage = useCallback(async (
    content: string,
    type: Message['type'] = 'text',
    mediaUrl?: string,
    metadata?: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      path: string;
      width?: number;
      height?: number;
      duration?: number;
    }
  ): Promise<boolean> => {
    // Get receiver ID from conversation
    const res = await apiClient.getConversation(conversationId);
    if (!res.success || !res.data) {
      log.error('Failed to get conversation for sending message');
      return false;
    }
    
    const currentUserId = extractId((await apiClient.getMe()).data?._id);
    const receiverId = extractId(res.data.participants.find(p => extractId(p) !== currentUserId));
    
    if (!receiverId) {
      log.error('Could not determine receiver');
      return false;
    }

    // Create optimistic message
    const optimisticMessage: Message = {
      _id: `temp_${Date.now()}`,
      conversationId,
      senderId: currentUserId,
      receiverId,
      content,
      type,
      isRead: false,
      createdAt: new Date(),
      ...(mediaUrl && { mediaUrl }),
      ...(metadata && { mediaMetadata: metadata }),
    };

    // Optimistically add to UI
    optimisticAddMessage(optimisticMessage);

    try {
      const sendRes = await apiClient.sendMessage({
        conversationId,
        receiverId,
        content,
        type,
        mediaUrl,
        mediaMetadata: metadata,
      });

      if (sendRes.success && sendRes.data) {
        // Replace optimistic message with real one
        messageCache.remove(conversationId, optimisticMessage._id);
        messageCache.add(conversationId, sendRes.data);
        setMessages(prev => prev.map(m => 
          m._id === optimisticMessage._id ? sendRes.data! : m
        ));
        return true;
      } else {
        // Rollback on failure
        optimisticRemoveMessage(optimisticMessage._id);
        log.error({ error: sendRes.error }, 'Failed to send message');
        return false;
      }
    } catch (err) {
      // Rollback on error
      optimisticRemoveMessage(optimisticMessage._id);
      log.error({ error: err }, 'Error sending message');
      return false;
    }
  }, [conversationId, optimisticAddMessage, optimisticRemoveMessage, log]);

  // Delete message with optimistic update
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    const messageToDelete = messages.find(m => m._id === messageId);
    if (!messageToDelete) return false;

    // Optimistically remove
    optimisticRemoveMessage(messageId);

    try {
      const res = await apiClient.deleteMessage(messageId, conversationId);
      
      if (!res.success) {
        // Rollback on failure
        if (messageToDelete) {
          optimisticAddMessage(messageToDelete);
        }
        return false;
      }
      
      return true;
    } catch (err) {
      // Rollback on error
      if (messageToDelete) {
        optimisticAddMessage(messageToDelete);
      }
      log.error({ error: err, messageId }, 'Error deleting message');
      return false;
    }
  }, [conversationId, messages, optimisticAddMessage, optimisticRemoveMessage, log]);

  return {
    messages,
    isLoading,
    isRefetching,
    error,
    refetch: () => fetchMessages(false),
    sendMessage,
    deleteMessage,
    optimisticAddMessage,
    optimisticRemoveMessage,
  };
}

// ============================================
// useConversations Hook
// ============================================

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const log = useMemo(() => logger.child({ component: 'useConversations' }), []);
  const isMountedRef = useRef(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.getConversations();
      
      if (!isMountedRef.current) return;
      
      if (res.success && res.data) {
        setConversations(res.data);
        setError(null);
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to fetch conversations';
        log.warn({ error: errorMsg }, 'Failed to fetch conversations');
        setError(errorMsg);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      log.error({ error: err }, 'Error fetching conversations');
      setError('Failed to fetch conversations');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [log]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchConversations();
    
    // Listen for refresh events
    const handleRefresh = () => fetchConversations();
    window.addEventListener('conversations:refresh', handleRefresh);
    
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('conversations:refresh', handleRefresh);
    };
  }, [fetchConversations]);

  const createConversation = useCallback(async (participantId: string): Promise<Conversation | null> => {
    try {
      const res = await apiClient.createConversation(participantId);
      
      if (res.success && res.data) {
        // Add to conversations list
        setConversations(prev => {
          // Check if already exists
          if (prev.some(c => c._id === res.data!._id)) {
            return prev;
          }
          return [res.data!, ...prev];
        });
        return res.data;
      }
      
      return null;
    } catch (err) {
      log.error({ error: err, participantId }, 'Error creating conversation');
      return null;
    }
  }, [log]);

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchConversations,
    createConversation,
  };
}

// ============================================
// useUsers Hook
// ============================================

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Map for O(1) lookups
  const userMapRef = useRef<Map<string, User>>(new Map());
  const log = useMemo(() => logger.child({ component: 'useUsers' }), []);
  const isMountedRef = useRef(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.getUsers();
      
      if (!isMountedRef.current) return;
      
      if (res.success && res.data) {
        setUsers(res.data);
        // Update map for quick lookups
        userMapRef.current.clear();
        for (const user of res.data) {
          userMapRef.current.set(user._id, user);
        }
        setError(null);
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to fetch users';
        log.warn({ error: errorMsg }, 'Failed to fetch users');
        setError(errorMsg);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      log.error({ error: err }, 'Error fetching users');
      setError('Failed to fetch users');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [log]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchUsers();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchUsers]);

  // O(1) user lookup
  const getUserById = useCallback((id: string): User | undefined => {
    return userMapRef.current.get(id);
  }, []);

  return {
    users,
    isLoading,
    error,
    refetch: fetchUsers,
    getUserById,
  };
}

// ============================================
// useTypingIndicator Hook
// ============================================

interface TypingUser {
  userId: string;
  name: string;
  timestamp: number;
}

export function useTypingIndicator(conversationId: string) {
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const { onTyping } = useSocket();
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // Copy ref to local variable at the start of effect for cleanup
    const timeouts = timeoutRef.current;

    const unsubscribe = onTyping((event) => {
      if (event.conversationId !== conversationId) return;

      if (event.isTyping) {
        // Add typing user
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.set(event.userId, {
            userId: event.userId,
            name: event.name,
            timestamp: Date.now(),
          });
          return next;
        });

        // Clear existing timeout
        const existingTimeout = timeouts.get(event.userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set timeout to remove after 3 seconds of no activity
        const timeout = setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Map(prev);
            next.delete(event.userId);
            return next;
          });
          timeouts.delete(event.userId);
        }, 3000);
        
        timeouts.set(event.userId, timeout);
      } else {
        // Remove typing user
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(event.userId);
          return next;
        });
        
        const timeout = timeouts.get(event.userId);
        if (timeout) {
          clearTimeout(timeout);
          timeouts.delete(event.userId);
        }
      }
    });

    return () => {
      unsubscribe();
      // Clear all timeouts
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
      timeouts.clear();
    };
  }, [conversationId, onTyping]);

  // Get typing users as array
  const typingUsersList = useMemo(() => 
    Array.from(typingUsers.values()),
    [typingUsers]
  );

  // Format typing indicator text
  const typingText = useMemo(() => {
    if (typingUsersList.length === 0) return null;
    if (typingUsersList.length === 1) return `${typingUsersList[0].name} is typing...`;
    if (typingUsersList.length === 2) return `${typingUsersList[0].name} and ${typingUsersList[1].name} are typing...`;
    return `${typingUsersList[0].name} and ${typingUsersList.length - 1} others are typing...`;
  }, [typingUsersList]);

  return {
    typingUsers: typingUsersList,
    typingText,
    isTyping: typingUsersList.length > 0,
  };
}
