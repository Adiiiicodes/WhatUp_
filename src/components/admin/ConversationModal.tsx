// src/components/admin/ConversationModal.tsx
'use client';

import { Message, User } from '@/types/chat';
import { X } from 'lucide-react';

interface ConversationModalProps {
    messages: Message[];
    onClose: () => void;
}

export default function ConversationModal({ messages, onClose }: ConversationModalProps) {

    const getSenderName = (sender: string | User) => {
        return typeof sender === 'object' ? sender.name : 'Unknown';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-tertiary)] p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">Conversation</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <X size={24} />
                    </button>
                </div>
                <div className="overflow-y-auto flex-grow">
                    <div className="space-y-4">
                        {messages.map(message => (
                            <div key={message._id} className="flex p-3 rounded-lg hover:bg-[var(--bg-hover)]">
                                <div className="flex-shrink-0 mr-3">
                                    {/* You can add an avatar here if you have it */}
                                </div>
                                <div className="flex-grow">
                                    <div className="font-bold text-[var(--accent-primary)]">{getSenderName(message.senderId)}</div>
                                    <div className="text-[var(--text-primary)]">{message.content}</div>
                                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : message.timestamp ? new Date(message.timestamp).toLocaleString() : '-'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
