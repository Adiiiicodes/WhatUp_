// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import socketClient from '@/lib/socketClient';
import { logger } from '@/lib/logger';
import { initializeE2EE, checkAndReplenishPreKeys } from '@/lib/e2ee-service';
import type { User } from '@/types/chat';

// Debug log to verify import works
console.log('[AuthContext] E2EE module imported:', typeof initializeE2EE);

// ============================================
// Types
// ============================================

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  googleAuth: (idToken: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const log = useMemo(() => logger.child({ component: 'AuthProvider' }), []);

  const clearError = useCallback(() => setError(null), []);

  // Connect socket when user is authenticated
  const connectSocket = useCallback((token: string) => {
    log.debug('Connecting socket');
    socketClient.connect(token);
  }, [log]);

  // Disconnect socket on logout
  const disconnectSocket = useCallback(() => {
    log.debug('Disconnecting socket');
    socketClient.cleanup();
    socketClient.disconnect();
  }, [log]);

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    const timer = log.time('refreshUser');
    try {
      const token = apiClient.getToken();
      if (!token) {
        log.debug('No token found, user is not authenticated');
        setUser(null);
        setIsLoading(false);
        return;
      }

      const res = await apiClient.getMe();
      if (res.success && res.data) {
        log.info({ userId: res.data._id }, 'User refreshed successfully');
        setUser(res.data);
        connectSocket(token);
        
        // Initialize E2EE when user is authenticated (handles page refresh case)
        console.log('[AuthContext] Calling initializeE2EE...');
        initializeE2EE()
          .then(() => {
            console.log('[AuthContext] E2EE initialized successfully');
            log.info('E2EE initialized on refresh');
            return checkAndReplenishPreKeys();
          })
          .catch((err) => {
            console.error('[AuthContext] E2EE initialization failed:', err);
            log.warn({ error: err }, 'E2EE initialization failed on refresh');
          });
      } else {
        // Token invalid, clear it
        log.warn('Token invalid, clearing auth state');
        apiClient.setToken(null);
        setUser(null);
        disconnectSocket();
      }
    } catch (err) {
      log.error({ error: err }, 'Failed to refresh user');
      apiClient.setToken(null);
      setUser(null);
      disconnectSocket();
    } finally {
      timer();
      setIsLoading(false);
    }
  }, [connectSocket, disconnectSocket, log]);

  // Initialize auth state on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    const timer = log.time('login');

    try {
      log.info({ email }, 'Attempting login');
      const res = await apiClient.login(email, password);

      if (res.success && res.data) {
        log.info({ email }, 'Login successful');
        await refreshUser();
        
        // Initialize E2EE in background (don't block login)
        initializeE2EE()
          .then(() => {
            log.info('E2EE initialized');
            return checkAndReplenishPreKeys();
          })
          .catch((err) => log.warn({ error: err }, 'E2EE initialization failed'));
        
        return true;
      } else {
        const errorMsg = typeof res.error === 'string' 
          ? res.error 
          : res.error?.message || 'Login failed';
        log.warn({ email, error: errorMsg }, 'Login failed');
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      log.error({ email, error: err }, 'Login error');
      setError('An error occurred during login');
      return false;
    } finally {
      timer();
      setIsLoading(false);
    }
  }, [refreshUser, log]);

  // Signup function
  const signup = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    const timer = log.time('signup');

    try {
      log.info({ email, name }, 'Attempting signup');
      const res = await apiClient.signup(email, password, name);

      if (res.success && res.data) {
        log.info({ email }, 'Signup successful');
        await refreshUser();
        
        // Initialize E2EE in background (don't block signup)
        initializeE2EE()
          .then(() => {
            log.info('E2EE initialized for new user');
            return checkAndReplenishPreKeys();
          })
          .catch((err) => log.warn({ error: err }, 'E2EE initialization failed'));
        
        return true;
      } else {
        const errorMsg = typeof res.error === 'string' 
          ? res.error 
          : res.error?.message || 'Signup failed';
        log.warn({ email, error: errorMsg }, 'Signup failed');
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      log.error({ email, error: err }, 'Signup error');
      setError('An error occurred during signup');
      return false;
    } finally {
      timer();
      setIsLoading(false);
    }
  }, [refreshUser, log]);

  // Google OAuth function
  const googleAuth = useCallback(async (idToken: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    const timer = log.time('googleAuth');

    try {
      log.info('Attempting Google authentication');
      const res = await apiClient.googleNativeAuth(idToken);

      if (res.success && res.data) {
        log.info('Google authentication successful');
        await refreshUser();
        return true;
      } else {
        const errorMsg = typeof res.error === 'string' 
          ? res.error 
          : res.error?.message || 'Google authentication failed';
        log.warn({ error: errorMsg }, 'Google authentication failed');
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      log.error({ error: err }, 'Google authentication error');
      setError('An error occurred during Google authentication');
      return false;
    } finally {
      timer();
      setIsLoading(false);
    }
  }, [refreshUser, log]);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);
    const timer = log.time('logout');

    try {
      log.info({ userId: user?._id }, 'Logging out');
      await apiClient.logout();
    } catch (err) {
      log.error({ error: err }, 'Logout error');
    } finally {
      timer();
      apiClient.setToken(null);
      disconnectSocket();
      setUser(null);
      setIsLoading(false);
      router.push('/');
    }
  }, [disconnectSocket, router, user, log]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    googleAuth,
    logout,
    refreshUser,
    error,
    clearError,
  }), [user, isLoading, login, signup, googleAuth, logout, refreshUser, error, clearError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
