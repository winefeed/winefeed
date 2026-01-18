/**
 * ADMIN STATS API
 *
 * GET /api/admin/stats
 *
 * Returns tenant-scoped statistics for admin dashboard
 *
 * Features:
 * - Total counts (restaurants, suppliers, users, requests, offers, orders)
 * - Recent activity (latest 20 events)
 * - Alerts summary from pilot console
 *
 * Access Control:
 * - Dev: ADMIN_MODE=true
 * - Prod: Admin role check (TODO: implement when user roles are added)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { actorService } from '@/lib/actor-service';
import { adminService } from '@/lib/admin-service';

export async function GET(request: NextRequest) {
  try {
// Get user from Supabase session
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
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    const tenantId = '00000000-0000-0000-0000-000000000001';
    // Access control: Check admin privileges
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = await adminService.isAdmin(actor);

if (!isAdmin) {
  return NextResponse.json(
    { error: 'Forbidden: Admin access required', hint: 'Set ADMIN_MODE=true in .env.local for dev or add user to admin_users table', debug: { userId, tenantId, userEmail: user.email } },
    { status: 403 }
  );
}
    const supabaseAdmin = getSupabaseAdmin();

    // Fetch counts in parallel
    const [
      restaurantsResult,
      suppliersResult,
      requestsResult,
      offersResult,
      ordersResult,
      importsResult,
    ] = await Promise.all([
      supabaseAdmin.from('restaurants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('suppliers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('quote_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('offers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('imports').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    // Fetch recent activity (latest requests, offers, orders)
    const { data: recentRequests } = await supabase
      .from('quote_requests')
      .select('id, created_at, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentOffers } = await supabase
      .from('offers')
      .select('id, created_at, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, created_at, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Combine and sort recent activity
    const recentActivity = [
      ...(recentRequests || []).map((r) => ({ ...r, type: 'request' as const })),
      ...(recentOffers || []).map((o) => ({ ...o, type: 'offer' as const })),
      ...(recentOrders || []).map((o) => ({ ...o, type: 'order' as const })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    // Fetch alerts summary (simplified version of pilot overview)
    const { data: euOrdersWithoutImport } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('supplier_type', ['EU_PRODUCER', 'EU_IMPORTER'])
      .is('import_id', null)
      .limit(100);

    const stats = {
      counts: {
        restaurants: restaurantsResult.count || 0,
        suppliers: suppliersResult.count || 0,
        users: 0, // TODO: Add users table query when implemented
        requests: requestsResult.count || 0,
        offers: offersResult.count || 0,
        orders: ordersResult.count || 0,
        imports: importsResult.count || 0,
      },
      recent_activity: recentActivity,
      alerts: {
        eu_orders_without_import: euOrdersWithoutImport?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics', details: error.message },
      { status: 500 }
    );
  }
}
