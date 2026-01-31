// src/components/chat/ChatHeader.tsx
'use client';

import { FiArrowLeft, FiPhone, FiVideo, FiMoreVertical } from 'react-icons/fi';
import type { User } from '@/types/chat';

interface ChatHeaderProps {
  user: User;
  onBackPress?: () => void;
  onCallPress?: () => void;
  onVideoCallPress?: () => void;
  onMenuPress?: () => void;
  isTyping?: boolean;
}

function formatLastSeen(lastSeen?: Date): string {
  if (!lastSeen) return 'offline';
  
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'last seen just now';
  if (diffMins < 60) return `last seen ${diffMins} min ago`;
  if (diffHours < 24) return `last seen ${diffHours}h ago`;
  if (diffDays === 1) return 'last seen yesterday';
  if (diffDays < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `last seen ${days[lastSeenDate.getDay()]}`;
  }
  
  return `last seen ${lastSeenDate.toLocaleDateString()}`;
}

export function ChatHeader({
  user,
  onBackPress,
  onCallPress,
  onVideoCallPress,
  onMenuPress,
  isTyping = false,
}: ChatHeaderProps) {
  const isOnline = user.status === 'online';
  
  const getStatusText = () => {
    if (isTyping) return 'typing...';
    if (isOnline) return 'online';
    return formatLastSeen(user.lastSeen);
  };

  return (
    <div className="flex items-center px-2 sm:px-4 py-2 sm:py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
      {/* Back button (mobile) */}
      {onBackPress && (
        <button
          onClick={onBackPress}
          className="p-2 mr-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors lg:hidden"
          aria-label="Go back"
        >
          <FiArrowLeft size={22} className="text-[var(--icon-primary)]" />
        </button>
      )}

      {/* Avatar with online status */}
      <div className="relative mr-3">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center overflow-hidden">
          {user.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {user.name?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        {/* Online status indicator with pulse animation */}
        {isOnline && (
          <span 
            className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--online-status)] rounded-full border-2 border-[var(--bg-tertiary)] animate-pulse-online"
            aria-label="Online"
          />
        )}
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-[var(--text-primary)] truncate">
          {user.name || 'Unknown User'}
        </h2>
        <p 
          className={`text-xs truncate transition-colors ${
            isTyping 
              ? 'text-[var(--accent-primary)]' 
              : isOnline 
                ? 'text-[var(--online-status)]' 
                : 'text-[var(--text-secondary)]'
          }`}
        >
          {getStatusText()}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Video call */}
        <button
          onClick={onVideoCallPress}
          className="p-2.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Video call"
        >
          <FiVideo size={20} className="text-[var(--icon-primary)]" />
        </button>

        {/* Voice call */}
        <button
          onClick={onCallPress}
          className="p-2.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Voice call"
        >
          <FiPhone size={20} className="text-[var(--icon-primary)]" />
        </button>

        {/* Menu */}
        <button
          onClick={onMenuPress}
          className="p-2.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="More options"
        >
          <FiMoreVertical size={20} className="text-[var(--icon-primary)]" />
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;
