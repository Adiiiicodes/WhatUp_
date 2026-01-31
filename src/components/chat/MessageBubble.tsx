// src/components/chat/MessageBubble.tsx
import { Message } from '@/types/chat';
import { Download, FileText, Trash2, CheckCheck, Check, MoreVertical, Copy, Reply, Forward } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/api';
import { VoiceMessageBubble } from './VoiceMessageBubble';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  conversationId?: string;
  onImageClick?: (src: string, fileName?: string, fileSize?: number) => void;
  onReply?: (message: Message) => void;
}

export function MessageBubble({ message, isOwn, conversationId, onImageClick, onReply }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showTimestamp, setShowTimestamp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showMenu || showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu, showContextMenu]);

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    setShowMenu(false);
  };

  // Copy message content to clipboard
  const handleCopy = async () => {
    setShowMenu(false);
    setShowContextMenu(false);
    try {
      await navigator.clipboard.writeText(message.content || '');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle reply
  const handleReply = () => {
    setShowMenu(false);
    setShowContextMenu(false);
    onReply?.(message);
  };

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
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get the media URL from either fileUrl or mediaUrl
  const getMediaUrl = () => {
    return message.fileUrl || message.mediaUrl || '';
  };

  // Get duration from message or mediaMetadata
  const getDuration = () => {
    return message.duration || message.mediaMetadata?.duration || 0;
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
        const imageUrl = getMediaUrl();
        return (
          <div className="space-y-2">
            <div className="relative rounded-lg overflow-hidden max-w-sm">
              <img
                src={imageUrl}
                alt={message.fileName || message.mediaMetadata?.fileName || 'Image'}
                className="max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(imageUrl, message.fileName || message.mediaMetadata?.fileName, message.fileSize || message.mediaMetadata?.fileSize)}
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
        const voiceUrl = getMediaUrl();
        return (
          <VoiceMessageBubble
            audioUrl={voiceUrl}
            duration={getDuration()}
            isMyMessage={isOwn}
          />
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
          onContextMenu={handleContextMenu}
          onClick={() => setShowTimestamp(!showTimestamp)}
          className={`relative px-3 py-2 shadow-sm border cursor-pointer select-none ${
            isOwn 
              ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[#006a5c] text-white rounded-2xl rounded-tr-sm border-[var(--accent-primary)]' 
              : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl rounded-tl-sm border-[var(--border-primary)]'
          }`}
        >
          {/* Edited indicator */}
          {message.isEdited && (
            <span className="text-[10px] text-[var(--text-secondary)] italic mr-1">(edited)</span>
          )}
          
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
              <span className={message.isRead ? 'text-[var(--tick-read)]' : 'text-white/60'}>
                {message.isRead ? (
                  <CheckCheck size={14} strokeWidth={2} />
                ) : (
                  <Check size={14} strokeWidth={2} />
                )}
              </span>
            )}
          </div>
          
          {/* Full timestamp on hover/click */}
          {showTimestamp && (
            <div className={`absolute -bottom-6 text-[10px] text-[var(--text-secondary)] whitespace-nowrap z-10 ${isOwn ? 'right-0' : 'left-0'}`}>
              {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleString()}
            </div>
          )}
        </div>

        {/* Action Menu (hover) */}
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
              {message.type === 'text' && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Copy size={14} />
                  <span>Copy</span>
                </button>
              )}
              <button
                onClick={handleReply}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Reply size={14} />
                <span>Reply</span>
              </button>
              {isOwn && (
                <button
                  onClick={handleDelete} 
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Right-click context menu */}
        {showContextMenu && (
          <div 
            ref={contextMenuRef}
            style={{ 
              position: 'fixed', 
              left: contextMenuPos.x, 
              top: contextMenuPos.y,
              zIndex: 100 
            }}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {message.type === 'text' && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Copy size={16} />
                <span>Copy text</span>
              </button>
            )}
            <button
              onClick={handleReply}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Reply size={16} />
              <span>Reply</span>
            </button>
            <button
              onClick={() => setShowContextMenu(false)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Forward size={16} />
              <span>Forward</span>
            </button>
            {isOwn && (
              <>
                <div className="border-t border-[var(--border-primary)] my-1" />
                <button
                  onClick={handleDelete} 
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}