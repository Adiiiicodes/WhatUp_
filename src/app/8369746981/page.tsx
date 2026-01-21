// src/app/8369746981/page.tsx
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_basic')?.value;

  const adminId = process.env.ADMIN_ID || '';
  const adminPass = process.env.ADMIN_PASS || '';
  const expected = adminId && adminPass ? Buffer.from(`${adminId}:${adminPass}`).toString('base64') : null;

  if (!token || !expected || token !== expected) {
    redirect('/8369746981/login');
  }

  return <AdminDashboardClient />;
}