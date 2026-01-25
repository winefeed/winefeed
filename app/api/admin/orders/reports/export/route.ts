/**
 * ADMIN ORDER REPORTS CSV EXPORT
 *
 * GET /api/admin/orders/reports/export
 *
 * Exports order data as CSV file.
 *
 * Query Parameters:
 * - startDate: ISO date string (YYYY-MM-DD) - start of period (default: first day of current month)
 * - endDate: ISO date string (YYYY-MM-DD) - end of period (default: today)
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
    const status = searchParams.get('status') || undefined;

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
        currency,
        delivery_city
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
        .select('id, name, org_number')
        .in('id', restaurantIds.length > 0 ? restaurantIds : ['00000000-0000-0000-0000-000000000000']),
      supabase
        .from('suppliers')
        .select('id, namn, org_number')
        .in('id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000'])
    ]);

    const restaurantMap = new Map(
      (restaurantsResult.data || []).map((r) => [r.id, { name: r.name, org_number: r.org_number }])
    );
    const supplierMap = new Map(
      (suppliersResult.data || []).map((s) => [s.id, { name: s.namn, org_number: s.org_number }])
    );

    // Build CSV
    const csvHeaders = [
      'Order-ID',
      'Skapad',
      'Status',
      'Restaurang',
      'Restaurang Orgnr',
      'Leverantör',
      'Leverantör Orgnr',
      'Leveransort',
      'Varubelopp (SEK)',
      'Frakt (SEK)',
      'Totalt ordervärde (SEK)',
      'Avgiftsläge',
      'Serviceavgift (SEK)',
      'Valuta'
    ];

    const csvRows = (orders || []).map((order) => {
      const restaurant = restaurantMap.get(order.restaurant_id) || { name: 'Okänd', org_number: '' };
      const supplier = supplierMap.get(order.seller_supplier_id) || { name: 'Okänd', org_number: '' };

      return [
        order.id,
        new Date(order.created_at).toLocaleDateString('sv-SE'),
        order.status,
        restaurant.name,
        restaurant.org_number || '',
        supplier.name,
        supplier.org_number || '',
        order.delivery_city || '',
        ((order.total_goods_amount_ore || 0) / 100).toFixed(2),
        ((order.shipping_cost_ore || 0) / 100).toFixed(2),
        ((order.total_order_value_ore || 0) / 100).toFixed(2),
        order.service_fee_mode || 'PILOT_FREE',
        ((order.service_fee_amount_ore || 0) / 100).toFixed(2),
        order.currency || 'SEK'
      ];
    });

    // Add totals row
    const totalGoods = (orders || []).reduce((sum, o) => sum + (o.total_goods_amount_ore || 0), 0) / 100;
    const totalShipping = (orders || []).reduce((sum, o) => sum + (o.shipping_cost_ore || 0), 0) / 100;
    const totalOrderValue = (orders || []).reduce((sum, o) => sum + (o.total_order_value_ore || 0), 0) / 100;
    const totalServiceFee = (orders || []).reduce((sum, o) => sum + (o.service_fee_amount_ore || 0), 0) / 100;

    csvRows.push([]);  // Empty row
    csvRows.push([
      'TOTALT',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalGoods.toFixed(2),
      totalShipping.toFixed(2),
      totalOrderValue.toFixed(2),
      '',
      totalServiceFee.toFixed(2),
      ''
    ]);

    // Convert to CSV string
    const escapeCsvField = (field: string | number) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      csvHeaders.map(escapeCsvField).join(','),
      ...csvRows.map((row) => row.map(escapeCsvField).join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // Generate filename
    const filename = `winefeed-ordrar-${startDate}-till-${endDate}.csv`;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('Error exporting order report:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
