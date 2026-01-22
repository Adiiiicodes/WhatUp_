// src/components/chat/ChatWindow.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Conversation, Message } from '@/types/chat';
import { Send, Paperclip, Smile, MoreVertical, Image, FileText, Mic, ArrowLeft, X, Play, Square } from 'lucide-react';
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const previousMessagesLengthRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);

  // Media upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<'image' | 'video' | 'audio' | 'file' | null>(null);
  const [uploadedMediaMetadata, setUploadedMediaMetadata] = useState<Record<string, unknown> | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const uploadPromiseRef = useRef<Promise<void> | null>(null);

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
    const handler = () => {
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
    if ((!newMessage.trim() && !uploadedMediaUrl && !selectedFile) || loading) return;

    setLoading(true);
    try {
      // If there's a selected file but not yet uploaded, wait for upload
      if (!uploadedMediaUrl && selectedFile) {
        if (uploadPromiseRef.current) {
          await uploadPromiseRef.current;
        } else {
          await uploadMedia(selectedFile);
        }
      }

      // Determine message type
      let messageType: 'text' | 'image' | 'document' | 'voice' = 'text';
      if (uploadedMediaType === 'image') messageType = 'image';
      else if (uploadedMediaType === 'audio') messageType = 'voice';
      else if (uploadedMediaType === 'video' || uploadedMediaType === 'file') messageType = 'document';

      // Build media metadata object
      let mediaMetadataPayload: {
        fileName: string;
        fileSize: number;
        mimeType: string;
        path: string;
        width?: number;
        height?: number;
        duration?: number;
      } | undefined;

      if (uploadedMediaMetadata) {
        mediaMetadataPayload = {
          fileName: (uploadedMediaMetadata.fileName as string) || '',
          fileSize: (uploadedMediaMetadata.fileSize as number) || 0,
          mimeType: (uploadedMediaMetadata.mimeType as string) || '',
          path: (uploadedMediaMetadata.path as string) || '',
        };
        if (uploadedMediaMetadata.width) {
          mediaMetadataPayload.width = uploadedMediaMetadata.width as number;
        }
        if (uploadedMediaMetadata.height) {
          mediaMetadataPayload.height = uploadedMediaMetadata.height as number;
        }
        if (uploadedMediaMetadata.duration) {
          mediaMetadataPayload.duration = uploadedMediaMetadata.duration as number;
        }
      }

      const res = await apiClient.sendMessage({
        conversationId: conversation._id,
        receiverId: otherUser._id,
        content: newMessage || '', // Caption for media or text content
        type: messageType,
        mediaUrl: uploadedMediaUrl || undefined,
        mediaMetadata: mediaMetadataPayload,
      });

      if (res.success && res.data) {
        setMessages([...messages, res.data]);
        setNewMessage('');
        // Clear media state
        handleCancelUpload();
        // Force scroll to bottom
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

    // Set selected file and create preview
    setSelectedFile(file);
    setShowAttachMenu(false);

    // Create preview URL for images/videos/audio
    const fileType = file.type.split('/')[0];
    if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    }

    // Start upload process
    await uploadMedia(file, type);
  };

  // Upload media using presigned URL
  const uploadMedia = async (file: File, type?: 'image' | 'document' | 'voice') => {
    setUploading(true);
    setUploadProgress(0);

    const uploadPromise = (async () => {
      try {
        // Step 1: Get signed URL from backend
        const urlRes = await apiClient.getUploadUrl(file.name, conversation._id);
        if (!urlRes.success || !urlRes.data) {
          throw new Error('Failed to get upload URL');
        }

        const { signedUrl, path, publicUrl } = urlRes.data;

        // Step 2: Upload file directly to Supabase
        const uploadResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }

        // Step 3: Determine media type
        const fileCategory = file.type.split('/')[0];
        let mediaType: 'image' | 'video' | 'audio' | 'file' = 'file';
        if (type === 'image' || fileCategory === 'image') mediaType = 'image';
        else if (fileCategory === 'video') mediaType = 'video';
        else if (type === 'voice' || fileCategory === 'audio') mediaType = 'audio';

        // Step 4: Get metadata
        const metadata: Record<string, unknown> = {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          path,
        };

        // Get dimensions for images
        if (mediaType === 'image') {
          const dimensions = await getImageDimensions(file);
          metadata.width = dimensions.width;
          metadata.height = dimensions.height;
        }

        // Get duration for videos
        if (mediaType === 'video') {
          const duration = await getVideoDuration(file);
          metadata.duration = duration;
        }

        // Get duration for audio
        if (mediaType === 'audio') {
          const duration = await getAudioDuration(file);
          metadata.duration = duration;
        }

        // Step 5: Store media info for sending
        setUploadedMediaUrl(publicUrl);
        setUploadedMediaType(mediaType);
        setUploadedMediaMetadata(metadata);
        setUploadProgress(100);

        console.log('[ChatWindow] Media uploaded:', { url: publicUrl, type: mediaType, metadata });
      } catch (error) {
        console.error('[ChatWindow] Upload failed:', error);
        alert('Failed to upload file. Please try again.');
        handleCancelUpload();
      } finally {
        setUploading(false);
        uploadPromiseRef.current = null;
      }
    })();

    uploadPromiseRef.current = uploadPromise;
    return uploadPromise;
  };

  // Helper: Get image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // Helper: Get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(Math.floor(video.duration));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // Helper: Get audio duration
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.onloadedmetadata = () => {
        resolve(Math.floor(audio.duration));
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  // Cancel upload
  const handleCancelUpload = () => {
    setSelectedFile(null);
    setUploadedMediaUrl(null);
    setUploadedMediaType(null);
    setUploadedMediaMetadata(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `${Date.now()}_voice.webm`, { type: blob.type });
        stream.getTracks().forEach((t) => t.stop());

        // Create local preview
        const preview = URL.createObjectURL(blob);
        setSelectedFile(file);
        setPreviewUrl(preview);
        setUploadedMediaType('audio');
        const duration = await getAudioDuration(file);
        setUploadedMediaMetadata({ fileSize: file.size, mimeType: file.type, duration, fileName: file.name });

        // Start upload in background
        uploadMedia(file, 'voice').catch((err) => {
          console.error('[ChatWindow] Background upload failed', err);
        });
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000) as unknown as number;
    } catch (err) {
      console.error('[ChatWindow] startRecording failed', err);
      alert('Unable to access microphone.');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop();
      } catch (e) {
        console.log('[ChatWindow] cancelRecording stop error', e);
      }
    }
    recordedChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
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

      {/* Media Preview & Upload Progress */}
      {(previewUrl || uploading || isRecording) && (
        <div className="px-3 sm:px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)]">
          {isRecording ? (
            <div className="flex items-center gap-4 bg-[var(--bg-tertiary)] p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <Mic size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-[var(--text-primary)] font-medium">
                    {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:
                    {(recordingSeconds % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">Recording...</div>
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={stopRecording}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-white text-sm flex items-center gap-1"
                >
                  <Square size={14} /> Done
                </button>
                <button
                  onClick={cancelRecording}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm flex items-center gap-1"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            previewUrl && (
              <div className="relative inline-block">
                {/* Image Preview */}
                {uploadedMediaType === 'image' && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-32 rounded-lg object-contain"
                  />
                )}
                {/* Video Preview */}
                {uploadedMediaType === 'video' && (
                  <video
                    src={previewUrl}
                    className="max-h-32 rounded-lg"
                    controls
                  />
                )}
                {/* Audio Preview */}
                {uploadedMediaType === 'audio' && (
                  <div className="w-full bg-[var(--bg-tertiary)] p-3 rounded-lg flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--accent-primary)] rounded-full flex items-center justify-center">
                      <Mic size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-[var(--text-primary)] truncate font-medium">
                          {selectedFile?.name || 'voice.webm'}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] ml-2">
                          • {formatFileSize(selectedFile?.size)}
                        </div>
                      </div>
                      <div className="mt-2">
                        <audio src={previewUrl} controls className="w-full h-8" />
                      </div>
                    </div>
                  </div>
                )}
                {/* File Preview */}
                {uploadedMediaType === 'file' && (
                  <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                    <FileText size={28} className="text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[var(--text-primary)] truncate">{selectedFile?.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {formatFileSize(selectedFile?.size)}
                      </div>
                    </div>
                  </div>
                )}
                {/* Cancel Button */}
                <button
                  onClick={handleCancelUpload}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition"
                >
                  <X size={12} />
                </button>
              </div>
            )
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--accent-primary)]"></div>
                <span>Uploading {selectedFile?.name}...</span>
              </div>
              <div className="w-full bg-[var(--bg-hover)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
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
                  onClick={() => triggerFileInput('video/*', 'document')}
                  className="flex items-center space-x-2 sm:space-x-3 w-full px-3 sm:px-4 py-2.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-primary)] touch-manipulation"
                >
                  <Play size={20} className="text-purple-500 flex-shrink-0" />
                  <span className="text-sm sm:text-base">Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileInput('.pdf,.doc,.docx,.txt,.xls,.xlsx', 'document')}
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
                  <span className="text-sm sm:text-base">Audio File</span>
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
            disabled={(!newMessage.trim() && !uploadedMediaUrl && !selectedFile) || loading || uploading}
            className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            aria-label="Send message"
          >
            <Send size={20} className="text-white" />
          </button>
        </form>

        {/* Voice Record Button - shows when no text/media */}
        {!newMessage.trim() && !uploadedMediaUrl && !selectedFile && !isRecording && (
          <button
            type="button"
            onClick={startRecording}
            className="ml-2 p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors touch-manipulation"
            aria-label="Record voice message"
          >
            <Mic size={20} className="text-[var(--icon-primary)]" />
          </button>
        )}
      </div>
    </div>
  );
}