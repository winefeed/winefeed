/**
 * ADMIN LAYOUT
 *
 * Layout for admin pages
 * Includes sidebar with admin-specific navigation
 *
 * Applies to:
 * - /admin (dashboard)
 * - /admin/users
 * - /admin/users/[id]
 * - /admin/invites
 * - /admin/pilot
 */

import { Sidebar } from '@/components/navigation/Sidebar';
import { getAdminNavigation } from '@/lib/navigation';
import { actorService } from '@/lib/actor-service';
import { adminService } from '@/lib/admin-service';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
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

  // Require authentication
  if (!user) {
    redirect('/login?redirect=/admin');
  }

  // Default tenant (MVP - single tenant)
  const tenantId = '00000000-0000-0000-0000-000000000001';

  // Resolve actor context (roles and entity IDs)
  const actor = await actorService.resolveActor({
    user_id: user.id,
    tenant_id: tenantId,
    user_email: user.email,
  });

  // Check if user is admin
  const isAdmin = await adminService.isAdmin(actor);

  // Block access if not admin
  if (!isAdmin) {
    redirect('/dashboard/new-request?error=admin_access_denied');
  }

  // Get admin navigation
  const navigationSections = getAdminNavigation(actor.roles);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={navigationSections}
        userEmail={user?.email}
        userRoles={actor.roles}
        isAdmin={true}
      />

      <main className="flex-1 lg:pl-0">
        {children}
      </main>
    </div>
  );
}
