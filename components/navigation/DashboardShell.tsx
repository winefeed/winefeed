/**
 * DASHBOARD SHELL
 *
 * Client-side wrapper for dashboard layout with sidebar
 * Fetches actor context on client and renders sidebar with navigation
 *
 * This component solves the Server/Client Component boundary issue:
 * - Server Component (layout.tsx) cannot pass functions/icons to Client Component (Sidebar)
 * - DashboardShell is a Client Component that fetches data and renders Sidebar
 */

'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { getMainNavigation } from '@/lib/navigation';
import type { ActorContext } from '@/lib/actor-service';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Get navigation based on user's roles
  const navigationSections = actor ? getMainNavigation(actor.roles) : [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={navigationSections}
        userEmail={actor?.user_email}
        userRoles={actor?.roles || []}
        isAdmin={false}
      />

      <main className="flex-1 lg:pl-0">
        {children}
      </main>
    </div>
  );
}
