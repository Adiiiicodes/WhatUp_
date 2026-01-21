'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Check if current path is an admin route
  const isAdminRoute = pathname.startsWith('/admin');
  
  // For admin routes, render children without navbar/footer
  if (isAdminRoute) {
    return <>{children}</>;
  }
  
  // For non-admin routes, render with navbar and footer
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
