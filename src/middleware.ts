// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Allow all /chat requests to proceed — authentication is handled client-side
  // by ProtectedRoute which calls /api/auth/me (Node runtime, iron-session compatible).
  // This avoids Edge runtime issues with iron-session.
  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*'],
};