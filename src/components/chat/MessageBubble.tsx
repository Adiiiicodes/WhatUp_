// src/components/chat/MessageBubble.tsx
import { Message } from '@/types/chat';
import { Download, FileText, Trash2, CheckCheck, Check, MoreVertical, Copy, Reply, Forward, Ban, Clock } from 'lucide-react';
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import apiClient from '@/lib/api';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { logger } from '@/lib/logger';
import { formatFileSize, copyToClipboard } from '@/lib/utils';

// WhatsApp-style: 1 hour 8 minutes time window for "delete for everyone"
const DELETE_FOR_EVERYONE_WINDOW_MS = 68 * 60 * 1000;

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  conversationId?: string;
  onImageClick?: (src: string, fileName?: string, fileSize?: number) => void;
  onReply?: (message: Message) => void;
}

const log = logger.child({ component: 'MessageBubble' });

function MessageBubbleComponent({ message, isOwn, conversationId, onImageClick, onReply }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Check if message is deleted
  const isDeleted = message.deletedForEveryone === true;

  // Check if "delete for everyone" is still available (within time window)
  const canDeleteForEveryone = useMemo(() => {
    if (!isOwn) return false;
    const messageTime = new Date(message.createdAt || message.timestamp || Date.now()).getTime();
    const now = Date.now();
    return now - messageTime < DELETE_FOR_EVERYONE_WINDOW_MS;
  }, [isOwn, message.createdAt, message.timestamp]);

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
    const success = await copyToClipboard(message.content || '');
    if (!success) {
      log.warn({ messageId: message._id }, 'Failed to copy message content');
    }
  };

  // Handle reply
  const handleReply = () => {
    setShowMenu(false);
    setShowContextMenu(false);
    onReply?.(message);
  };

  // Open delete confirmation modal
  const openDeleteModal = () => {
    setShowMenu(false);
    setShowContextMenu(false);
    setShowDeleteModal(true);
  };

  // Handle delete for me only
  const handleDeleteForMe = async () => {
    if (!conversationId) {
      log.warn({ messageId: message._id }, 'Cannot delete: conversation ID missing');
      alert('Cannot delete: conversation ID missing');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await apiClient.deleteMessage(message._id, conversationId, false);
      if (res.success) {
        log.info({ messageId: message._id }, 'Message deleted for me');
        window.dispatchEvent(new CustomEvent('message:deleted', { detail: { id: message._id, forEveryone: false } }));
        window.dispatchEvent(new CustomEvent('conversations:refresh'));
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to delete message';
        log.warn({ messageId: message._id, error: errorMsg }, 'Failed to delete message');
        alert(errorMsg);
      }
    } catch (e) {
      log.error({ error: e, messageId: message._id }, 'Delete error');
      alert('Delete failed');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Handle delete for everyone
  const handleDeleteForEveryone = async () => {
    if (!conversationId) {
      log.warn({ messageId: message._id }, 'Cannot delete: conversation ID missing');
      alert('Cannot delete: conversation ID missing');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await apiClient.deleteMessage(message._id, conversationId, true);
      if (res.success) {
        log.info({ messageId: message._id }, 'Message deleted for everyone');
        window.dispatchEvent(new CustomEvent('message:deleted', { detail: { id: message._id, forEveryone: true } }));
        window.dispatchEvent(new CustomEvent('conversations:refresh'));
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Failed to delete message';
        log.warn({ messageId: message._id, error: errorMsg }, 'Failed to delete message');
        alert(errorMsg);
      }
    } catch (e) {
      log.error({ error: e, messageId: message._id }, 'Delete error');
      alert('Delete failed');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
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

  // Render deleted message placeholder
  const renderDeletedContent = () => {
    return (
      <div className="flex items-center gap-2 text-[var(--text-secondary)] italic">
        <Ban size={14} />
        <span className="text-sm">
          {isOwn ? 'You deleted this message' : 'This message was deleted'}
        </span>
      </div>
    );
  };

  const renderContent = () => {
    // If message is deleted, show placeholder
    if (isDeleted) {
      return renderDeletedContent();
    }

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
          onContextMenu={!isDeleted ? handleContextMenu : undefined}
          onClick={() => setShowTimestamp(!showTimestamp)}
          className={`relative px-3 py-2 shadow-sm border cursor-pointer select-none ${
            isDeleted
              ? 'bg-[var(--bg-secondary)] border-[var(--border-primary)] rounded-2xl opacity-70'
              : isOwn 
                ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[#006a5c] text-white rounded-2xl rounded-tr-sm border-[var(--accent-primary)]' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl rounded-tl-sm border-[var(--border-primary)]'
          }`}
        >
          {/* Edited indicator */}
          {message.isEdited && !isDeleted && (
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

        {/* Action Menu (hover) - hide for deleted messages */}
        {!isDeleted && (
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
                <button
                  onClick={openDeleteModal} 
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Right-click context menu */}
        {showContextMenu && !isDeleted && (
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
            <div className="border-t border-[var(--border-primary)] my-1" />
            <button
              onClick={openDeleteModal} 
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          >
            <div 
              className="bg-[var(--bg-primary)] rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[var(--border-primary)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Delete message?</h3>
              </div>
              
              <div className="p-4 space-y-2">
                {/* Delete for me option */}
                <button
                  onClick={handleDeleteForMe}
                  disabled={isDeleting}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 size={18} className="text-[var(--text-secondary)]" />
                  <div className="text-left">
                    <div className="font-medium">Delete for me</div>
                    <div className="text-xs text-[var(--text-secondary)]">This message will be deleted from your view</div>
                  </div>
                </button>

                {/* Delete for everyone option - only for own messages */}
                {isOwn && (
                  <button
                    onClick={handleDeleteForEveryone}
                    disabled={isDeleting || !canDeleteForEveryone}
                    className={`flex items-center gap-3 w-full px-4 py-3 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                      canDeleteForEveryone 
                        ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' 
                        : 'text-[var(--text-secondary)] bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <Trash2 size={18} />
                    <div className="text-left">
                      <div className="font-medium flex items-center gap-2">
                        Delete for everyone
                        {!canDeleteForEveryone && <Clock size={14} />}
                      </div>
                      <div className="text-xs opacity-80">
                        {canDeleteForEveryone 
                          ? 'This message will be deleted for all participants'
                          : 'Time limit exceeded (1h 8min)'}
                      </div>
                    </div>
                  </button>
                )}
              </div>

              <div className="p-4 border-t border-[var(--border-primary)] flex justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoized export for performance optimization
export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isRead === nextProps.message.isRead &&
    prevProps.message.isEdited === nextProps.message.isEdited &&
    prevProps.message.deletedForEveryone === nextProps.message.deletedForEveryone &&
    prevProps.message.deletedAt === nextProps.message.deletedAt &&
    prevProps.isOwn === nextProps.isOwn &&
    prevProps.conversationId === nextProps.conversationId
  );
});