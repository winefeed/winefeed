/**
 * ADMIN USER DETAIL API
 *
 * GET /api/admin/users/[id]
 *
 * Returns detailed information about a specific user, including:
 * - User profile (masked email, created_at)
 * - All roles and linked entities
 * - Recent activity (last 10 requests, offers, orders)
 *
 * Security:
 * - Admin-only
 * - Tenant-scoped (user must belong to requesting admin's tenant)
 * - No sensitive data
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
    restaurant_name?: string;
    supplier_id?: string;
    supplier_name?: string;
    importer_id?: string;
    importer_name?: string;
  } = {};

  // 1. Check RESTAURANT role (junction table first, then direct fallback)
  try {
    const { data: restaurantUser } = await supabase
      .from('restaurant_users')
      .select('restaurant_id, restaurants(id, name)')
      .eq('id', userId)
      .maybeSingle();

    if (restaurantUser) {
      roles.push('RESTAURANT');
      linkedEntities.restaurant_id = restaurantUser.restaurant_id;
      linkedEntities.restaurant_name = (restaurantUser as any).restaurants?.name;
    } else {
      // Fallback: restaurants.id = auth.users.id (legacy 1:1 mapping)
      const { data: directRestaurant } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', userId)
        .maybeSingle();

      if (directRestaurant) {
        roles.push('RESTAURANT');
        linkedEntities.restaurant_id = directRestaurant.id;
        linkedEntities.restaurant_name = directRestaurant.name;
      }
    }
  } catch (error) {
    // Skip if error
  }

  // 2. Check SELLER role
  try {
    const { data: supplierUser } = await supabase
      .from('supplier_users')
      .select('supplier_id, suppliers(id, namn)')
      .eq('id', userId)
      .maybeSingle();

    if (supplierUser) {
      roles.push('SELLER');
      linkedEntities.supplier_id = supplierUser.supplier_id;
      linkedEntities.supplier_name = (supplierUser as any).suppliers?.namn;
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
          .select('id, legal_name')
          .eq('org_number', supplier.org_number)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (importer) {
          roles.push('IOR');
          linkedEntities.importer_id = importer.id;
          linkedEntities.importer_name = importer.legal_name;
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

// Helper: Fetch supplier wines (top 10) if user is SELLER
async function fetchSupplierWines(supplierId: string) {
  const supabase = getSupabaseAdmin();

  const { data: wines } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, grape, vintage, price_ex_vat_sek, stock_qty')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  const { count } = await supabase
    .from('supplier_wines')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('is_active', true);

  return { wines: wines || [], total_count: count || 0 };
}

// Helper: Fetch quick stats for user based on roles
async function fetchQuickStats(userId: string, tenantId: string, linkedEntities: { supplier_id?: string; restaurant_id?: string }) {
  const supabase = getSupabaseAdmin();
  const stats: Record<string, any> = {};

  if (linkedEntities.supplier_id) {
    const { count: wineCount } = await supabase
      .from('supplier_wines')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', linkedEntities.supplier_id)
      .eq('is_active', true);

    const { count: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('supplier_id', linkedEntities.supplier_id);

    const { data: latestOffer } = await supabase
      .from('offers')
      .select('id, created_at, status')
      .eq('tenant_id', tenantId)
      .eq('created_by_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    stats.seller = {
      wine_count: wineCount || 0,
      order_count: orderCount || 0,
      latest_offer: latestOffer || null,
    };
  }

  if (linkedEntities.restaurant_id) {
    const { count: requestCount } = await supabase
      .from('quote_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('created_by_user_id', userId);

    const { count: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('buyer_restaurant_id', linkedEntities.restaurant_id);

    const { data: latestRequest } = await supabase
      .from('quote_requests')
      .select('id, created_at, status')
      .eq('tenant_id', tenantId)
      .eq('created_by_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    stats.restaurant = {
      request_count: requestCount || 0,
      order_count: orderCount || 0,
      latest_request: latestRequest || null,
    };
  }

  return stats;
}

// Helper: Fetch recent activity for user
async function fetchRecentActivity(userId: string, tenantId: string) {
  const supabase = getSupabaseAdmin();

  // Fetch recent requests (if user is restaurant)
  const { data: requests } = await supabase
    .from('quote_requests')
    .select('id, created_at, status, title')
    .eq('tenant_id', tenantId)
    .eq('created_by_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch recent offers (if user is supplier)
  const { data: offers } = await supabase
    .from('offers')
    .select('id, created_at, status, title')
    .eq('tenant_id', tenantId)
    .eq('created_by_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch recent orders (any role)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, status')
    .eq('tenant_id', tenantId)
    .or(`created_by_user_id.eq.${userId},buyer_restaurant_id.in.(select restaurant_id from restaurant_users where id='${userId}')`)
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    recent_requests: requests || [],
    recent_offers: offers || [],
    recent_orders: orders || []
  };
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: targetUserId } = params;

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

    // Fetch user from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(targetUserId);

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Resolve user roles (may be empty for users without assignments)
    const { roles, linked_entities } = await resolveUserRoles(targetUserId, tenantId);

    // Fetch recent activity
    const recentActivity = await fetchRecentActivity(targetUserId, tenantId);

    // Fetch supplier wines if SELLER
    const supplierWines = linked_entities.supplier_id
      ? await fetchSupplierWines(linked_entities.supplier_id)
      : null;

    // Fetch quick stats
    const quickStats = await fetchQuickStats(targetUserId, tenantId, linked_entities);

    return NextResponse.json(
      {
        user_id: authUser.user.id,
        email: authUser.user.email || '',
        email_masked: maskEmail(authUser.user.email || ''),
        created_at: authUser.user.created_at,
        roles,
        linked_entities,
        status: roles.length > 0 ? 'active' : 'unassigned',
        recent_activity: recentActivity,
        supplier_wines: supplierWines,
        quick_stats: quickStats,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error fetching user detail:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
