/**
 * ADMIN ORDER REPORTS API
 *
 * GET /api/admin/orders/reports
 *
 * Returns aggregated order value data for billing/invoicing.
 *
 * Query Parameters:
 * - startDate: ISO date string (YYYY-MM-DD) - start of period (default: first day of current month)
 * - endDate: ISO date string (YYYY-MM-DD) - end of period (default: today)
 * - groupBy: 'restaurant' | 'supplier' | 'month' | 'none' (default: 'none')
 * - status: Filter by order status (optional)
 *
 * Security:
 * - Requires ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface OrderReportRow {
  id: string;
  created_at: string;
  status: string;
  restaurant_id: string;
  restaurant_name: string;
  seller_supplier_id: string;
  supplier_name: string;
  total_goods_amount_ore: number | null;
  shipping_cost_ore: number | null;
  total_order_value_ore: number | null;
  service_fee_mode: string;
  service_fee_amount_ore: number;
  currency: string;
}

interface AggregatedGroup {
  group_key: string;
  group_name: string;
  order_count: number;
  total_goods_sek: number;
  total_shipping_sek: number;
  total_order_value_sek: number;
  total_service_fee_sek: number;
}

export async function GET(request: NextRequest) {
  try {
    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Resolve actor context
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    // Verify ADMIN access
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Access denied: ADMIN role required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    // Default to current month
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];

    const startDate = searchParams.get('startDate') || defaultStartDate;
    const endDate = searchParams.get('endDate') || defaultEndDate;
    const groupBy = searchParams.get('groupBy') || 'none';
    const status = searchParams.get('status') || undefined;

    // Validate groupBy
    const validGroupBy = ['restaurant', 'supplier', 'month', 'none'];
    if (!validGroupBy.includes(groupBy)) {
      return NextResponse.json(
        { error: `Invalid groupBy. Must be one of: ${validGroupBy.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        restaurant_id,
        seller_supplier_id,
        total_goods_amount_ore,
        shipping_cost_ore,
        total_order_value_ore,
        service_fee_mode,
        service_fee_amount_ore,
        currency
      `)
      .eq('tenant_id', tenantId)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    // Fetch restaurant and supplier names
    const restaurantIds = [...new Set((orders || []).map((o) => o.restaurant_id))];
    const supplierIds = [...new Set((orders || []).map((o) => o.seller_supplier_id))];

    const [restaurantsResult, suppliersResult] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id, name')
        .in('id', restaurantIds.length > 0 ? restaurantIds : ['00000000-0000-0000-0000-000000000000']),
      supabase
        .from('suppliers')
        .select('id, namn')
        .in('id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000'])
    ]);

    const restaurantMap = new Map(
      (restaurantsResult.data || []).map((r) => [r.id, r.name])
    );
    const supplierMap = new Map(
      (suppliersResult.data || []).map((s) => [s.id, s.namn])
    );

    // Build enriched orders
    const enrichedOrders: OrderReportRow[] = (orders || []).map((order) => ({
      id: order.id,
      created_at: order.created_at,
      status: order.status,
      restaurant_id: order.restaurant_id,
      restaurant_name: restaurantMap.get(order.restaurant_id) || 'Okänd',
      seller_supplier_id: order.seller_supplier_id,
      supplier_name: supplierMap.get(order.seller_supplier_id) || 'Okänd',
      total_goods_amount_ore: order.total_goods_amount_ore,
      shipping_cost_ore: order.shipping_cost_ore,
      total_order_value_ore: order.total_order_value_ore,
      service_fee_mode: order.service_fee_mode,
      service_fee_amount_ore: order.service_fee_amount_ore || 0,
      currency: order.currency
    }));

    // Calculate totals
    const totals = {
      order_count: enrichedOrders.length,
      total_goods_sek: enrichedOrders.reduce(
        (sum, o) => sum + (o.total_goods_amount_ore || 0) / 100,
        0
      ),
      total_shipping_sek: enrichedOrders.reduce(
        (sum, o) => sum + (o.shipping_cost_ore || 0) / 100,
        0
      ),
      total_order_value_sek: enrichedOrders.reduce(
        (sum, o) => sum + (o.total_order_value_ore || 0) / 100,
        0
      ),
      total_service_fee_sek: enrichedOrders.reduce(
        (sum, o) => sum + (o.service_fee_amount_ore || 0) / 100,
        0
      )
    };

    // Group data if requested
    let groupedData: AggregatedGroup[] | null = null;

    if (groupBy !== 'none') {
      const groups = new Map<string, AggregatedGroup>();

      for (const order of enrichedOrders) {
        let groupKey: string;
        let groupName: string;

        switch (groupBy) {
          case 'restaurant':
            groupKey = order.restaurant_id;
            groupName = order.restaurant_name;
            break;
          case 'supplier':
            groupKey = order.seller_supplier_id;
            groupName = order.supplier_name;
            break;
          case 'month':
            const date = new Date(order.created_at);
            groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            groupName = date.toLocaleString('sv-SE', { year: 'numeric', month: 'long' });
            break;
          default:
            groupKey = 'all';
            groupName = 'Alla';
        }

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            group_key: groupKey,
            group_name: groupName,
            order_count: 0,
            total_goods_sek: 0,
            total_shipping_sek: 0,
            total_order_value_sek: 0,
            total_service_fee_sek: 0
          });
        }

        const group = groups.get(groupKey)!;
        group.order_count += 1;
        group.total_goods_sek += (order.total_goods_amount_ore || 0) / 100;
        group.total_shipping_sek += (order.shipping_cost_ore || 0) / 100;
        group.total_order_value_sek += (order.total_order_value_ore || 0) / 100;
        group.total_service_fee_sek += (order.service_fee_amount_ore || 0) / 100;
      }

      groupedData = Array.from(groups.values()).sort((a, b) =>
        b.total_order_value_sek - a.total_order_value_sek
      );
    }

    return NextResponse.json({
      period: {
        start_date: startDate,
        end_date: endDate
      },
      totals,
      grouped_by: groupBy,
      groups: groupedData,
      orders: enrichedOrders
    });
  } catch (error: any) {
    console.error('Error generating order report:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
