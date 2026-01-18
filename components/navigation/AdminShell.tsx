/**
 * ADMIN SHELL
 *
 * Client-side wrapper for admin layout with sidebar
 * Fetches actor context on client and renders admin sidebar
 *
 * This component solves the Server/Client Component boundary issue:
 * - Server Component (layout.tsx) cannot pass functions/icons to Client Component (Sidebar)
 * - AdminShell is a Client Component that fetches data and renders Sidebar
 */

'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { getAdminNavigation } from '@/lib/navigation';
import type { ActorContext } from '@/lib/actor-service';

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [actor, setActor] = useState<ActorContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActor() {
      try {
        const response = await fetch('/api/me/actor');
        if (response.ok) {
          const data = await response.json();
          setActor(data);
        }
      } catch (error) {
        console.error('Failed to fetch actor:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActor();
  }, []);

  // Show loading state while fetching actor
  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading admin...</p>
          </div>
        </div>
      </div>
    );
  }

  // Get admin navigation (will be empty if not admin)
  const navigationSections = actor ? getAdminNavigation(actor.roles) : [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={navigationSections}
        userEmail={actor?.user_email}
        userRoles={actor?.roles || []}
        isAdmin={true}
      />

      <main className="flex-1 lg:pl-0">
        {children}
      </main>
    </div>
  );
}
