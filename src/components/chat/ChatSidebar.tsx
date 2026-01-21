// src/components/chat/ChatSidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { User, Conversation } from '@/types/chat';
import { Search, MoreVertical, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChatSidebarProps {
  currentUser: User;
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
}

export function ChatSidebar({
  currentUser,
  selectedConversation,
  onSelectConversation,
}: ChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, []);

  // Refresh conversations on external events (message deleted/created)
  useEffect(() => {
    const handler = () => fetchConversations();
    window.addEventListener('conversations:refresh', handler as EventListener);
    return () => window.removeEventListener('conversations:refresh', handler as EventListener);
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      if (data.success) {
        setConversations(data.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleUserClick = async (user: User) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: user._id }),
      });
      const data = await response.json();
      if (data.success) {
        onSelectConversation(data.data);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const idOf = (v: unknown): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    const obj = v as Record<string, unknown>;
    if ('_id' in obj && obj._id != null) return String(obj._id);
    if ('id' in obj && obj.id != null) return String(obj.id);
    return String(v);
  };

  const getOtherUser = (conversation: Conversation): User | null => {
    for (const p of conversation.participants) {
      const pid = idOf(p);
      if (!pid || pid === currentUser._id) continue;
      // if participant is a populated User object, return it
      if (typeof p !== 'string') return p as User;
      // otherwise try to find the user in the fetched users list
      const found = users.find((u) => u._id === pid);
      if (found) return found;
      // fallback: return a minimal User object
      return {
        _id: pid,
        email: '',
        name: 'Unknown',
        status: 'offline',
        createdAt: new Date(),
      };
    }
    return null;
  };

  const filteredUsers = users.filter(user =>
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || '') ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(conversation => {
    const otherUser = getOtherUser(conversation);
    return otherUser && (
      otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      otherUser.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="w-full lg:w-96 bg-[var(--bg-secondary)] flex flex-col h-screen border-r border-[var(--border-primary)]">
      {/* Header */}
      <div className="bg-[var(--bg-tertiary)] p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-semibold text-base">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="status-online absolute bottom-0 right-0"></div>
          </div>
          <span className="text-[var(--text-primary)] font-medium text-sm sm:text-base truncate">
            {currentUser.name}
          </span>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors touch-manipulation"
            aria-label="Menu"
          >
            <MoreVertical size={20} className="text-[var(--icon-primary)]" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-primary)] z-50">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 hover:bg-[var(--bg-hover)] flex items-center space-x-2 text-[var(--text-primary)] touch-manipulation"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-2 sm:p-3 bg-[var(--bg-tertiary)]">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--icon-secondary)]"
          />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-sm sm:text-base"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Show users list when searching OR when no conversations exist */}
        {(searchQuery || conversations.length === 0) && filteredUsers.length > 0 && (
          <div className="p-2">
            <div className="text-xs text-[var(--text-tertiary)] px-3 py-2">
              {conversations.length === 0 ? 'Available Users' : 'Users'}
            </div>
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                onClick={() => handleUserClick(user)}
                className="chat-item-hover p-3 sm:p-3.5 flex items-center space-x-3 rounded-lg touch-manipulation"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-semibold">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  {user.status === 'online' && (
                    <div className="status-online absolute bottom-0 right-0"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-primary)] font-medium truncate">
                    {user.name || user.email}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredConversations.length > 0 && (
          <div className="p-2">
            {searchQuery && <div className="text-xs text-[var(--text-tertiary)] px-3 py-2">
              Conversations
            </div>}
            {filteredConversations.map((conversation) => {
              const otherUser = getOtherUser(conversation);
              if (!otherUser) return null;

              return (
                <div
                  key={conversation._id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`chat-item-hover p-3 sm:p-3.5 flex items-center space-x-3 rounded-lg touch-manipulation ${
                    selectedConversation?._id === conversation._id
                      ? 'bg-[var(--bg-hover)]'
                      : ''
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-semibold">
                      {otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    {otherUser.status === 'online' && (
                      <div className="status-online absolute bottom-0 right-0"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-[var(--text-primary)] font-medium truncate">
                        {otherUser.name}
                      </div>
                      {conversation.lastMessage && (conversation.lastMessage.createdAt || conversation.lastMessage.timestamp) && (
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {new Date(conversation.lastMessage.createdAt || conversation.lastMessage.timestamp || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] truncate">
                      {conversation.lastMessage?.content || 'No messages yet'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredConversations.length === 0 && filteredUsers.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-center p-4">
            {searchQuery ? 'No results found' : 'No conversations yet. Search for users to start chatting!'}
          </div>
        )}
      </div>
    </div>
  );
}