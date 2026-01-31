// src/components/chat/ChatWindow.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Conversation, Message } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { ChatHeader } from './ChatHeader';
import { InputBar } from './InputBar';
import { AttachmentSheet } from './AttachmentSheet';
import { DateSeparator, isSameDay } from './DateSeparator';
import { ImageViewer } from './ImageViewer';
import apiClient from '@/lib/api';
import socketClient from '@/lib/signalingClient';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [voiceRecordingReady, setVoiceRecordingReady] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const uploadPromiseRef = useRef<Promise<void> | null>(null);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Image viewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [viewerImageInfo, setViewerImageInfo] = useState<{ fileName?: string; fileSize?: number } | null>(null);

  // Typing indicator state
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

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

  // Listen for typing indicators
  useEffect(() => {
    const unsubTyping = socketClient.onTyping((event) => {
      if (event.conversationId === conversation._id && event.userId !== currentUser._id) {
        setIsOtherUserTyping(event.isTyping);
      }
    });

    return () => {
      unsubTyping();
      // Stop typing when leaving conversation
      if (isTypingRef.current) {
        socketClient.stopTyping(conversation._id);
      }
    };
  }, [conversation._id, currentUser._id]);

  // Handle typing emission with debounce
  const handleTyping = useCallback(() => {
    // Start typing if not already
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketClient.startTyping(conversation._id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socketClient.stopTyping(conversation._id);
    }, 2000);
  }, [conversation._id]);

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
    setVoiceRecordingReady(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Emoji picker - close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Common emojis for quick picker
  const commonEmojis = [
    // Smileys
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
    '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋',
    '😜', '🤪', '😝', '🤗', '🤔', '🤭', '🤫', '🤥',
    '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤤', '😴',
    // Emotions
    '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '😵',
    '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
    '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
    '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '💀',
    // Gestures
    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤝', '👏',
    '🙌', '👐', '🤲', '🤞', '✌️', '🤟', '🤘', '👌',
    '🫶', '💪', '👋', '🙏', '✍️', '🫰', '🫵', '👆',
    // Hearts & Symbols
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘',
    '✨', '🔥', '💯', '⭐', '🌟', '💫', '🎉', '🎊',
  ];

  const insertEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
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
      console.log('[ChatWindow] Starting voice recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Prefer webm/opus, fallback to other formats
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      setVoiceRecordingReady(false);

      mediaRecorder.ondataavailable = (ev) => {
        console.log('[ChatWindow] ondataavailable:', ev.data?.size);
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[ChatWindow] MediaRecorder stopped, chunks:', recordedChunksRef.current.length);
        
        // Stop all tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        
        if (recordedChunksRef.current.length === 0) {
          console.log('[ChatWindow] No audio data recorded');
          return;
        }
        
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const file = new File([blob], `${Date.now()}_voice.webm`, { type: blob.type });
        
        console.log('[ChatWindow] Created audio file:', file.name, file.size, 'bytes');

        // Create local preview
        const preview = URL.createObjectURL(blob);
        setSelectedFile(file);
        setPreviewUrl(preview);
        setUploadedMediaType('audio');
        
        const duration = recordingSeconds;
        setUploadedMediaMetadata({ fileSize: file.size, mimeType: file.type, duration, fileName: file.name });
        setVoiceRecordingReady(true);

        // Start upload in background
        uploadMedia(file, 'voice').catch((err) => {
          console.error('[ChatWindow] Background upload failed', err);
        });
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // Request data every second to ensure we capture audio
      mediaRecorder.start(1000);
      
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000) as unknown as number;
      
      console.log('[ChatWindow] Recording started successfully');
    } catch (err) {
      console.error('[ChatWindow] startRecording failed', err);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    console.log('[ChatWindow] Stopping recording...');
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      // Request any remaining data before stopping
      if (mr.state === 'recording') {
        mr.requestData();
      }
      mr.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    console.log('[ChatWindow] Recording stopped');
  };

  const cancelRecording = () => {
    console.log('[ChatWindow] Canceling recording...');
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try {
        // Clear chunks before stopping to prevent onstop from processing
        recordedChunksRef.current = [];
        mr.stop();
      } catch (e) {
        console.log('[ChatWindow] cancelRecording stop error', e);
      }
    }
    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    recordedChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
    setVoiceRecordingReady(false);
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

  // Image viewer handlers
  const handleImageClick = (imageUrl: string, metadata?: { fileName?: string; fileSize?: number }) => {
    setViewerImageUrl(imageUrl);
    setViewerImageInfo(metadata || null);
    setImageViewerOpen(true);
  };

  const handleCloseImageViewer = () => {
    setImageViewerOpen(false);
    setViewerImageUrl(null);
    setViewerImageInfo(null);
  };

  // Attachment menu handlers
  const handleAttachPhoto = () => {
    triggerFileInput('image/*', 'image');
    setShowAttachMenu(false);
  };

  const handleAttachDocument = () => {
    triggerFileInput('.pdf,.doc,.docx,.txt,.xls,.xlsx', 'document');
    setShowAttachMenu(false);
  };

  const handleAttachCamera = () => {
    triggerFileInput('image/*;capture=camera', 'image');
    setShowAttachMenu(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] h-screen">
      {/* Chat Header */}
      <ChatHeader
        user={otherUser}
        isTyping={isOtherUserTyping}
        onBackPress={onBack}
      />

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 bg-[var(--bg-primary)] scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)] animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <p className="font-medium">No messages yet</p>
            <p className="text-sm mt-1">Say hello to start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const key = idOf(message._id || (message as unknown as Record<string, unknown>).id);
            const senderId = idOf((message as Message).senderId);
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const currentDate = new Date(message.createdAt || message.timestamp || Date.now());
            const prevDate = prevMessage ? new Date(prevMessage.createdAt || prevMessage.timestamp || Date.now()) : null;
            const showDateSeparator = !prevDate || !isSameDay(currentDate, prevDate);
            
            return (
              <div key={key || Math.random().toString(36).slice(2)}>
                {showDateSeparator && <DateSeparator date={currentDate} />}
                <MessageBubble
                  message={message}
                  isOwn={senderId === idOf(currentUser._id)}
                  onImageClick={(url) => handleImageClick(url, message.mediaMetadata)}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Sheet */}
      <AttachmentSheet
        isOpen={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onPickImage={handleAttachPhoto}
        onPickDocument={handleAttachDocument}
        onTakePhoto={handleAttachCamera}
      />

      {/* Media Preview & Upload Progress */}
      {(previewUrl || uploading || isRecording) && (
        <div className="px-3 sm:px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)]">
          {isRecording ? (
            <div className="flex items-center gap-4 bg-[var(--bg-tertiary)] p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-[recordingPulse_1.5s_ease-in-out_infinite]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  </svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  Done
                </button>
                <button
                  onClick={cancelRecording}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm flex items-center gap-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  Cancel
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      </svg>
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
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500 flex-shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
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

      {/* Input Area with Emoji Picker */}
      <div className="relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full mb-2 left-4 right-4 sm:left-auto sm:right-auto sm:w-[320px] bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Emojis</span>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                aria-label="Close emoji picker"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            {/* Emoji grid */}
            <div className="p-3 max-h-[200px] overflow-y-auto">
              <div className="grid grid-cols-8 gap-1">
                {commonEmojis.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => insertEmoji(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-2xl hover:bg-[var(--bg-hover)] rounded-lg transition-all hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Input */}
        <InputBar
          value={newMessage}
          onChangeText={(text) => {
            setNewMessage(text);
            if (text.trim()) {
              handleTyping();
            }
          }}
          onSend={() => { handleSendMessage({ preventDefault: () => {} } as React.FormEvent); }}
          onAttachPress={() => setShowAttachMenu(true)}
          onMicPressIn={startRecording}
          onMicPressOut={stopRecording}
          onEmojiPress={() => setShowEmojiPicker(!showEmojiPicker)}
          isSending={loading}
          isRecording={isRecording}
          hasMedia={!!selectedFile || !!uploadedMediaUrl || !!previewUrl || voiceRecordingReady}
          disabled={loading || uploading}
          placeholder={uploadedMediaUrl ? 'Add a caption (optional)' : 'Type a message...'}
        />
      </div>

      {/* Image Viewer Modal */}
      <ImageViewer
        src={viewerImageUrl || ''}
        isOpen={imageViewerOpen}
        fileName={viewerImageInfo?.fileName}
        fileSize={viewerImageInfo?.fileSize}
        onClose={handleCloseImageViewer}
      />

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
}