// src/app/chat/page.tsx — server component that Suspense-wraps the client ChatPage
import { Suspense } from 'react';
import ChatPageClient from '@/components/chat/ChatPageClient';

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent-primary)]"></div>
        </div>
      }
    >
      <ChatPageClient />
    </Suspense>
  );
}