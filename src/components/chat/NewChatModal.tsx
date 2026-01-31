// src/components/chat/NewChatModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Users, UserPlus } from 'lucide-react';
import { User } from '@/types/chat';
import apiClient from '@/lib/api';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  currentUserId: string;
}

// Highlight matching text in search results
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} className="text-[var(--accent-primary)] font-semibold bg-[var(--accent-primary)]/10 rounded px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function NewChatModal({ isOpen, onClose, onSelectUser, currentUserId }: NewChatModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getUsers();
      if (res.success && res.data) {
        // Filter out current user
        setUsers(res.data.filter(u => u._id !== currentUserId));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      // Focus search input when modal opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  }, [isOpen, fetchUsers]);

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const name = user.name?.toLowerCase() || '';
    const email = user.email?.toLowerCase() || '';
    return name.includes(query) || email.includes(query);
  });

  // Group users: online first, then offline
  const onlineUsers = filteredUsers.filter(u => u.status === 'online');
  const offlineUsers = filteredUsers.filter(u => u.status !== 'online');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-secondary)] rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <UserPlus size={20} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">New Chat</h2>
              <p className="text-xs text-[var(--text-secondary)]">Select a user to start chatting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--border-primary)]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl outline-none border border-transparent focus:border-[var(--accent-primary)]/30 focus:ring-4 focus:ring-[var(--accent-primary)]/10 transition-all placeholder:text-[var(--text-tertiary)] text-sm"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            // Loading skeletons
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-32" />
                    <div className="h-3 bg-[var(--bg-tertiary)] rounded w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
                <Users size={32} className="text-[var(--text-tertiary)]" />
              </div>
              <p className="text-[var(--text-secondary)] font-medium">
                {searchQuery ? 'No users found' : 'No users available'}
              </p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                {searchQuery ? 'Try a different search term' : 'Invite friends to start chatting'}
              </p>
            </div>
          ) : (
            <>
              {/* Online Users */}
              {onlineUsers.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[var(--online-status)] rounded-full animate-pulse" />
                    Online ({onlineUsers.length})
                  </div>
                  {onlineUsers.map(user => (
                    <UserListItem 
                      key={user._id} 
                      user={user} 
                      searchQuery={searchQuery}
                      onClick={() => {
                        onSelectUser(user);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Offline Users */}
              {offlineUsers.length > 0 && (
                <div>
                  {onlineUsers.length > 0 && (
                    <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2">
                      Offline ({offlineUsers.length})
                    </div>
                  )}
                  {offlineUsers.map(user => (
                    <UserListItem 
                      key={user._id} 
                      user={user} 
                      searchQuery={searchQuery}
                      onClick={() => {
                        onSelectUser(user);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UserListItem({ 
  user, 
  searchQuery, 
  onClick 
}: { 
  user: User; 
  searchQuery: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 flex items-center gap-3 rounded-xl hover:bg-[var(--bg-hover)] cursor-pointer transition-colors text-left group"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold shadow-inner">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
        {user.status === 'online' && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--online-status)] border-[2.5px] border-[var(--bg-secondary)] rounded-full" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--accent-primary)] transition-colors">
            <HighlightedText text={user.name || 'Unknown'} highlight={searchQuery} />
          </div>
          {user.isAdmin && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">
              Admin
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--text-secondary)] truncate">
          <HighlightedText text={user.email} highlight={searchQuery} />
        </div>
      </div>

      {/* Status text */}
      <div className={`text-xs font-medium ${user.status === 'online' ? 'text-[var(--online-status)]' : 'text-[var(--text-tertiary)]'}`}>
        {user.status === 'online' ? 'Online' : 'Offline'}
      </div>
    </button>
  );
}
