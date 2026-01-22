/**
 * SUPPLIER SHELL
 *
 * Client-side wrapper for supplier portal with sidebar
 * Fetches supplier context and renders navigation
 */

'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { SUPPLIER_NAVIGATION } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { ActorRole } from '@/lib/actor-service';

interface SupplierShellProps {
  children: React.ReactNode;
}

interface SupplierContext {
  supplierId: string;
  supplierName: string;
  userEmail: string;
  roles: ActorRole[];
}

const STORAGE_KEY = 'sidebar-collapsed';

export function SupplierShell({ children }: SupplierShellProps) {
  const [supplier, setSupplier] = useState<SupplierContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed state from localStorage
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

  useEffect(() => {
    // Public pages that don't require auth
    const publicPages = [
      '/supplier/login',
      '/supplier/forgot-password',
      '/supplier/reset-password',
    ];
    const isPublicPage = publicPages.some(page => window.location.pathname.startsWith(page));

    async function fetchSupplier() {
      try {
        const response = await fetch('/api/me/supplier');
        if (response.ok) {
          const data = await response.json();
          setSupplier(data);
        } else if (!isPublicPage) {
          // Redirect to login if not authenticated as supplier
          window.location.href = '/supplier/login';
          return;
        }
      } catch (error) {
        console.error('Failed to fetch supplier:', error);
        if (!isPublicPage) {
          window.location.href = '/supplier/login';
          return;
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSupplier();
  }, []);

  // Check if on public auth page - render without shell
  const publicAuthPages = ['/supplier/login', '/supplier/forgot-password', '/supplier/reset-password'];
  const isPublicAuthPage = typeof window !== 'undefined' &&
    publicAuthPages.some(page => window.location.pathname.startsWith(page));

  if (loading && !isPublicAuthPage) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Laddar...</p>
          </div>
        </div>
      </div>
    );
  }

  // Public auth pages - render without sidebar
  if (isPublicAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={SUPPLIER_NAVIGATION}
        userEmail={supplier?.userEmail}
        userRoles={supplier?.roles || ['SELLER']}
        isAdmin={false}
      />

      <main
        className={cn(
          'flex-1 transition-all duration-300',
          'lg:ml-64',
          collapsed && 'lg:ml-16'
        )}
      >
        {children}
      </main>
    </div>
  );
}
