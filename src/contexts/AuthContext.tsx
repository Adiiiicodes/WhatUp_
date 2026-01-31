// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import socketClient from '@/lib/signalingClient';
import type { User } from '@/types/chat';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clearError = useCallback(() => setError(null), []);

  // Connect socket when user is authenticated
  const connectSocket = useCallback((token: string) => {
    socketClient.connect(token);
  }, []);

  // Disconnect socket on logout
  const disconnectSocket = useCallback(() => {
    socketClient.cleanup();
    socketClient.disconnect();
  }, []);

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    try {
      const token = apiClient.getToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const res = await apiClient.getMe();
      if (res.success && res.data) {
        setUser(res.data);
        connectSocket(token);
      } else {
        // Token invalid, clear it
        apiClient.setToken(null);
        setUser(null);
        disconnectSocket();
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
      apiClient.setToken(null);
      setUser(null);
      disconnectSocket();
    } finally {
      setIsLoading(false);
    }
  }, [connectSocket, disconnectSocket]);

  // Initialize auth state on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiClient.login(email, password);

      if (res.success && res.data) {
        await refreshUser();
        return true;
      } else {
        const errorMsg = typeof res.error === 'string' 
          ? res.error 
          : res.error?.message || 'Login failed';
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      setError('An error occurred during login');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  // Signup function
  const signup = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiClient.signup(email, password, name);

      if (res.success && res.data) {
        await refreshUser();
        return true;
      } else {
        const errorMsg = typeof res.error === 'string' 
          ? res.error 
          : res.error?.message || 'Signup failed';
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      setError('An error occurred during signup');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  // Google OAuth function
  const googleAuth = useCallback(async (idToken: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiClient.googleNativeAuth(idToken);

      if (res.success && res.data) {
        await refreshUser();
        return true;
      } else {
        const errorMsg = typeof res.error === 'string' 
          ? res.error 
          : res.error?.message || 'Google authentication failed';
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      setError('An error occurred during Google authentication');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await apiClient.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      apiClient.setToken(null);
      disconnectSocket();
      setUser(null);
      setIsLoading(false);
      router.push('/');
    }
  }, [disconnectSocket, router]);

  const value: AuthContextType = {
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
