/**
 * ADMIN LAYOUT
 *
 * Layout for admin pages with sidebar navigation
 * Simplified version - no auth checks for MVP
 */

'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { ADMIN_NAVIGATION } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'sidebar-collapsed';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    }

    const handleStorageChange = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setCollapsed(stored === 'true');
      }
    };

    const interval = setInterval(handleStorageChange, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={ADMIN_NAVIGATION}
        userEmail="markus@esima.se"
        userRoles={['ADMIN']}
        isAdmin={true}
      />

      <main
        className={cn(
          'flex-1 transition-all duration-300',
          'pt-16 lg:pt-0', // Space for mobile hamburger menu
          'lg:ml-64',
          collapsed && 'lg:ml-16'
        )}
      >
        {children}
      </main>
    </div>
  );
}
