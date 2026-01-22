// src/components/chat/MessageBubble.tsx
import { Message } from '@/types/chat';
import { Download, FileText, Mic, ChevronDown, Trash2, Play, Pause, CheckCheck, Check, MoreVertical } from 'lucide-react';
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
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 group px-1 py-0.5`}>
      <div className={`relative flex items-end max-w-[85%] sm:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row gap-2'}`}>

        {/* Message Bubble */}
        <div
          className={`relative px-3 py-2 shadow-sm border ${
            isOwn 
              ? 'bg-[var(--accent-primary)] text-white rounded-2xl rounded-tr-sm border-[var(--accent-primary)]' 
              : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl rounded-tl-sm border-[var(--border-primary)]'
          }`}
        >
          {renderContent()}

          <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 select-none ${
            isOwn ? 'text-white/70' : 'text-[var(--text-secondary)]'
          }`}>
            <span>
              {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isOwn && (
              <span className={message.isRead ? 'text-blue-200' : 'text-white/60'}>
                 <CheckCheck size={14} strokeWidth={1.5} />
              </span>
            )}
          </div>
        </div>

        {/* Action Menu (Only for own messages for now, or could handle delete for others locally if allowed) */}
        <div className={`relative mb-2 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'mr-1' : 'ml-1'}`} ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-[var(--text-secondary)]"
            aria-label="message options"
          >
            <MoreVertical size={14} />
          </button>
            {showMenu && (
            <div className={`absolute bottom-full mb-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg min-w-[140px] py-1 z-50 overflow-hidden text-left ${isOwn ? 'right-0' : 'left-0'}`}>
              {isOwn && (
                <button
                  onClick={handleDelete} 
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}
               {/* Add more options like copy, reply here later */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}