/**
 * @fileoverview Socket Context Provider for global socket state management
 * 
 * Features:
 * - Global socket connection state
 * - Automatic connection on auth
 * - Connection status indicators
 * - Event subscription management
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import socketClient, { 
  ConnectionState,
  NewMessageEvent,
  UpdatedMessageEvent,
  DeletedMessageEvent,
  TypingEvent,
  UserStatusEvent,
} from '@/lib/socketClient';
import { useAuth } from './AuthContext';
import { logger } from '@/lib/logger';

// ============================================
// Types
// ============================================

interface SocketContextType {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  
  // Actions
  reconnect: () => void;
  disconnect: () => void;
  
  // Event subscriptions
  onNewMessage: (handler: (event: NewMessageEvent) => void) => () => void;
  onMessageUpdated: (handler: (event: UpdatedMessageEvent) => void) => () => void;
  onMessageDeleted: (handler: (event: DeletedMessageEvent) => void) => () => void;
  onTyping: (handler: (event: TypingEvent) => void) => () => void;
  onUserStatus: (handler: (event: UserStatusEvent) => void) => () => void;
  
  // Room management
  joinConversation: (conversationId: string) => Promise<boolean>;
  leaveConversation: (conversationId: string) => Promise<boolean>;
  
  // Typing indicators
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  
  // Offline queue info
  offlineQueueSize: number;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  
  const log = useMemo(() => logger.child({ component: 'SocketProvider' }), []);

  // Track offline queue size
  useEffect(() => {
    const interval = setInterval(() => {
      setOfflineQueueSize(socketClient.offlineQueueSize);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = socketClient.onConnectionStateChange((state) => {
      setConnectionState(state);
      log.info({ state }, 'Socket connection state changed');
    });
    return unsubscribe;
  }, [log]);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        log.info({ userId: user._id }, 'Connecting socket for authenticated user');
        socketClient.connect(token);
      }
    } else {
      log.info('Disconnecting socket - user not authenticated');
      socketClient.disconnect();
    }

    return () => {
      // Don't disconnect on unmount if still authenticated
      // This allows the socket to persist across page navigations
    };
  }, [isAuthenticated, user, log]);

  // Reconnect function
  const reconnect = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      log.info('Manual reconnection requested');
      socketClient.disconnect();
      socketClient.connect(token);
    }
  }, [log]);

  // Disconnect function
  const disconnect = useCallback(() => {
    log.info('Manual disconnect requested');
    socketClient.disconnect();
  }, [log]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<SocketContextType>(() => ({
    // Connection state
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isReconnecting: connectionState === 'reconnecting',
    
    // Actions
    reconnect,
    disconnect,
    
    // Event subscriptions - delegate to socket client
    onNewMessage: socketClient.onNewMessage.bind(socketClient),
    onMessageUpdated: socketClient.onMessageUpdated.bind(socketClient),
    onMessageDeleted: socketClient.onMessageDeleted.bind(socketClient),
    onTyping: socketClient.onTyping.bind(socketClient),
    onUserStatus: socketClient.onUserStatus.bind(socketClient),
    
    // Room management
    joinConversation: socketClient.joinConversation.bind(socketClient),
    leaveConversation: socketClient.leaveConversation.bind(socketClient),
    
    // Typing indicators
    startTyping: socketClient.startTyping.bind(socketClient),
    stopTyping: socketClient.stopTyping.bind(socketClient),
    
    // Offline queue info
    offlineQueueSize,
  }), [connectionState, reconnect, disconnect, offlineQueueSize]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// ============================================
// Connection Status Component
// ============================================

interface ConnectionStatusProps {
  className?: string;
  showText?: boolean;
}

export function ConnectionStatus({ className = '', showText = true }: ConnectionStatusProps) {
  const { connectionState, isConnected, reconnect } = useSocket();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500 animate-pulse';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      {showText && (
        <span className="text-xs text-[var(--text-secondary)]">
          {getStatusText()}
        </span>
      )}
      {!isConnected && connectionState === 'disconnected' && (
        <button
          onClick={reconnect}
          className="text-xs text-[var(--accent-primary)] hover:underline"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

// ============================================
// Offline Queue Indicator
// ============================================

interface OfflineQueueIndicatorProps {
  className?: string;
}

export function OfflineQueueIndicator({ className = '' }: OfflineQueueIndicatorProps) {
  const { offlineQueueSize, isConnected } = useSocket();

  if (offlineQueueSize === 0 || isConnected) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg ${className}`}>
      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      <span className="text-xs text-yellow-600">
        {offlineQueueSize} message{offlineQueueSize !== 1 ? 's' : ''} pending
      </span>
    </div>
  );
}
