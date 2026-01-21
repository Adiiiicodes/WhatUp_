// src/components/admin/ConversationList.tsx
'use client';

import { useState, useEffect } from 'react';
import { Conversation, User, Message } from '@/types/chat';
import ConversationModal from './ConversationModal';

export default function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/admin/conversations', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }
        const data = await response.json();
        if (data.success) {
          setConversations(data.data);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, []);

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/messages?conversationId=${conversationId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      if (data.success) {
        setMessages(data.data);
        setIsModalOpen(true);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };


  const getParticipantNames = (participants: (string | User)[]) => {
    return participants.map(p => (typeof p === 'object' ? p.name : p)).join(', ');
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversation(conversationId);
    fetchMessages(conversationId);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedConversation(null);
    setMessages([]);
  };

  return (
    <div className="bg-[var(--bg-secondary)] p-6 rounded-lg shadow-md mt-8">
      <h2 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">Conversations</h2>

      {isLoading && <p>Loading conversations...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Participants</th>
                <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Last Message</th>
                <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map(convo => {
                const convoMessages = (convo as unknown as { messages?: Message[] }).messages;
                const lastMsg = convoMessages && convoMessages.length > 0
                  ? convoMessages[convoMessages.length - 1]
                  : null;
                return (
                  <tr key={convo._id} onClick={() => handleConversationClick(convo._id)} className="cursor-pointer hover:bg-[var(--bg-hover)]">
                    <td className="py-2 px-4 border-b border-[var(--border-primary)]">{getParticipantNames(convo.participants)}</td>
                    <td className="py-2 px-4 border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      {lastMsg?.content || lastMsg?.fileName || '(No messages)'}
                    </td>
                    <td className="py-2 px-4 border-b border-[var(--border-primary)] text-[var(--text-secondary)]">{convo.updatedAt ? new Date(convo.updatedAt).toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {isModalOpen && <ConversationModal messages={messages} onClose={closeModal} />}
    </div>
  );
}