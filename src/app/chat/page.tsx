// src/app/chat/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { User, Conversation } from '@/types/chat';
import apiClient from '@/lib/api';

function ChatPageContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiClient.getMe();
      if (res.success && res.data) {
        setCurrentUser(res.data);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent-primary)] mx-auto"></div>
          <p className="text-[var(--text-primary)] mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Hidden on mobile when conversation is selected */}
      <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto`}>
        <ChatSidebar
          currentUser={currentUser}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
        />
      </div>

      {/* Chat Window - Full screen on mobile */}
      <div className={`${selectedConversation ? 'flex' : 'hidden lg:flex'} flex-1`}>
        {selectedConversation ? (
          <ChatWindow
            currentUser={currentUser}
            conversation={selectedConversation}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="text-center text-[var(--text-tertiary)]">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                <svg
                  className="w-16 h-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                WhatUp Chat
              </h2>
              <p className="text-lg mb-4">Select a chat to start messaging</p>
              <p className="text-sm">
                Send and receive messages, images, documents, and voice notes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatPageContent />
    </ProtectedRoute>
  );
}