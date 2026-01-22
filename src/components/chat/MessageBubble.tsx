// src/components/chat/MessageBubble.tsx
import { Message } from '@/types/chat';
import { Download, FileText, Mic, ChevronDown, Trash2, Play, Pause } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/api';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  conversationId?: string;
}

export function MessageBubble({ message, isOwn, conversationId }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleDelete = async () => {
    setShowMenu(false);
    if (!confirm('Delete this message for everyone?')) return;
    if (!conversationId) {
      alert('Cannot delete: conversation ID missing');
      return;
    }
    try {
      const res = await apiClient.deleteMessage(message._id, conversationId);
      if (res.success) {
        window.dispatchEvent(new CustomEvent('message:deleted', { detail: { id: message._id } }));
        window.dispatchEvent(new CustomEvent('conversations:refresh'));
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to delete message';
        alert(errorMsg);
      }
    } catch (e) {
      console.error('Delete error', e);
      alert('Delete failed');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap text-sm sm:text-base">
            {message.content}
          </p>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <div className="relative rounded-lg overflow-hidden max-w-sm">
              <img
                src={message.fileUrl}
                alt={message.fileName || 'Image'}
                className="max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.fileUrl, '_blank')}
              />
            </div>
            {message.content && (
              <p className="text-[var(--text-primary)] break-words text-sm sm:text-base">
                {message.content}
              </p>
            )}
          </div>
        );

      case 'document':
        // Check if it's a video based on mime type or file extension
        const isVideo = message.fileName?.match(/\.(mp4|webm|mov|avi)$/i) ||
                        (message.fileSize && message.fileName?.includes('video'));

        if (isVideo) {
          return (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden max-w-sm bg-black">
                <video
                  src={message.fileUrl}
                  controls
                  className="max-w-full max-h-[300px]"
                />
              </div>
              {message.content && (
                <p className="text-[var(--text-primary)] break-words text-sm sm:text-base">
                  {message.content}
                </p>
              )}
            </div>
          );
        }

        // Regular document
        return (
          <a
            href={message.fileUrl}
            download={message.fileName}
            className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-[var(--bg-hover)] rounded-lg hover:opacity-80 transition-opacity touch-manipulation"
          >
            <FileText size={20} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[var(--text-primary)] font-medium truncate text-sm">
                {message.fileName}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                {message.fileSize && formatFileSize(message.fileSize)}
              </div>
            </div>
            <Download size={18} className="text-[var(--icon-primary)] flex-shrink-0" />
          </a>
        );

      case 'voice':
        return (
          <div className="flex items-center space-x-3 p-3 bg-[var(--bg-hover)] rounded-lg min-w-[200px]">
            <audio
              ref={audioRef}
              src={message.fileUrl}
              onEnded={handleAudioEnded}
              className="hidden"
            />
            <button
              onClick={toggleAudio}
              className="w-10 h-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              {/* Waveform visualization */}
              <div className="flex items-center gap-0.5 h-8 mb-1">
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-[var(--accent-primary)] rounded-full opacity-60"
                    style={{ height: `${Math.random() * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>{formatDuration(message.duration)}</span>
                <span>{formatFileSize(message.fileSize)}</span>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <div className="relative rounded-lg overflow-hidden max-w-sm bg-black">
              <video
                src={message.fileUrl}
                controls
                className="max-w-full max-h-[300px]"
              />
              {message.duration && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {formatDuration(message.duration)}
                </div>
              )}
            </div>
            {message.content && (
              <p className="text-[var(--text-primary)] break-words text-sm sm:text-base">
                {message.content}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
      <div className="relative flex items-start gap-1">
        <div
          className={`max-w-[85%] sm:max-w-[75%] md:max-w-md px-3 py-2 sm:px-4 sm:py-2 rounded-lg ${
            isOwn ? 'message-sent' : 'message-received'
          }`}
        >
          {renderContent()}
          <div className={`text-xs mt-1 flex items-center justify-between gap-2 ${
            isOwn ? 'text-[var(--text-primary)]/70' : 'text-[var(--text-secondary)]'
          }`}>
            <span>
              {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isOwn && (
              <span className="flex items-center ml-1">
                <svg
                  width="16"
                  height="15"
                  viewBox="0 0 16 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={message.isRead ? 'text-[var(--tick-read)]' : 'text-[var(--tick-unread)]'}
                >
                  <path
                    d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.54l1.32 1.266a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            )}
          </div>
        </div>

        {isOwn && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[var(--bg-hover)] rounded-full touch-manipulation"
              aria-label="message options"
            >
              <ChevronDown size={16} className="text-[var(--text-secondary)]" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl min-w-[180px] py-1 z-50">
                <button 
                  onClick={handleDelete} 
                  className="flex items-center space-x-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-[var(--bg-hover)] transition-colors touch-manipulation"
                >
                  <Trash2 size={16} />
                  <span>Delete for everyone</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}