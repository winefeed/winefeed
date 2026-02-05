/**
 * IOR SHELL
 *
 * Client-side wrapper for IOR portal with sidebar navigation.
 * Based on SupplierShell pattern.
 */

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../navigation/Sidebar';
import { IOR_NAVIGATION, getNavigationForRoles } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { ActorRole } from '@/lib/actor-service';
import { Menu, User, Building2 } from 'lucide-react';

interface IORShellProps {
  children: React.ReactNode;
}

interface IORContext {
  importerId: string;
  importerName: string;
  userEmail: string;
  roles: ActorRole[];
}

const STORAGE_KEY = 'sidebar-collapsed';

export function IORShell({ children }: IORShellProps) {
  const pathname = usePathname();
  const [importer, setImporter] = useState<IORContext | null>(null);
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
    async function fetchContext() {
      try {
        const response = await fetch('/api/me/actor');
        if (response.ok) {
          const data = await response.json();
          // Check if user has IOR role
          if (data.roles?.includes('IOR') && data.importer_id) {
            setImporter({
              importerId: data.importer_id,
              importerName: data.importer_name || 'Importör',
              userEmail: data.user_email || '',
              roles: data.roles,
            });
          } else {
            // Redirect to login if not IOR
            window.location.href = '/login?redirect=' + encodeURIComponent(pathname);
            return;
          }
        } else {
          window.location.href = '/login?redirect=' + encodeURIComponent(pathname);
          return;
        }
      } catch (error) {
        console.error('Failed to fetch IOR context:', error);
        window.location.href = '/login';
        return;
      } finally {
        setLoading(false);
      }
    }

    fetchContext();
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Laddar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={getNavigationForRoles(IOR_NAVIGATION, importer?.roles || ['IOR'])}
        userEmail={importer?.userEmail}
        userRoles={importer?.roles || ['IOR']}
        isAdmin={false}
        brandSubtitle={importer?.importerName}
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
            {/* Left side - mobile menu toggle */}
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => {
                  const newState = !collapsed;
                  localStorage.setItem(STORAGE_KEY, String(newState));
                  setCollapsed(newState);
                }}
              >
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <Building2 className="h-4 w-4" />
                <span>{importer?.importerName || 'Importörportal'}</span>
              </div>
            </div>

            {/* Right side - user */}
            <div className="flex items-center gap-2">
              <a
                href="/ior/settings"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-wine/10 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-wine" />
                </div>
                <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[150px] truncate">
                  {importer?.userEmail || 'Profil'}
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
