// src/app/admin/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Home, LogOut } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Mobile Header */}
      <div className="lg:hidden bg-[var(--accent-secondary)] text-white p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-4 text-[var(--accent-primary)]">Admin Dashboard</h1>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-md hover:bg-[var(--bg-secondary)]"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block bg-[var(--bg-secondary)] text-white p-4 lg:p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl lg:text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 hover:text-[var(--text-secondary)] transition-colors"
            >
              <Home size={20} />
              <span className="hidden xl:block">Main Site</span>
            </Link>
            <Link
              href="/api/admin/logout"
              className="flex items-center space-x-2 hover:text-[var(--text-secondary)] transition-colors"
            >
              <LogOut size={20} />
              <span className="hidden xl:block">Logout</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`lg:hidden fixed left-0 top-0 h-full w-64 bg-[var(--bg-secondary)] shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-[var(--border-primary)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Navigation</h2>
        </div>
        <nav className="p-4 space-y-2">
          <Link
            href="/admin"
            className="block px-4 py-2 rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/gallery"
            className="block px-4 py-2 rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            Gallery
          </Link>
          <Link
            href="/"
            className="block px-4 py-2 rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            Main Site
          </Link>
          <Link
            href="/api/admin/logout"
            className="block px-4 py-2 rounded-md text-red-500 hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            Logout
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}