// src/components/chat/ChatWindow.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Conversation, Message } from '@/types/chat';
import { Send, Paperclip, Smile, MoreVertical, Image, FileText, Mic, ArrowLeft } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import dynamic from 'next/dynamic';
import type { EmojiClickData } from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import apiClient from '@/lib/api';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface ChatWindowProps {
  currentUser: User;
  conversation: Conversation;
  onBack?: () => void;
}

export function ChatWindow({ currentUser, conversation, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const previousMessagesLengthRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Helper to extract id from a string, Object-like, or other value
  const idOf = (v: unknown): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if ('_id' in obj && obj._id != null) return String(obj._id);
      if ('id' in obj && obj.id != null) return String(obj.id);
      if (typeof obj.toString === 'function') return String(obj.toString());
    }
    return String(v);
  };

  // Determine the other participant; participants can be strings (ids) or populated User objects
  const otherParticipant = conversation.participants.find((p) => idOf(p) !== idOf(currentUser._id));
  const otherUser: User = typeof otherParticipant === 'string' || otherParticipant == null
    ? {
        _id: typeof otherParticipant === 'string' ? otherParticipant : '',
        email: '',
        name: 'Unknown',
        status: 'offline',
        createdAt: new Date(),
      }
    : otherParticipant;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.getMessages(conversation._id);

      if (res.success && res.data) {
        setMessages(res.data);
      } else if (res.error) {
        console.warn('Error fetching messages:', res.error);
        // If conversation doesn't exist anymore, stop polling
        setMessages([]);
        window.dispatchEvent(new CustomEvent('conversations:refresh'));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [conversation._id]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Listen for message deletion events (triggered by MessageBubble)
  useEffect(() => {
    const handler = (e: Event) => {
      // refresh messages when a message is deleted
      fetchMessages();
    };
    window.addEventListener('message:deleted', handler as EventListener);
    return () => window.removeEventListener('message:deleted', handler as EventListener);
  }, [fetchMessages]);

  // Smart scroll: only auto-scroll if user is near bottom or sent a new message
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = () => {
      const threshold = 150; // pixels from bottom
      const position = container.scrollHeight - container.scrollTop - container.clientHeight;
      return position < threshold;
    };

    // Auto-scroll if: user sent a message (messages increased) AND (was near bottom OR first load)
    const messagesIncreased = messages.length > previousMessagesLengthRef.current;
    
    if (messagesIncreased) {
      if (shouldAutoScrollRef.current || isNearBottom()) {
        scrollToBottom();
      }
      previousMessagesLengthRef.current = messages.length;
      // Reset the flag after first auto-scroll
      shouldAutoScrollRef.current = false;
    }
  }, [messages]);

  // Track scroll position to enable/disable auto-scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 150;
      const position = container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldAutoScrollRef.current = position < threshold;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // fetchMessages is defined above with useCallback

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    try {
      const res = await apiClient.sendMessage({
        conversationId: conversation._id,
        receiverId: otherUser._id,
        content: newMessage,
        type: 'text',
      });

      if (res.success && res.data) {
        setMessages([...messages, res.data]);
        setNewMessage('');
        // Force scroll to bottom when user sends a message
        shouldAutoScrollRef.current = true;
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'voice') => {
    if (!file) return;

    setUploading(true);
    setShowAttachMenu(false);

    try {
      const res = await apiClient.uploadFile(file, conversation._id, otherUser._id, type);
      if (res.success && res.data) {
        setMessages([...messages, res.data]);
        // Force scroll to bottom when user uploads a file
        shouldAutoScrollRef.current = true;
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = (accept: string, type: 'image' | 'document' | 'voice') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          handleFileUpload(file, type);
        }
      };
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] h-screen">
      {/* Chat Header */}
      <div className="bg-[var(--bg-tertiary)] p-3 sm:p-4 flex items-center justify-between border-b border-[var(--border-primary)]">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors flex-shrink-0"
              aria-label="Back to chats"
            >
              <ArrowLeft size={20} className="text-[var(--icon-primary)]" />
            </button>
          )}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-semibold">
              {otherUser?.name ? otherUser.name.charAt(0).toUpperCase() : '?'}
            </div>
            {otherUser?.status === 'online' && (
              <div className="status-online absolute bottom-0 right-0"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[var(--text-primary)] font-medium truncate">
              {otherUser?.name ?? 'Unknown'}
            </div>
            <div className="text-xs text-[var(--text-secondary)] truncate">
              {otherUser?.status === 'online' ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors flex-shrink-0">
          <MoreVertical size={20} className="text-[var(--icon-primary)]" />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin bg-[url('/chat-bg.png')] bg-repeat"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[var(--text-tertiary)]">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const key = idOf(message._id || (message as unknown as Record<string, unknown>).id);
            const senderId = idOf((message as Message).senderId);
            return (
              <MessageBubble
                key={key || Math.random().toString(36).slice(2)}
                message={message}
                isOwn={senderId === idOf(currentUser._id)}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)]">
          <div className="flex items-center space-x-2 text-[var(--text-secondary)]">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--accent-primary)]"></div>
            <span className="text-xs sm:text-sm">Uploading...</span>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-[var(--bg-tertiary)] p-2 sm:p-4 border-t border-[var(--border-primary)]">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-1 sm:space-x-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors touch-manipulation"
              aria-label="Attach file"
            >
              <Paperclip size={20} className="text-[var(--icon-primary)]" />
            </button>
            
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-primary)] p-2 space-y-1 min-w-[160px]">
                <button
                  type="button"
                  onClick={() => triggerFileInput('image/*', 'image')}
                  className="flex items-center space-x-2 sm:space-x-3 w-full px-3 sm:px-4 py-2.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-primary)] touch-manipulation"
                >
                  <Image size={20} className="text-[var(--icon-secondary)] flex-shrink-0" />
                  <span className="text-sm sm:text-base">Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileInput('.pdf,.doc,.docx,.txt', 'document')}
                  className="flex items-center space-x-2 sm:space-x-3 w-full px-3 sm:px-4 py-2.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-primary)] touch-manipulation"
                >
                  <FileText size={20} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileInput('audio/*', 'voice')}
                  className="flex items-center space-x-2 sm:space-x-3 w-full px-3 sm:px-4 py-2.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-primary)] touch-manipulation"
                >
                  <Mic size={20} className="text-red-500 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Audio</span>
                </button>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
          />

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message"
            className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-sm sm:text-base"
            disabled={loading || uploading}
          />

          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors touch-manipulation"
              aria-label="Add emoji"
            >
              <Smile size={20} className="text-[var(--icon-primary)]" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={Theme.DARK}
                  width={300}
                  height={400}
                  searchPlaceHolder="Search emoji"
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || loading || uploading}
            className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            aria-label="Send message"
          >
            <Send size={20} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}