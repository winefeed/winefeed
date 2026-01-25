/**
 * ADMIN COMPLIANCE EXPORT API
 *
 * GET /api/admin/compliance/export
 *
 * Exports compliance data as CSV for accounting/auditing.
 *
 * Query Parameters:
 * - startDate: ISO date string (YYYY-MM-DD)
 * - endDate: ISO date string (YYYY-MM-DD)
 * - reportType: 'alcohol-tax' | 'vat' | 'transactions'
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

const ALCOHOL_TAX_RATE_PER_LITER_PURE = 56.32;
const VAT_RATE = 0.25;

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

    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const defaultEndDate = now.toISOString().split('T')[0];

    const startDate = searchParams.get('startDate') || defaultStartDate;
    const endDate = searchParams.get('endDate') || defaultEndDate;
    const reportType = searchParams.get('reportType') || 'transactions';

    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Fetch orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        restaurant_id,
        seller_supplier_id,
        importer_of_record_id,
        total_goods_amount_ore,
        shipping_cost_ore,
        total_order_value_ore,
        delivery_city
      `)
      .eq('tenant_id', tenantId)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .in('status', ['CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED'])
      .order('created_at', { ascending: true });

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    const orderIds = (orders || []).map((o) => o.id);

    // Fetch order lines
    let orderLines: any[] = [];
    if (orderIds.length > 0) {
      const { data: lines } = await supabase
        .from('order_lines')
        .select(`
          id,
          order_id,
          wine_sku_id,
          wine_name,
          producer,
          vintage,
          country,
          quantity,
          unit_price_sek,
          total_price_sek
        `)
        .in('order_id', orderIds);
      orderLines = lines || [];
    }

    // Fetch wine details
    const wineSkuIds = [...new Set(orderLines.filter((l) => l.wine_sku_id).map((l) => l.wine_sku_id))];
    let wineDetails = new Map<string, { alcohol_pct: number | null; bottle_size_ml: number }>();

    if (wineSkuIds.length > 0) {
      const { data: supplierWines } = await supabase
        .from('supplier_wines')
        .select('id, alcohol_pct, bottle_size_ml')
        .in('id', wineSkuIds);

      if (supplierWines) {
        for (const wine of supplierWines) {
          wineDetails.set(wine.id, {
            alcohol_pct: wine.alcohol_pct,
            bottle_size_ml: wine.bottle_size_ml || 750
          });
        }
      }
    }

    // Fetch entity names
    const restaurantIds = [...new Set((orders || []).map((o) => o.restaurant_id))];
    const supplierIds = [...new Set((orders || []).map((o) => o.seller_supplier_id))];
    const importerIds = [...new Set((orders || []).map((o) => o.importer_of_record_id))];

    const [restaurantsResult, suppliersResult, importersResult] = await Promise.all([
      supabase.from('restaurants').select('id, name, org_number').in('id', restaurantIds.length > 0 ? restaurantIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('suppliers').select('id, namn, org_number, type').in('id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('importers').select('id, legal_name, org_number').in('id', importerIds.length > 0 ? importerIds : ['00000000-0000-0000-0000-000000000000'])
    ]);

    const restaurantMap = new Map((restaurantsResult.data || []).map((r) => [r.id, r]));
    const supplierMap = new Map((suppliersResult.data || []).map((s) => [s.id, s]));
    const importerMap = new Map((importersResult.data || []).map((i) => [i.id, i]));

    // Build CSV based on report type
    let csvContent: string;
    let filename: string;

    switch (reportType) {
      case 'alcohol-tax':
        csvContent = buildAlcoholTaxCsv(orders || [], orderLines, wineDetails, supplierMap, importerMap);
        filename = `alkoholskatt-${startDate}-till-${endDate}.csv`;
        break;

      case 'vat':
        csvContent = buildVatCsv(orders || [], restaurantMap, supplierMap);
        filename = `moms-${startDate}-till-${endDate}.csv`;
        break;

      case 'transactions':
      default:
        csvContent = buildTransactionsCsv(orders || [], orderLines, restaurantMap, supplierMap, importerMap);
        filename = `transaktioner-${startDate}-till-${endDate}.csv`;
        break;
    }

    // Add BOM for Excel
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('Error exporting compliance data:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function escapeCsvField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildAlcoholTaxCsv(
  orders: any[],
  orderLines: any[],
  wineDetails: Map<string, { alcohol_pct: number | null; bottle_size_ml: number }>,
  supplierMap: Map<string, any>,
  importerMap: Map<string, any>
): string {
  const headers = [
    'Orderdatum',
    'Order-ID',
    'Leverantör',
    'Leverantörstyp',
    'Importör',
    'Importör Orgnr',
    'Vin',
    'Producent',
    'Antal flaskor',
    'Flaskstorlek (ml)',
    'Alkohol (%)',
    'Liter vin',
    'Liter ren alkohol',
    'Alkoholskatt (SEK)'
  ];

  const rows: string[][] = [];

  // Group lines by order
  const linesByOrder = new Map<string, any[]>();
  for (const line of orderLines) {
    if (!linesByOrder.has(line.order_id)) {
      linesByOrder.set(line.order_id, []);
    }
    linesByOrder.get(line.order_id)!.push(line);
  }

  for (const order of orders) {
    const lines = linesByOrder.get(order.id) || [];
    const supplier = supplierMap.get(order.seller_supplier_id);
    const importer = importerMap.get(order.importer_of_record_id);

    for (const line of lines) {
      const wineInfo = wineDetails.get(line.wine_sku_id) || { alcohol_pct: 13, bottle_size_ml: 750 };
      const alcoholPct = wineInfo.alcohol_pct || 13;
      const bottleSizeMl = wineInfo.bottle_size_ml || 750;

      const litersWine = (line.quantity * bottleSizeMl) / 1000;
      const litersPureAlcohol = litersWine * (alcoholPct / 100);
      const alcoholTax = litersPureAlcohol * ALCOHOL_TAX_RATE_PER_LITER_PURE;

      rows.push([
        new Date(order.created_at).toLocaleDateString('sv-SE'),
        order.id,
        supplier?.namn || 'Okänd',
        supplier?.type || '',
        importer?.legal_name || 'Okänd',
        importer?.org_number || '',
        line.wine_name,
        line.producer || '',
        line.quantity.toString(),
        bottleSizeMl.toString(),
        alcoholPct.toFixed(1),
        litersWine.toFixed(2),
        litersPureAlcohol.toFixed(3),
        alcoholTax.toFixed(2)
      ]);
    }
  }

  // Add totals row
  if (rows.length > 0) {
    const totalLitersWine = rows.reduce((sum, r) => sum + parseFloat(r[11] || '0'), 0);
    const totalLitersPureAlcohol = rows.reduce((sum, r) => sum + parseFloat(r[12] || '0'), 0);
    const totalAlcoholTax = rows.reduce((sum, r) => sum + parseFloat(r[13] || '0'), 0);

    rows.push([]);
    rows.push([
      'TOTALT', '', '', '', '', '', '', '',
      rows.filter(r => r.length > 0).reduce((sum, r) => sum + parseInt(r[8] || '0'), 0).toString(),
      '', '',
      totalLitersWine.toFixed(2),
      totalLitersPureAlcohol.toFixed(3),
      totalAlcoholTax.toFixed(2)
    ]);
  }

  return [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(','))
  ].join('\n');
}

function buildVatCsv(
  orders: any[],
  restaurantMap: Map<string, any>,
  supplierMap: Map<string, any>
): string {
  const headers = [
    'Orderdatum',
    'Order-ID',
    'Restaurang',
    'Restaurang Orgnr',
    'Leverantör',
    'Varor exkl moms (SEK)',
    'Moms 25% (SEK)',
    'Totalt inkl moms (SEK)'
  ];

  const rows: string[][] = [];

  for (const order of orders) {
    const restaurant = restaurantMap.get(order.restaurant_id);
    const supplier = supplierMap.get(order.seller_supplier_id);
    const goodsSek = (order.total_goods_amount_ore || 0) / 100;
    const vatSek = goodsSek * VAT_RATE;

    rows.push([
      new Date(order.created_at).toLocaleDateString('sv-SE'),
      order.id,
      restaurant?.name || 'Okänd',
      restaurant?.org_number || '',
      supplier?.namn || 'Okänd',
      goodsSek.toFixed(2),
      vatSek.toFixed(2),
      (goodsSek + vatSek).toFixed(2)
    ]);
  }

  // Add totals
  if (rows.length > 0) {
    const totalGoods = rows.reduce((sum, r) => sum + parseFloat(r[5] || '0'), 0);
    const totalVat = rows.reduce((sum, r) => sum + parseFloat(r[6] || '0'), 0);
    const totalInclVat = rows.reduce((sum, r) => sum + parseFloat(r[7] || '0'), 0);

    rows.push([]);
    rows.push([
      'TOTALT', '', '', '', '',
      totalGoods.toFixed(2),
      totalVat.toFixed(2),
      totalInclVat.toFixed(2)
    ]);
  }

  return [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(','))
  ].join('\n');
}

function buildTransactionsCsv(
  orders: any[],
  orderLines: any[],
  restaurantMap: Map<string, any>,
  supplierMap: Map<string, any>,
  importerMap: Map<string, any>
): string {
  const headers = [
    'Orderdatum',
    'Order-ID',
    'Status',
    'Restaurang',
    'Restaurang Orgnr',
    'Leverantör',
    'Leverantör Orgnr',
    'Leverantörstyp',
    'Importör',
    'Importör Orgnr',
    'Leveransort',
    'Vin',
    'Producent',
    'Årgång',
    'Land',
    'Antal',
    'Á-pris (SEK)',
    'Radtotal (SEK)'
  ];

  const rows: string[][] = [];

  // Group lines by order
  const linesByOrder = new Map<string, any[]>();
  for (const line of orderLines) {
    if (!linesByOrder.has(line.order_id)) {
      linesByOrder.set(line.order_id, []);
    }
    linesByOrder.get(line.order_id)!.push(line);
  }

  for (const order of orders) {
    const lines = linesByOrder.get(order.id) || [];
    const restaurant = restaurantMap.get(order.restaurant_id);
    const supplier = supplierMap.get(order.seller_supplier_id);
    const importer = importerMap.get(order.importer_of_record_id);

    for (const line of lines) {
      rows.push([
        new Date(order.created_at).toLocaleDateString('sv-SE'),
        order.id,
        order.status,
        restaurant?.name || 'Okänd',
        restaurant?.org_number || '',
        supplier?.namn || 'Okänd',
        supplier?.org_number || '',
        supplier?.type || '',
        importer?.legal_name || 'Okänd',
        importer?.org_number || '',
        order.delivery_city || '',
        line.wine_name,
        line.producer || '',
        line.vintage || '',
        line.country || '',
        line.quantity.toString(),
        (line.unit_price_sek || 0).toFixed(2),
        (line.total_price_sek || 0).toFixed(2)
      ]);
    }
  }

  // Add totals
  if (rows.length > 0) {
    const totalQuantity = rows.reduce((sum, r) => sum + parseInt(r[15] || '0'), 0);
    const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r[17] || '0'), 0);

    rows.push([]);
    rows.push([
      'TOTALT', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      totalQuantity.toString(),
      '',
      totalAmount.toFixed(2)
    ]);
  }

  return [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(','))
  ].join('\n');
}
