/**
 * DASHBOARD LAYOUT
 *
 * Layout for authenticated dashboard pages
 * Includes sidebar with role-based navigation
 *
 * Applies to:
 * - /dashboard/new-request
 * - /dashboard/requests
 * - /dashboard/requests/[id]
 * - /dashboard/results/[id]
 * - /dashboard/offers/[id]
 */

import { Sidebar } from '@/components/navigation/Sidebar';
import { getMainNavigation } from '@/lib/navigation';
import { actorService } from '@/lib/actor-service';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get auth context from cookies
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Default tenant (MVP - single tenant)
  const tenantId = '00000000-0000-0000-0000-000000000001';

  // Resolve actor context (roles and entity IDs)
  const actor = user
    ? await actorService.resolveActor({
        user_id: user.id,
        tenant_id: tenantId,
        user_email: user.email,
      })
    : { roles: [], tenant_id: tenantId, user_id: '' };

  // Get navigation sections based on user's roles
  const navigationSections = getMainNavigation(actor.roles);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={navigationSections}
        userEmail={user?.email}
        userRoles={actor.roles}
        isAdmin={false}
      />

      <main className="flex-1 lg:pl-0">
        {children}
      </main>
    </div>
  );
}
