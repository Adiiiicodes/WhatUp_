// src/components/ui/EmptyState.tsx
'use client';

import { 
  FiMessageSquare, 
  FiSearch, 
  FiUserPlus, 
  FiInbox,
  FiWifiOff,
  FiAlertCircle
} from 'react-icons/fi';

interface EmptyStateProps {
  variant: 'no-chats' | 'no-messages' | 'no-search-results' | 'no-connection' | 'error';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const variants = {
  'no-chats': {
    icon: FiMessageSquare,
    defaultTitle: 'No conversations yet',
    defaultDescription: 'Start chatting with someone to see your conversations here.',
    iconBg: 'from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/5',
    iconColor: 'text-[var(--accent-primary)]',
  },
  'no-messages': {
    icon: FiInbox,
    defaultTitle: 'No messages yet',
    defaultDescription: 'Say hello to start the conversation!',
    iconBg: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-500',
  },
  'no-search-results': {
    icon: FiSearch,
    defaultTitle: 'No results found',
    defaultDescription: 'Try searching with different keywords.',
    iconBg: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-500',
  },
  'no-connection': {
    icon: FiWifiOff,
    defaultTitle: 'No internet connection',
    defaultDescription: 'Check your connection and try again.',
    iconBg: 'from-orange-500/20 to-orange-500/5',
    iconColor: 'text-orange-500',
  },
  'error': {
    icon: FiAlertCircle,
    defaultTitle: 'Something went wrong',
    defaultDescription: 'We couldn\'t load this content. Please try again.',
    iconBg: 'from-red-500/20 to-red-500/5',
    iconColor: 'text-red-500',
  },
};

export function EmptyState({ 
  variant, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-6 py-12 text-center animate-in fade-in duration-500">
      {/* Icon */}
      <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${config.iconBg} flex items-center justify-center mb-6 shadow-lg`}>
        <Icon size={36} className={config.iconColor} strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">
        {description || config.defaultDescription}
      </p>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-xl transition-all shadow-lg shadow-[var(--accent-primary)]/20 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Specialized empty states

export function NoChatsEmptyState({ onStartChat }: { onStartChat?: () => void }) {
  return (
    <EmptyState
      variant="no-chats"
      title="Your inbox is empty"
      description="Connect with friends and start meaningful conversations."
      action={onStartChat ? {
        label: 'Start a chat',
        onClick: onStartChat,
      } : undefined}
    />
  );
}

export function NoMessagesEmptyState() {
  return (
    <EmptyState
      variant="no-messages"
      title="No messages yet"
      description="Be the first to say hello! 👋"
    />
  );
}

export function NoSearchResultsEmptyState({ query }: { query?: string }) {
  return (
    <EmptyState
      variant="no-search-results"
      title="No results found"
      description={query ? `No matches for "${query}"` : 'Try a different search term.'}
    />
  );
}

export function ConnectionErrorEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="no-connection"
      title="Connection lost"
      description="Please check your internet connection and try again."
      action={onRetry ? {
        label: 'Retry',
        onClick: onRetry,
      } : undefined}
    />
  );
}

export function GenericErrorEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Oops! Something went wrong"
      description="We're having trouble loading this. Please try again."
      action={onRetry ? {
        label: 'Try again',
        onClick: onRetry,
      } : undefined}
    />
  );
}
