// src/app/page.tsx
'use client';

import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { OAuthHandler } from '@/components/auth/OAuthHandler';
import { useSearchParams } from 'next/navigation';

function HomeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  // If we have OAuth data, handle it
  if (token || error) {
    return <OAuthHandler />;
  }

  // Otherwise show the auth form
  return <AuthForm />;
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent-primary)]"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}