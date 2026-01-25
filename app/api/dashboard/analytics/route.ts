/**
 * GET /api/dashboard/analytics
 *
 * Restaurant analytics endpoint
 * Returns aggregated data for restaurant dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { actorService } from '@/lib/actor-service';

interface MonthlyData {
  month: string;
  count: number;
  amount: number;
}

interface TopSupplier {
  supplier_id: string;
  supplier_name: string;
  total_amount: number;
  order_count: number;
  avg_delivery_days: number | null;
  acceptance_rate: number | null;
}

interface WineTypeData {
  type: string;
  count: number;
  quantity: number;
}

interface AnalyticsResponse {
  // Summary stats
  total_requests: number;
  total_orders: number;
  total_spent: number;
  total_budget: number;
  savings: number;
  avg_delivery_days: number | null;

  // Monthly breakdown
  requests_by_month: MonthlyData[];
  spending_by_month: MonthlyData[];

  // Top data
  top_suppliers: TopSupplier[];
  top_wine_types: WineTypeData[];

  // Period
  period: {
    start: string;
    end: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    if (!actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Access denied: Restaurant or Admin role required' },
        { status: 403 }
      );
    }

    const restaurantId = actor.restaurant_id;
    if (!restaurantId && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'No restaurant associated with this user' },
        { status: 400 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12', 10);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const supabase = getSupabaseAdmin();

    // Build restaurant filter
    const restaurantFilter = actorService.hasRole(actor, 'ADMIN')
      ? {}
      : { restaurant_id: restaurantId };

    // 1. Get requests
    let requestsQuery = supabase
      .from('requests')
      .select('id, budget_per_flaska, antal_flaskor, created_at, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (restaurantId) {
      requestsQuery = requestsQuery.eq('restaurant_id', restaurantId);
    }

    const { data: requests, error: requestsError } = await requestsQuery;

    if (requestsError) {
      console.error('Failed to fetch requests:', requestsError);
      throw new Error('Failed to fetch requests');
    }

    // 2. Get orders with supplier info
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        seller_supplier_id,
        total_goods_amount_ore,
        total_order_value_ore,
        shipping_cost_ore,
        status,
        created_at,
        updated_at
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (restaurantId) {
      ordersQuery = ordersQuery.eq('restaurant_id', restaurantId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Failed to fetch orders:', ordersError);
      throw new Error('Failed to fetch orders');
    }

    // 3. Get supplier names
    const supplierIds = [...new Set(orders?.map(o => o.seller_supplier_id) || [])];
    let suppliersMap: Record<string, string> = {};

    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);

      if (suppliers) {
        suppliersMap = suppliers.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {});
      }
    }

    // 4. Get offer lines for wine types (from accepted offers)
    const orderOfferIds = orders?.map(o => o.id) || [];
    let wineTypes: WineTypeData[] = [];

    if (orderOfferIds.length > 0) {
      // Get offer_ids from orders
      const { data: orderDetails } = await supabase
        .from('orders')
        .select('offer_id')
        .in('id', orderOfferIds);

      const offerIds = orderDetails?.map(o => o.offer_id).filter(Boolean) || [];

      if (offerIds.length > 0) {
        const { data: offerLines } = await supabase
          .from('offer_lines')
          .select('wine_type, quantity')
          .in('offer_id', offerIds);

        if (offerLines) {
          const typeMap: Record<string, { count: number; quantity: number }> = {};
          offerLines.forEach(line => {
            const type = line.wine_type || 'Okänd';
            if (!typeMap[type]) {
              typeMap[type] = { count: 0, quantity: 0 };
            }
            typeMap[type].count++;
            typeMap[type].quantity += line.quantity || 0;
          });
          wineTypes = Object.entries(typeMap)
            .map(([type, data]) => ({ type, ...data }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        }
      }
    }

    // 5. Get quote request assignments for acceptance rate
    let acceptanceRates: Record<string, { sent: number; accepted: number }> = {};

    if (supplierIds.length > 0) {
      const { data: assignments } = await supabase
        .from('quote_request_assignments')
        .select('supplier_id, status')
        .in('supplier_id', supplierIds);

      if (assignments) {
        assignments.forEach(a => {
          if (!acceptanceRates[a.supplier_id]) {
            acceptanceRates[a.supplier_id] = { sent: 0, accepted: 0 };
          }
          acceptanceRates[a.supplier_id].sent++;
          if (a.status === 'OFFER_SUBMITTED') {
            acceptanceRates[a.supplier_id].accepted++;
          }
        });
      }
    }

    // Calculate aggregates
    const totalRequests = requests?.length || 0;
    const totalOrders = orders?.length || 0;

    const totalSpent = orders?.reduce((sum, o) => sum + (o.total_order_value_ore || 0), 0) || 0;
    const totalBudget = requests?.reduce((sum, r) => {
      const budget = (r.budget_per_flaska || 0) * (r.antal_flaskor || 0) * 100; // Convert to öre
      return sum + budget;
    }, 0) || 0;

    // Calculate delivery times (from CONFIRMED to DELIVERED)
    const deliveredOrders = orders?.filter(o => o.status === 'DELIVERED') || [];
    let avgDeliveryDays: number | null = null;

    if (deliveredOrders.length > 0) {
      // For now, estimate based on created_at to updated_at
      const deliveryDays = deliveredOrders.map(o => {
        const created = new Date(o.created_at);
        const updated = new Date(o.updated_at);
        return Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      });
      avgDeliveryDays = Math.round(deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length);
    }

    // Monthly breakdown
    const requestsByMonth: Record<string, number> = {};
    const spendingByMonth: Record<string, number> = {};

    requests?.forEach(r => {
      const month = r.created_at.substring(0, 7); // YYYY-MM
      requestsByMonth[month] = (requestsByMonth[month] || 0) + 1;
    });

    orders?.forEach(o => {
      const month = o.created_at.substring(0, 7); // YYYY-MM
      spendingByMonth[month] = (spendingByMonth[month] || 0) + (o.total_order_value_ore || 0);
    });

    // Top suppliers
    const supplierStats: Record<string, {
      total: number;
      count: number;
      deliveryDays: number[];
    }> = {};

    orders?.forEach(o => {
      const sid = o.seller_supplier_id;
      if (!supplierStats[sid]) {
        supplierStats[sid] = { total: 0, count: 0, deliveryDays: [] };
      }
      supplierStats[sid].total += o.total_order_value_ore || 0;
      supplierStats[sid].count++;

      if (o.status === 'DELIVERED') {
        const created = new Date(o.created_at);
        const updated = new Date(o.updated_at);
        const days = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        supplierStats[sid].deliveryDays.push(days);
      }
    });

    const topSuppliers: TopSupplier[] = Object.entries(supplierStats)
      .map(([sid, stats]) => ({
        supplier_id: sid,
        supplier_name: suppliersMap[sid] || 'Okänd leverantör',
        total_amount: stats.total,
        order_count: stats.count,
        avg_delivery_days: stats.deliveryDays.length > 0
          ? Math.round(stats.deliveryDays.reduce((a, b) => a + b, 0) / stats.deliveryDays.length)
          : null,
        acceptance_rate: acceptanceRates[sid]
          ? Math.round((acceptanceRates[sid].accepted / acceptanceRates[sid].sent) * 100)
          : null,
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 5);

    // Format monthly data
    const allMonths = new Set([...Object.keys(requestsByMonth), ...Object.keys(spendingByMonth)]);
    const sortedMonths = Array.from(allMonths).sort();

    const response: AnalyticsResponse = {
      total_requests: totalRequests,
      total_orders: totalOrders,
      total_spent: totalSpent,
      total_budget: totalBudget,
      savings: totalBudget - totalSpent,
      avg_delivery_days: avgDeliveryDays,

      requests_by_month: sortedMonths.map(month => ({
        month,
        count: requestsByMonth[month] || 0,
        amount: 0,
      })),
      spending_by_month: sortedMonths.map(month => ({
        month,
        count: 0,
        amount: spendingByMonth[month] || 0,
      })),

      top_suppliers: topSuppliers,
      top_wine_types: wineTypes,

      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    );
  }
}
