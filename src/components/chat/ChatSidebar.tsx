// src/components/chat/ChatSidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { User, Conversation } from '@/types/chat';
import { Search, MoreVertical, LogOut, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';

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
      const res = await apiClient.getConversations();
      if (res.success && res.data) {
        setConversations(res.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.getUsers();
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleUserClick = async (user: User) => {
    try {
      const res = await apiClient.createConversation(user._id);
      if (res.success && res.data) {
        onSelectConversation(res.data);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
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
    <div className="w-full lg:w-[360px] bg-[var(--bg-secondary)] flex flex-col h-screen border-r border-[var(--border-primary)]">
      {/* Header */}
      <div className="h-[80px] px-6 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Chats</h1>
        <div className="flex gap-3">
             {/* Current User Profile / Menu */}
             <div className="relative">
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                   {currentUser.name ? (
                     <span className="font-semibold text-sm">{currentUser.name.charAt(0).toUpperCase()}</span>
                   ) : (
                     <MoreVertical size={20} />
                   )}
                </button>
                 {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border-primary)] z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-5 py-4 border-b border-[var(--border-primary)]/50 bg-[var(--bg-tertiary)]/50">
                         <div className="font-semibold text-[var(--text-primary)]">{currentUser.name}</div>
                         <div className="text-xs text-[var(--text-secondary)] truncate">{currentUser.email}</div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-5 py-3 hover:bg-[var(--bg-hover)] flex items-center gap-3 text-red-500 transition-colors"
                      >
                        <LogOut size={18} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
             </div>
             {/* New Chat Button */}
             <button className="w-10 h-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white hover:bg-[var(--accent-hover)] transition-transform active:scale-95 shadow-lg shadow-[var(--accent-primary)]/20">
                <Plus size={22} strokeWidth={2.5} />
             </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pb-2">
        <div className="relative group">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-[var(--accent-primary)] transition-colors"
          />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl outline-none border border-transparent focus:border-[var(--accent-primary)]/30 focus:bg-[var(--bg-secondary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10 transition-all placeholder:text-[var(--text-tertiary)] text-sm"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-1">
        {/* Show users list when searching OR when no conversations exist */}
        {(searchQuery || conversations.length === 0) && filteredUsers.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2 mb-1">
              {conversations.length === 0 ? 'Suggested People' : 'People'}
            </div>
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                onClick={() => handleUserClick(user)}
                className="group p-3 flex items-center gap-3 rounded-xl hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] font-semibold border border-[var(--border-primary)]">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  {user.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[var(--bg-secondary)] rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--accent-primary)] transition-colors">
                    {user.name || user.email}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate opacity-70">
                    {user.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredConversations.length > 0 && (
          <div className="pb-2">
           {searchQuery && (
              <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-2 mb-1">
                Conversations
              </div>
            )}
            {filteredConversations.map((conversation) => {
              const otherUser = getOtherUser(conversation);
              if (!otherUser) return null;
              const isSelected = selectedConversation?._id === conversation._id;

              return (
                <div
                  key={conversation._id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`relative p-3 flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                    isSelected
                      ? 'bg-[var(--bg-hover)] shadow-sm'
                      : 'hover:bg-[var(--bg-tertiary)]/50'
                  }`}
                >
                   {/* Left Accent Bar for selection */}
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-[var(--accent-primary)] rounded-r-full"></div>
                  )}

                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold shadow-inner">
                      {otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    {otherUser.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-[var(--bg-secondary)] rounded-full shadow-sm"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <div className={`font-semibold text-sm truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]/90'}`}>
                        {otherUser.name}
                      </div>
                      {conversation.lastMessage && (conversation.lastMessage.createdAt || conversation.lastMessage.timestamp) && (
                        <div className="text-[11px] font-medium text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
                          {new Date(conversation.lastMessage.createdAt || conversation.lastMessage.timestamp || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                       {/* Show read receipt if it's my message (dummy check for now since we don't know sender of last msg easily without id check, but we'll try) */}
                       {/* Assuming lastMessage has senderId populated or simple string */}
                       {/* Ideally we check if senderId === currentUser._id */}
                       <div className="text-xs text-[var(--text-secondary)] truncate flex-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {conversation.lastMessage?.content || 'Started a conversation'}
                      </div>

                      {/* Unread badge mock - logic can be added later */}
                      {/* <div className="min-w-[18px] h-[18px] bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">2</span>
                      </div> */}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredConversations.length === 0 && filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-tertiary)] text-center p-6 bg-[var(--bg-tertiary)]/30 rounded-2xl mx-3 mt-10 border border-dashed border-[var(--border-primary)]">
             <Search size={48} className="mb-4 opacity-20" />
             <p className="font-medium">No results found</p>
             <p className="text-sm mt-1 opacity-70">{searchQuery ? 'Try a different search term' : 'Search for users to start chatting'}</p>
          </div>
        )}
      </div>
    </div>
  );
}