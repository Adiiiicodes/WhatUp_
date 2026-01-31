// src/components/chat/ScrollToBottomFab.tsx
'use client';

import { FiChevronDown } from 'react-icons/fi';

interface ScrollToBottomFabProps {
  isVisible: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export function ScrollToBottomFab({ 
  isVisible, 
  onClick, 
  unreadCount = 0 
}: ScrollToBottomFabProps) {
  if (!isVisible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 z-30 w-12 h-12 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-full shadow-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all animate-in slide-in-from-bottom-4 fade-in duration-200 active:scale-95"
      aria-label="Scroll to bottom"
    >
      {/* Unread badge */}
      {unreadCount > 0 && (
        <div className="absolute -top-2 -right-1 min-w-[22px] h-[22px] bg-[var(--accent-primary)] rounded-full flex items-center justify-center px-1.5 shadow-lg animate-in zoom-in duration-150">
          <span className="text-[11px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </div>
      )}
      
      <FiChevronDown size={24} strokeWidth={2} />
    </button>
  );
}
