/**
 * ADMIN USERS API - USER MANAGEMENT DASHBOARD
 *
 * GET /api/admin/users
 *
 * Returns list of users in the tenant with roles, linked entities, and status.
 *
 * Security:
 * - Admin-only (via adminService.isAdmin)
 * - Tenant-scoped
 * - Emails masked for privacy
 * - No sensitive data (passwords, tokens)
 *
 * Returns:
 * - user_id: UUID from auth.users
 * - email_masked: m***@domain.com format
 * - created_at: ISO timestamp
 * - roles: Array of role strings (RESTAURANT, SELLER, IOR, ADMIN)
 * - linked_entities: { restaurant_id?, supplier_id?, importer_id? }
 * - status: 'active' (always active for now, extensible for future)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { actorService } from '@/lib/actor-service';
import { adminService } from '@/lib/admin-service';

// Helper: Mask email address (m***@domain.com)
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';

  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  return `${maskedLocal}@${domain}`;
}

// Helper: Resolve user roles and entities
async function resolveUserRoles(userId: string, tenantId: string) {
  const supabase = getSupabaseAdmin();

  const roles: string[] = [];
  const linkedEntities: {
    restaurant_id?: string;
    supplier_id?: string;
    importer_id?: string;
  } = {};

  // 1. Check RESTAURANT role
  try {
    const { data: restaurantUser } = await supabase
      .from('restaurant_users')
      .select('restaurant_id')
      .eq('id', userId)
      .maybeSingle();

    if (restaurantUser) {
      roles.push('RESTAURANT');
      linkedEntities.restaurant_id = restaurantUser.restaurant_id;
    }
  } catch (error) {
    // Skip if error
  }

  // 2. Check SELLER role
  try {
    const { data: supplierUser } = await supabase
      .from('supplier_users')
      .select('supplier_id')
      .eq('id', userId)
      .maybeSingle();

    if (supplierUser) {
      roles.push('SELLER');
      linkedEntities.supplier_id = supplierUser.supplier_id;
    }
  } catch (error) {
    // Skip if error
  }

  // 3. Check IOR role (via supplier org_number matching importer)
  if (linkedEntities.supplier_id) {
    try {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('org_number')
        .eq('id', linkedEntities.supplier_id)
        .maybeSingle();

      if (supplier?.org_number) {
        const { data: importer } = await supabase
          .from('importers')
          .select('id')
          .eq('org_number', supplier.org_number)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (importer) {
          roles.push('IOR');
          linkedEntities.importer_id = importer.id;
        }
      }
    } catch (error) {
      // Skip if error
    }
  }

  // 4. Check ADMIN role
  try {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (adminUser) {
      roles.push('ADMIN');
    }
  } catch (error) {
    // Skip if error
  }

  return { roles, linked_entities: linkedEntities };
}

export async function GET(request: NextRequest) {
  try {
    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing auth context' },
        { status: 401 }
      );
    }

    // Security: Admin check
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = await adminService.isAdmin(actor);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required', hint: 'Set ADMIN_MODE=true in .env.local for dev or add user to admin_users table' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch ALL users from auth.users (using service role)
    // Admin should see everyone in the system, not just users with roles
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      throw new Error(`Failed to fetch auth users: ${authError.message}`);
    }

    // All auth users are tenant users (MVP: single-tenant)
    const tenantUsers = authUsers.users;

    // Resolve roles and entities for each user
    const enrichedUsers = await Promise.all(
      tenantUsers.map(async (user) => {
        const { roles, linked_entities } = await resolveUserRoles(user.id, tenantId);

        return {
          user_id: user.id,
          email_masked: maskEmail(user.email || ''),
          created_at: user.created_at,
          roles,
          linked_entities,
          status: 'active' as const // Extensible for future statuses
        };
      })
    );

    // Sort by created_at DESC (newest first)
    enrichedUsers.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json(
      {
        users: enrichedUsers,
        count: enrichedUsers.length,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
