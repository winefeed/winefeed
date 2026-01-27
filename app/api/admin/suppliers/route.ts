/**
 * ADMIN SUPPLIERS API
 *
 * GET /api/admin/suppliers
 *
 * Returns list of all suppliers with stats
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get all suppliers
    // Note: Only select columns that exist in the table
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('*')
      .order('namn', { ascending: true });

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
      return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }

    // Get wine counts per supplier
    const { data: wineCounts, error: wineCountsError } = await supabase
      .from('supplier_wines')
      .select('supplier_id, is_active');

    // Get user counts per supplier
    const { data: userCounts, error: userCountsError } = await supabase
      .from('supplier_users')
      .select('supplier_id');

    // Get order counts per supplier
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('supplier_id, status');

    // Build supplier list with stats
    const suppliersWithStats = suppliers?.map(supplier => {
      const wines = wineCounts?.filter(w => w.supplier_id === supplier.id) || [];
      const users = userCounts?.filter(u => u.supplier_id === supplier.id) || [];
      const supplierOrders = orders?.filter(o => o.supplier_id === supplier.id) || [];

      return {
        id: supplier.id,
        name: supplier.namn || supplier.name,
        type: supplier.type || null,
        isActive: supplier.is_active ?? true,
        email: supplier.kontakt_email || supplier.email || null,
        phone: supplier.telefon || supplier.phone || null,
        website: supplier.hemsida || supplier.website || null,
        orgNumber: supplier.org_number || null,
        address: supplier.address || null,
        city: supplier.city || null,
        postalCode: supplier.postal_code || null,
        country: supplier.country || null,
        createdAt: supplier.created_at,
        stats: {
          totalWines: wines.length,
          activeWines: wines.filter(w => w.is_active !== false).length,
          userCount: users.length,
          totalOrders: supplierOrders.length,
          pendingOrders: supplierOrders.filter(o => o.status === 'PENDING_SUPPLIER_CONFIRMATION').length,
        }
      };
    }) || [];

    return NextResponse.json({
      suppliers: suppliersWithStats,
      count: suppliersWithStats.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
