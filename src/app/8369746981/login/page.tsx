'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pass }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed');
        return;
      }
      // redirect to admin dashboard
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
