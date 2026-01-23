'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api';

export function OAuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // Set the token in the API client
      apiClient.setToken(token);
      
      // Clean up the URL and redirect to chat
      router.replace('/chat');
    } else if (error) {
      // Show error message and redirect to home
      alert(`Authentication failed: ${error}`);
      router.replace('/');
    }
  }, [router, searchParams]);

  // Show loading while processing
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent-primary)] mx-auto"></div>
        <p className="text-[var(--text-primary)] mt-4">Completing authentication...</p>
      </div>
    </div>
  );
}