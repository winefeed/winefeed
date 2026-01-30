/**
 * SUPPLIER SHELL
 *
 * Client-side wrapper for supplier portal with sidebar
 * Fetches supplier context and renders navigation
 */

'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { SUPPLIER_NAVIGATION, getNavigationForRoles } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { ActorRole } from '@/lib/actor-service';
import { NotificationBell } from '@/components/supplier/NotificationBell';
import { Menu, User } from 'lucide-react';

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
        sections={getNavigationForRoles(SUPPLIER_NAVIGATION, supplier?.roles || ['SELLER'])}
        userEmail={supplier?.userEmail}
        userRoles={supplier?.roles || ['SELLER']}
        isAdmin={false}
        brandSubtitle={supplier?.supplierName}
      />

      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300',
          'lg:ml-64',
          collapsed && 'lg:ml-16'
        )}
      >
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left side - mobile menu toggle or breadcrumb area */}
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => {
                  // Toggle mobile menu
                  const newState = !collapsed;
                  localStorage.setItem(STORAGE_KEY, String(newState));
                  setCollapsed(newState);
                }}
              >
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
              <span className="text-sm text-gray-500 hidden sm:block">
                {supplier?.supplierName || 'Leverantörsportal'}
              </span>
            </div>

            {/* Right side - notifications and user */}
            <div className="flex items-center gap-2">
              <NotificationBell />

              {/* User dropdown placeholder */}
              <a
                href="/supplier/profile"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-wine/10 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-wine" />
                </div>
                <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[150px] truncate">
                  {supplier?.userEmail || 'Profil'}
                </span>
              </a>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
