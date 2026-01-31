// src/components/chat/ChatSidebar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Conversation } from '@/types/chat';
import { Search, MoreVertical, LogOut, Plus, Camera, FileText, Mic, Image, Video, Settings, Shield, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import socketClient from '@/lib/signalingClient';
import { NewChatModal } from './NewChatModal';
import { NoChatsEmptyState, NoSearchResultsEmptyState } from '../ui/EmptyState';

interface ChatSidebarProps {
  currentUser: User;
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
}

// Format time for conversation list (WhatsApp style)
function formatConversationTime(date: Date | string | undefined): string {
  if (!date) return '';
  
  const msgDate = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - msgDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today: show time
  if (diffDays === 0) {
    return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }
  
  // This week: show day name
  if (diffDays < 7) {
    return msgDate.toLocaleDateString([], { weekday: 'short' });
  }
  
  // Older: show date
  return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Get message type icon
function getMessageTypeIcon(type?: string): React.ReactNode {
  switch (type) {
    case 'image':
      return <Camera size={14} className="text-[var(--text-tertiary)]" />;
    case 'video':
      return <Video size={14} className="text-[var(--text-tertiary)]" />;
    case 'voice':
      return <Mic size={14} className="text-[var(--text-tertiary)]" />;
    case 'document':
      return <FileText size={14} className="text-[var(--text-tertiary)]" />;
    default:
      return null;
  }
}

// Get message preview text
function getMessagePreview(message?: { type?: string; content?: string; fileName?: string }): string {
  if (!message) return 'Started a conversation';
  
  switch (message.type) {
    case 'image':
      return message.content || '📷 Photo';
    case 'video':
      return message.content || '🎥 Video';
    case 'voice':
      return '🎤 Voice message';
    case 'document':
      return `📄 ${message.fileName || 'Document'}`;
    default:
      return message.content || 'Started a conversation';
  }
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
  const [showNewChat, setShowNewChat] = useState(false);
  const [userStatuses, setUserStatuses] = useState<Record<string, 'online' | 'offline'>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, []);

  // Listen for real-time user status updates
  useEffect(() => {
    const unsubStatus = socketClient.onUserStatus((event) => {
      setUserStatuses(prev => ({ ...prev, [event.userId]: event.status }));
      // Also update the users list
      setUsers(prev => prev.map(u => 
        u._id === event.userId ? { ...u, status: event.status } : u
      ));
    });

    const unsubTyping = socketClient.onTyping((event) => {
      if (event.userId !== currentUser._id) {
        setTypingUsers(prev => ({ ...prev, [event.conversationId]: event.isTyping }));
      }
    });

    return () => {
      unsubStatus();
      unsubTyping();
    };
  }, [currentUser._id]);

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
      // if participant is a populated User object, return it with real-time status
      if (typeof p !== 'string') {
        const user = p as User;
        return { ...user, status: userStatuses[user._id] || user.status };
      }
      // otherwise try to find the user in the fetched users list
      const found = users.find((u) => u._id === pid);
      if (found) return { ...found, status: userStatuses[found._id] || found.status };
      // fallback: return a minimal User object
      return {
        _id: pid,
        email: '',
        name: 'Unknown',
        status: userStatuses[pid] || 'offline',
        createdAt: new Date(),
      };
    }
    return null;
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const name = user.name?.toLowerCase() || '';
    const email = user.email?.toLowerCase() || '';
    return name.includes(query) || email.includes(query);
  });

  const filteredConversations = conversations.filter(conversation => {
    const otherUser = getOtherUser(conversation);
    if (!otherUser) return false;
    const query = searchQuery.toLowerCase();
    const name = otherUser.name?.toLowerCase() || '';
    const email = otherUser.email?.toLowerCase() || '';
    return name.includes(query) || email.includes(query);
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
                         <div className="flex items-center gap-2">
                           <div className="font-semibold text-[var(--text-primary)]">{currentUser.name}</div>
                           {currentUser.isAdmin && (
                             <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">
                               Admin
                             </span>
                           )}
                         </div>
                         <div className="text-xs text-[var(--text-secondary)] truncate">{currentUser.email}</div>
                      </div>
                      <button
                        onClick={() => { setShowMenu(false); }}
                        className="w-full text-left px-5 py-3 hover:bg-[var(--bg-hover)] flex items-center gap-3 text-[var(--text-primary)] transition-colors"
                      >
                        <Settings size={18} />
                        <span>Settings</span>
                      </button>
                      {currentUser.isAdmin && (
                        <button
                          onClick={() => { setShowMenu(false); router.push('/admin'); }}
                          className="w-full text-left px-5 py-3 hover:bg-[var(--bg-hover)] flex items-center gap-3 text-[var(--text-primary)] transition-colors"
                        >
                          <Shield size={18} />
                          <span>Admin Panel</span>
                        </button>
                      )}
                      <div className="border-t border-[var(--border-primary)]/50 my-1" />
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
             <button 
               onClick={() => setShowNewChat(true)}
               className="w-10 h-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white hover:bg-[var(--accent-hover)] transition-transform active:scale-95 shadow-lg shadow-[var(--accent-primary)]/20"
             >
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
            className="w-full pl-10 pr-10 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl outline-none border border-transparent focus:border-[var(--accent-primary)]/30 focus:bg-[var(--bg-secondary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10 transition-all placeholder:text-[var(--text-tertiary)] text-sm"
          />
          {/* Clear button */}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {/* Search results count */}
        {searchQuery && (
          <div className="mt-2 px-1 text-xs text-[var(--text-tertiary)]">
            {filteredConversations.length + filteredUsers.length} results found
          </div>
        )}
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
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--online-status)] border-2 border-[var(--bg-secondary)] rounded-full animate-[pulseOnline_2s_ease-in-out_infinite]"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--accent-primary)] transition-colors">
                    <HighlightedText text={user.name || user.email} highlight={searchQuery} />
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate opacity-70">
                    <HighlightedText text={user.email} highlight={searchQuery} />
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
              const lastMsg = conversation.lastMessage;
              // Get unread count for current user
              const unreadCount = conversation.unreadCount?.[currentUser._id] || 0;
              const hasUnread = unreadCount > 0;

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
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--online-status)] border-[2.5px] border-[var(--bg-secondary)] rounded-full shadow-sm animate-[pulseOnline_2s_ease-in-out_infinite]"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <div className={`font-semibold text-sm truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]/90'}`}>
                        <HighlightedText text={otherUser.name} highlight={searchQuery} />
                      </div>
                      {lastMsg && (lastMsg.createdAt || lastMsg.timestamp) && (
                        <div className={`text-[11px] font-medium transition-colors ${hasUnread ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`}>
                          {formatConversationTime(lastMsg.createdAt || lastMsg.timestamp)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Show typing indicator if user is typing */}
                      {typingUsers[conversation._id] ? (
                        <div className="text-xs text-[var(--accent-primary)] font-medium flex items-center gap-1 animate-pulse">
                          <span>typing</span>
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Message type icon */}
                          {lastMsg?.type && lastMsg.type !== 'text' && getMessageTypeIcon(lastMsg.type)}
                          
                          {/* Message preview */}
                          <div className={`text-xs truncate flex-1 transition-opacity ${hasUnread ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)] opacity-80 group-hover:opacity-100'}`}>
                            {getMessagePreview(lastMsg)}
                          </div>
                        </>
                      )}

                      {/* Unread badge */}
                      {hasUnread && (
                        <div className="min-w-[20px] h-[20px] bg-[var(--accent-primary)] rounded-full flex items-center justify-center px-1.5 shrink-0">
                          <span className="text-[11px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredConversations.length === 0 && filteredUsers.length === 0 && (
          <div className="px-3 mt-4">
            {searchQuery ? (
              <NoSearchResultsEmptyState />
            ) : (
              <NoChatsEmptyState onStartChat={() => setShowNewChat(true)} />
            )}
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={handleUserClick}
        currentUserId={currentUser._id}
      />
    </div>
  );
}