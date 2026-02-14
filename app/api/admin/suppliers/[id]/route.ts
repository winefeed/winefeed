/**
 * ADMIN SUPPLIER DETAIL API
 *
 * GET /api/admin/suppliers/[id]
 *
 * Returns detailed info about a specific supplier
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

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: supplierId } = params;
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

    // Get supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError) {
      if (supplierError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
      }
      console.error('Error fetching supplier:', supplierError);
      return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 });
    }

    // Get users for this supplier
    const { data: users } = await supabase
      .from('supplier_users')
      .select('id, user_id, role, created_at')
      .eq('supplier_id', supplierId);

    // Get user details
    const userIds = users?.map(u => u.user_id) || [];
    const { data: userProfiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const usersWithDetails = users?.map(u => {
      const profile = userProfiles?.find(p => p.id === u.user_id);
      return {
        id: u.id,
        userId: u.user_id,
        email: profile?.email || 'Okand',
        name: profile?.name || null,
        role: u.role,
        createdAt: u.created_at,
      };
    }) || [];

    // Get wines for this supplier (all, with full details)
    const { data: wines } = await supabase
      .from('supplier_wines')
      .select('id, sku, name, producer, vintage, country, region, color, grape, bottle_size_ml, price_ex_vat_sek, stock_qty, case_size, moq, alcohol_pct, organic, biodynamic, is_active, created_at, description')
      .eq('supplier_id', supplierId)
      .order('producer', { ascending: true });

    // Get orders for this supplier
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Wine stats (computed from the full wines query above — no extra DB call)
    const wineStats = {
      total: wines?.length || 0,
      active: wines?.filter(w => w.is_active !== false).length || 0,
      byColor: {} as Record<string, number>,
    };

    wines?.forEach(w => {
      const color = w.color || 'unknown';
      wineStats.byColor[color] = (wineStats.byColor[color] || 0) + 1;
    });

    return NextResponse.json({
      supplier: {
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
      },
      users: usersWithDetails,
      wineStats,
      wines: wines?.map(w => ({
        id: w.id,
        sku: w.sku,
        name: w.name,
        producer: w.producer,
        vintage: w.vintage,
        country: w.country,
        region: w.region,
        color: w.color,
        grape: w.grape,
        bottleSizeMl: w.bottle_size_ml,
        priceSek: w.price_ex_vat_sek ? Math.round(w.price_ex_vat_sek / 100) : null,
        stockQty: w.stock_qty,
        caseSize: w.case_size,
        moq: w.moq,
        alcoholPct: w.alcohol_pct,
        organic: w.organic,
        biodynamic: w.biodynamic,
        isActive: w.is_active !== false,
        createdAt: w.created_at,
        description: w.description || null,
      })) || [],
      recentOrders: orders?.map(o => ({
        id: o.id,
        status: o.status,
        createdAt: o.created_at,
      })) || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
