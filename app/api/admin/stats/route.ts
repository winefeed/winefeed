/**
 * ADMIN STATS API
 *
 * GET /api/admin/stats
 *
 * Returns comprehensive overview stats for admin dashboard
 * Shows all suppliers and wines in the system
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
    // Auth check
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
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, namn, type, is_active, kontakt_email, telefon, hemsida, org_number, created_at')
      .order('created_at', { ascending: false });

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
      return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }

    // Get all wines from supplier_wines table
    const { data: wines, error: winesError } = await supabase
      .from('supplier_wines')
      .select('id, supplier_id, name, producer, color, price_ex_vat_sek, stock_qty, moq, created_at, is_active');

    if (winesError) {
      console.error('Error fetching wines:', winesError);
      return NextResponse.json({ error: 'Failed to fetch wines', details: winesError.message }, { status: 500 });
    }

    // Get all supplier users
    const { data: supplierUsers, error: usersError } = await supabase
      .from('supplier_users')
      .select('id, user_id, supplier_id, created_at');

    // Get all restaurants
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, created_at');

    // Get all orders with status
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .order('created_at', { ascending: false });

    // Get all requests with status
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('id, status, created_at')
      .order('created_at', { ascending: false });

    // Get all offers with status
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id, status, created_at')
      .order('created_at', { ascending: false });

    // Calculate stats per supplier
    const supplierStats = suppliers?.map(supplier => {
      const supplierWines = wines?.filter(w => w.supplier_id === supplier.id) || [];
      const activeWines = supplierWines.filter(w => w.is_active !== false);
      const users = supplierUsers?.filter(u => u.supplier_id === supplier.id) || [];

      // Wine breakdown by color
      const colorBreakdown: Record<string, number> = {};
      supplierWines.forEach(wine => {
        const color = wine.color || 'unknown';
        colorBreakdown[color] = (colorBreakdown[color] || 0) + 1;
      });

      // Calculate average price (convert from öre to SEK)
      const avgPrice = supplierWines.length > 0
        ? Math.round(supplierWines.reduce((sum, w) => sum + (w.price_ex_vat_sek || 0), 0) / supplierWines.length / 100)
        : 0;

      return {
        id: supplier.id,
        name: supplier.namn,
        type: supplier.type,
        isActive: supplier.is_active,
        email: supplier.kontakt_email,
        phone: supplier.telefon,
        website: supplier.hemsida,
        orgNumber: supplier.org_number,
        createdAt: supplier.created_at,
        totalWines: supplierWines.length,
        activeWines: activeWines.length,
        userCount: users.length,
        avgPriceSek: avgPrice,
        colorBreakdown,
      };
    }) || [];

    // Total stats
    const totalWines = wines?.length || 0;
    const activeWines = wines?.filter(w => w.is_active !== false).length || 0;
    const totalSuppliers = suppliers?.length || 0;
    const activeSuppliers = suppliers?.filter(s => s.is_active !== false).length || 0;
    const totalUsers = supplierUsers?.length || 0;
    const totalRestaurants = restaurants?.length || 0;

    // Order stats
    const orderStats = {
      total: orders?.length || 0,
      pending: orders?.filter(o => o.status === 'PENDING_SUPPLIER_CONFIRMATION').length || 0,
      confirmed: orders?.filter(o => o.status === 'CONFIRMED').length || 0,
      inFulfillment: orders?.filter(o => o.status === 'IN_FULFILLMENT').length || 0,
      shipped: orders?.filter(o => o.status === 'SHIPPED').length || 0,
      delivered: orders?.filter(o => o.status === 'DELIVERED').length || 0,
      cancelled: orders?.filter(o => o.status === 'CANCELLED').length || 0,
    };

    // Request stats
    const requestStats = {
      total: requests?.length || 0,
      open: requests?.filter(r => r.status === 'OPEN').length || 0,
      closed: requests?.filter(r => r.status === 'CLOSED' || r.status === 'ACCEPTED').length || 0,
    };

    // Offer stats
    const offerStats = {
      total: offers?.length || 0,
      draft: offers?.filter(o => o.status === 'DRAFT').length || 0,
      sent: offers?.filter(o => o.status === 'SENT').length || 0,
      accepted: offers?.filter(o => o.status === 'ACCEPTED').length || 0,
      rejected: offers?.filter(o => o.status === 'REJECTED').length || 0,
    };

    // Recent orders (last 5)
    const recentOrders = orders?.slice(0, 5).map(order => ({
      id: order.id,
      status: order.status,
      created_at: order.created_at,
    })) || [];

    // Recent wines (last 10)
    const recentWines = wines
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(wine => {
        const supplier = suppliers?.find(s => s.id === wine.supplier_id);
        return {
          id: wine.id,
          name: wine.name,
          producer: wine.producer,
          color: wine.color,
          priceSek: wine.price_ex_vat_sek ? Math.round(wine.price_ex_vat_sek / 100) : null,
          supplierName: supplier?.namn || 'Okänd',
          createdAt: wine.created_at,
        };
      }) || [];

    // Wine color distribution (total)
    const colorDistribution: Record<string, number> = {};
    wines?.forEach(wine => {
      const color = wine.color || 'unknown';
      colorDistribution[color] = (colorDistribution[color] || 0) + 1;
    });

    // Type distribution
    const typeLabels: Record<string, string> = {
      'SWEDISH_IMPORTER': 'Svensk importör',
      'EU_PRODUCER': 'EU-producent',
      'EU_IMPORTER': 'EU-importör',
    };

    const typeDistribution: Record<string, { count: number; label: string }> = {};
    suppliers?.forEach(supplier => {
      const type = supplier.type || 'unknown';
      if (!typeDistribution[type]) {
        typeDistribution[type] = { count: 0, label: typeLabels[type] || type };
      }
      typeDistribution[type].count++;
    });

    return NextResponse.json({
      overview: {
        totalSuppliers,
        activeSuppliers,
        totalWines,
        activeWines,
        totalUsers,
        totalRestaurants,
      },
      orders: orderStats,
      requests: requestStats,
      offers: offerStats,
      suppliers: supplierStats,
      recentWines,
      recentOrders,
      colorDistribution,
      typeDistribution,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
