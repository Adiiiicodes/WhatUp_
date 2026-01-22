'use client';

import { useState } from 'react';
import apiClient from '@/lib/api';

export default function AdminLoginPage() {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiClient.adminLogin(id, pass);
      if (!res.success) {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Login failed';
        setError(errorMsg);
        return;
      }

      // Store Basic Auth cookie that the admin dashboard expects
      const basicAuth = btoa(`${id}:${pass}`);
      document.cookie = `admin_basic=${basicAuth}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days

      // Store JWT token as well for API calls
      if (res.data?.token) {
        apiClient.setToken(res.data.token);
      }

      // Redirect to admin dashboard
      window.location.href = '/8369746981';
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError(String(err) || 'Login error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-tertiary)]">
      <form onSubmit={handleSubmit} className="bg-[var(--bg-secondary)] p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Admin Login</h1>
        <input className="input-chat mb-3 w-full" placeholder="Admin ID" value={id} onChange={(e) => setId(e.target.value)} />
        <input className="input-chat mb-3 w-full" placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <button type="submit" className="btn-primary w-full">Log in</button>
        {error && <p className="text-red-400 mt-2">{error}</p>}
      </form>
    </div>
  );
}
