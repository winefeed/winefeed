/**
 * ADMIN COMPLIANCE REPORTS API
 *
 * GET /api/admin/compliance
 *
 * Returns compliance data for tax reporting and auditing.
 *
 * Query Parameters:
 * - startDate: ISO date string (YYYY-MM-DD)
 * - endDate: ISO date string (YYYY-MM-DD)
 * - reportType: 'alcohol-tax' | 'vat' | 'imports' | 'transactions' | 'summary'
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

// Swedish alcohol tax rates (2026) - SEK per liter of pure alcohol
// Source: Skatteverket
const ALCOHOL_TAX_RATE_PER_LITER_PURE = 56.32; // SEK per liter of pure alcohol for still wine

// VAT rate for wine in Sweden
const VAT_RATE = 0.25; // 25%

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
    const reportType = searchParams.get('reportType') || 'summary';

    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Fetch orders with lines for the period
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        restaurant_id,
        seller_supplier_id,
        importer_of_record_id,
        import_case_id,
        total_goods_amount_ore,
        shipping_cost_ore,
        total_order_value_ore,
        currency,
        delivery_city
      `)
      .eq('tenant_id', tenantId)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .in('status', ['CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED'])
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('[Compliance] Orders query failed:', ordersError);
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    const orderIds = (orders || []).map((o) => o.id);

    // Fetch order lines with wine details
    let orderLines: any[] = [];
    if (orderIds.length > 0) {
      const { data: lines, error: linesError } = await supabase
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

      if (linesError) {
        throw new Error(`Failed to fetch order lines: ${linesError.message}`);
      }
      orderLines = lines || [];
    }

    // Fetch wine details for alcohol % and bottle size
    const wineSkuIds = [...new Set(orderLines.filter((l) => l.wine_sku_id).map((l) => l.wine_sku_id))];
    let wineDetails = new Map<string, { alcohol_pct: number | null; bottle_size_ml: number }>();

    if (wineSkuIds.length > 0) {
      // First try wine_skus table
      const { data: skus } = await supabase
        .from('wine_skus')
        .select('id, bottle_ml')
        .in('id', wineSkuIds);

      // Then get supplier_wines for alcohol_pct
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

      if (skus) {
        for (const sku of skus) {
          if (!wineDetails.has(sku.id)) {
            wineDetails.set(sku.id, {
              alcohol_pct: null,
              bottle_size_ml: sku.bottle_ml || 750
            });
          }
        }
      }
    }

    // Fetch entity names
    const restaurantIds = [...new Set((orders || []).map((o) => o.restaurant_id))];
    const supplierIds = [...new Set((orders || []).map((o) => o.seller_supplier_id))];
    const importerIds = [...new Set((orders || []).map((o) => o.importer_of_record_id))];

    // Fetch entity names with error handling
    const restaurantsResult = await supabase
      .from('restaurants')
      .select('id, name, org_number')
      .in('id', restaurantIds.length > 0 ? restaurantIds : ['00000000-0000-0000-0000-000000000000']);

    if (restaurantsResult.error) {
      console.error('[Compliance] Restaurants query failed:', restaurantsResult.error);
      throw new Error(`Failed to fetch restaurants: ${restaurantsResult.error.message}`);
    }

    const suppliersResult = await supabase
      .from('suppliers')
      .select('id, namn, org_number, type')
      .in('id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000']);

    if (suppliersResult.error) {
      console.error('[Compliance] Suppliers query failed:', suppliersResult.error);
      throw new Error(`Failed to fetch suppliers: ${suppliersResult.error.message}`);
    }

    const importersResult = await supabase
      .from('importers')
      .select('id, legal_name, org_number')
      .in('id', importerIds.length > 0 ? importerIds : ['00000000-0000-0000-0000-000000000000']);

    if (importersResult.error) {
      console.error('[Compliance] Importers query failed:', importersResult.error);
      throw new Error(`Failed to fetch importers: ${importersResult.error.message}`);
    }

    const restaurantMap = new Map((restaurantsResult.data || []).map((r) => [r.id, r]));
    const supplierMap = new Map((suppliersResult.data || []).map((s) => [s.id, s]));
    const importerMap = new Map((importersResult.data || []).map((i) => [i.id, i]));

    // Build response based on report type
    switch (reportType) {
      case 'alcohol-tax':
        return NextResponse.json(buildAlcoholTaxReport(orders || [], orderLines, wineDetails, supplierMap, importerMap, startDate, endDate));

      case 'vat':
        return NextResponse.json(buildVatReport(orders || [], restaurantMap, supplierMap, startDate, endDate));

      case 'imports':
        return NextResponse.json(await buildImportsReport(tenantId, startDate, endDate, supplierMap, importerMap, restaurantMap));

      case 'transactions':
        return NextResponse.json(buildTransactionsReport(orders || [], orderLines, restaurantMap, supplierMap, importerMap, startDate, endDate));

      case 'summary':
      default:
        return NextResponse.json(buildSummaryReport(orders || [], orderLines, wineDetails, restaurantMap, supplierMap, importerMap, startDate, endDate));
    }
  } catch (error: any) {
    console.error('Error generating compliance report:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function buildAlcoholTaxReport(
  orders: any[],
  orderLines: any[],
  wineDetails: Map<string, { alcohol_pct: number | null; bottle_size_ml: number }>,
  supplierMap: Map<string, any>,
  importerMap: Map<string, any>,
  startDate: string,
  endDate: string
) {
  // Group lines by order
  const linesByOrder = new Map<string, any[]>();
  for (const line of orderLines) {
    if (!linesByOrder.has(line.order_id)) {
      linesByOrder.set(line.order_id, []);
    }
    linesByOrder.get(line.order_id)!.push(line);
  }

  // Calculate alcohol tax per order
  const taxItems: any[] = [];
  let totalLitersWine = 0;
  let totalLitersPureAlcohol = 0;
  let totalAlcoholTax = 0;

  for (const order of orders) {
    const lines = linesByOrder.get(order.id) || [];
    const supplier = supplierMap.get(order.seller_supplier_id);
    const importer = importerMap.get(order.importer_of_record_id);

    let orderLitersWine = 0;
    let orderLitersPureAlcohol = 0;
    let orderAlcoholTax = 0;

    const lineDetails: any[] = [];

    for (const line of lines) {
      const wineInfo = wineDetails.get(line.wine_sku_id) || { alcohol_pct: 13, bottle_size_ml: 750 };
      const alcoholPct = wineInfo.alcohol_pct || 13; // Default to 13% if unknown
      const bottleSizeMl = wineInfo.bottle_size_ml || 750;

      // Calculate volumes
      const litersWine = (line.quantity * bottleSizeMl) / 1000;
      const litersPureAlcohol = litersWine * (alcoholPct / 100);

      // Calculate tax
      const alcoholTax = litersPureAlcohol * ALCOHOL_TAX_RATE_PER_LITER_PURE;

      orderLitersWine += litersWine;
      orderLitersPureAlcohol += litersPureAlcohol;
      orderAlcoholTax += alcoholTax;

      lineDetails.push({
        wine_name: line.wine_name,
        producer: line.producer,
        quantity: line.quantity,
        bottle_size_ml: bottleSizeMl,
        alcohol_pct: alcoholPct,
        liters_wine: litersWine,
        liters_pure_alcohol: litersPureAlcohol,
        alcohol_tax_sek: alcoholTax
      });
    }

    totalLitersWine += orderLitersWine;
    totalLitersPureAlcohol += orderLitersPureAlcohol;
    totalAlcoholTax += orderAlcoholTax;

    taxItems.push({
      order_id: order.id,
      order_date: order.created_at,
      supplier_name: supplier?.namn || 'Okänd',
      supplier_type: supplier?.type || 'UNKNOWN',
      importer_name: importer?.legal_name || 'Okänd',
      importer_org_number: importer?.org_number || '',
      lines: lineDetails,
      order_liters_wine: orderLitersWine,
      order_liters_pure_alcohol: orderLitersPureAlcohol,
      order_alcohol_tax_sek: orderAlcoholTax
    });
  }

  return {
    report_type: 'alcohol-tax',
    period: { start_date: startDate, end_date: endDate },
    tax_rate_info: {
      rate_per_liter_pure_alcohol: ALCOHOL_TAX_RATE_PER_LITER_PURE,
      description: 'Alkoholskatt för vin (2026)',
      source: 'Skatteverket'
    },
    totals: {
      order_count: orders.length,
      total_liters_wine: Math.round(totalLitersWine * 100) / 100,
      total_liters_pure_alcohol: Math.round(totalLitersPureAlcohol * 100) / 100,
      total_alcohol_tax_sek: Math.round(totalAlcoholTax * 100) / 100
    },
    items: taxItems
  };
}

function buildVatReport(
  orders: any[],
  restaurantMap: Map<string, any>,
  supplierMap: Map<string, any>,
  startDate: string,
  endDate: string
) {
  // Group by restaurant for VAT reporting
  const vatByRestaurant = new Map<string, {
    restaurant: any;
    orders: any[];
    total_goods_sek: number;
    total_vat_sek: number;
  }>();

  for (const order of orders) {
    const restaurant = restaurantMap.get(order.restaurant_id);
    const supplier = supplierMap.get(order.seller_supplier_id);

    if (!vatByRestaurant.has(order.restaurant_id)) {
      vatByRestaurant.set(order.restaurant_id, {
        restaurant,
        orders: [],
        total_goods_sek: 0,
        total_vat_sek: 0
      });
    }

    const entry = vatByRestaurant.get(order.restaurant_id)!;
    const goodsSek = (order.total_goods_amount_ore || 0) / 100;
    const vatSek = goodsSek * VAT_RATE;

    entry.orders.push({
      order_id: order.id,
      order_date: order.created_at,
      supplier_name: supplier?.namn || 'Okänd',
      goods_excl_vat_sek: goodsSek,
      vat_sek: vatSek,
      total_incl_vat_sek: goodsSek + vatSek
    });
    entry.total_goods_sek += goodsSek;
    entry.total_vat_sek += vatSek;
  }

  const items = Array.from(vatByRestaurant.values()).map((entry) => ({
    restaurant_name: entry.restaurant?.name || 'Okänd',
    restaurant_org_number: entry.restaurant?.org_number || '',
    order_count: entry.orders.length,
    total_goods_excl_vat_sek: Math.round(entry.total_goods_sek * 100) / 100,
    total_vat_sek: Math.round(entry.total_vat_sek * 100) / 100,
    total_incl_vat_sek: Math.round((entry.total_goods_sek + entry.total_vat_sek) * 100) / 100,
    orders: entry.orders
  }));

  const totalGoodsSek = items.reduce((sum, i) => sum + i.total_goods_excl_vat_sek, 0);
  const totalVatSek = items.reduce((sum, i) => sum + i.total_vat_sek, 0);

  return {
    report_type: 'vat',
    period: { start_date: startDate, end_date: endDate },
    vat_rate: VAT_RATE,
    vat_rate_percent: VAT_RATE * 100,
    totals: {
      order_count: orders.length,
      total_goods_excl_vat_sek: Math.round(totalGoodsSek * 100) / 100,
      total_vat_sek: Math.round(totalVatSek * 100) / 100,
      total_incl_vat_sek: Math.round((totalGoodsSek + totalVatSek) * 100) / 100
    },
    by_restaurant: items
  };
}

async function buildImportsReport(
  tenantId: string,
  startDate: string,
  endDate: string,
  supplierMap: Map<string, any>,
  importerMap: Map<string, any>,
  restaurantMap: Map<string, any>
) {
  // Fetch import cases
  const { data: imports, error } = await supabase
    .from('imports')
    .select(`
      id,
      created_at,
      status,
      restaurant_id,
      importer_id,
      supplier_id
    `)
    .eq('tenant_id', tenantId)
    .gte('created_at', `${startDate}T00:00:00`)
    .lte('created_at', `${endDate}T23:59:59`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch imports: ${error.message}`);
  }

  // Fetch additional entity data if not already in maps
  const additionalRestaurantIds = [...new Set((imports || []).map((i) => i.restaurant_id).filter((id) => !restaurantMap.has(id)))];
  const additionalSupplierIds = [...new Set((imports || []).map((i) => i.supplier_id).filter((id) => id && !supplierMap.has(id)))];
  const additionalImporterIds = [...new Set((imports || []).map((i) => i.importer_id).filter((id) => !importerMap.has(id)))];

  if (additionalRestaurantIds.length > 0) {
    const { data } = await supabase.from('restaurants').select('id, name, org_number').in('id', additionalRestaurantIds);
    (data || []).forEach((r) => restaurantMap.set(r.id, r));
  }
  if (additionalSupplierIds.length > 0) {
    const { data } = await supabase.from('suppliers').select('id, namn, org_number, type').in('id', additionalSupplierIds);
    (data || []).forEach((s) => supplierMap.set(s.id, s));
  }
  if (additionalImporterIds.length > 0) {
    const { data } = await supabase.from('importers').select('id, legal_name, org_number').in('id', additionalImporterIds);
    (data || []).forEach((i) => importerMap.set(i.id, i));
  }

  // Categorize by EU vs Swedish supplier
  const euImports: any[] = [];
  const domesticImports: any[] = [];

  for (const imp of imports || []) {
    const supplier = supplierMap.get(imp.supplier_id);
    const importer = importerMap.get(imp.importer_id);
    const restaurant = restaurantMap.get(imp.restaurant_id);

    const item = {
      import_id: imp.id,
      created_at: imp.created_at,
      status: imp.status,
      restaurant_name: restaurant?.name || 'Okänd',
      restaurant_org_number: restaurant?.org_number || '',
      supplier_name: supplier?.namn || 'Okänd',
      supplier_type: supplier?.type || 'UNKNOWN',
      importer_name: importer?.legal_name || 'Okänd',
      importer_org_number: importer?.org_number || ''
    };

    if (supplier?.type === 'EU_PRODUCER' || supplier?.type === 'EU_IMPORTER') {
      euImports.push(item);
    } else {
      domesticImports.push(item);
    }
  }

  return {
    report_type: 'imports',
    period: { start_date: startDate, end_date: endDate },
    totals: {
      total_imports: (imports || []).length,
      eu_imports: euImports.length,
      domestic_imports: domesticImports.length,
      by_status: {
        not_registered: (imports || []).filter((i) => i.status === 'NOT_REGISTERED').length,
        submitted: (imports || []).filter((i) => i.status === 'SUBMITTED').length,
        approved: (imports || []).filter((i) => i.status === 'APPROVED').length,
        rejected: (imports || []).filter((i) => i.status === 'REJECTED').length
      }
    },
    eu_imports: euImports,
    domestic_imports: domesticImports
  };
}

function buildTransactionsReport(
  orders: any[],
  orderLines: any[],
  restaurantMap: Map<string, any>,
  supplierMap: Map<string, any>,
  importerMap: Map<string, any>,
  startDate: string,
  endDate: string
) {
  // Group lines by order
  const linesByOrder = new Map<string, any[]>();
  for (const line of orderLines) {
    if (!linesByOrder.has(line.order_id)) {
      linesByOrder.set(line.order_id, []);
    }
    linesByOrder.get(line.order_id)!.push(line);
  }

  const transactions = orders.map((order) => {
    const restaurant = restaurantMap.get(order.restaurant_id);
    const supplier = supplierMap.get(order.seller_supplier_id);
    const importer = importerMap.get(order.importer_of_record_id);
    const lines = linesByOrder.get(order.id) || [];

    return {
      order_id: order.id,
      order_date: order.created_at,
      status: order.status,
      restaurant: {
        name: restaurant?.name || 'Okänd',
        org_number: restaurant?.org_number || ''
      },
      supplier: {
        name: supplier?.namn || 'Okänd',
        org_number: supplier?.org_number || '',
        type: supplier?.type || 'UNKNOWN'
      },
      importer: {
        name: importer?.legal_name || 'Okänd',
        org_number: importer?.org_number || ''
      },
      delivery_city: order.delivery_city,
      goods_amount_sek: (order.total_goods_amount_ore || 0) / 100,
      shipping_sek: (order.shipping_cost_ore || 0) / 100,
      total_sek: (order.total_order_value_ore || 0) / 100,
      line_count: lines.length,
      total_bottles: lines.reduce((sum, l) => sum + (l.quantity || 0), 0),
      lines: lines.map((l) => ({
        wine_name: l.wine_name,
        producer: l.producer,
        vintage: l.vintage,
        country: l.country,
        quantity: l.quantity,
        unit_price_sek: l.unit_price_sek,
        total_sek: l.total_price_sek
      }))
    };
  });

  return {
    report_type: 'transactions',
    period: { start_date: startDate, end_date: endDate },
    totals: {
      transaction_count: orders.length,
      total_bottles: transactions.reduce((sum, t) => sum + t.total_bottles, 0),
      total_goods_sek: Math.round(transactions.reduce((sum, t) => sum + t.goods_amount_sek, 0) * 100) / 100,
      total_shipping_sek: Math.round(transactions.reduce((sum, t) => sum + t.shipping_sek, 0) * 100) / 100,
      total_sek: Math.round(transactions.reduce((sum, t) => sum + t.total_sek, 0) * 100) / 100
    },
    transactions
  };
}

function buildSummaryReport(
  orders: any[],
  orderLines: any[],
  wineDetails: Map<string, { alcohol_pct: number | null; bottle_size_ml: number }>,
  restaurantMap: Map<string, any>,
  supplierMap: Map<string, any>,
  importerMap: Map<string, any>,
  startDate: string,
  endDate: string
) {
  // Calculate totals
  const totalGoodsSek = orders.reduce((sum, o) => sum + (o.total_goods_amount_ore || 0) / 100, 0);
  const totalShippingSek = orders.reduce((sum, o) => sum + (o.shipping_cost_ore || 0) / 100, 0);
  const totalOrderValueSek = orders.reduce((sum, o) => sum + (o.total_order_value_ore || 0) / 100, 0);
  const totalBottles = orderLines.reduce((sum, l) => sum + (l.quantity || 0), 0);

  // Calculate alcohol volumes
  let totalLitersWine = 0;
  let totalLitersPureAlcohol = 0;

  for (const line of orderLines) {
    const wineInfo = wineDetails.get(line.wine_sku_id) || { alcohol_pct: 13, bottle_size_ml: 750 };
    const alcoholPct = wineInfo.alcohol_pct || 13;
    const bottleSizeMl = wineInfo.bottle_size_ml || 750;

    const litersWine = (line.quantity * bottleSizeMl) / 1000;
    totalLitersWine += litersWine;
    totalLitersPureAlcohol += litersWine * (alcoholPct / 100);
  }

  const totalAlcoholTax = totalLitersPureAlcohol * ALCOHOL_TAX_RATE_PER_LITER_PURE;
  const totalVat = totalGoodsSek * VAT_RATE;

  // Count by supplier type
  const euOrders = orders.filter((o) => {
    const supplier = supplierMap.get(o.seller_supplier_id);
    return supplier?.type === 'EU_PRODUCER' || supplier?.type === 'EU_IMPORTER';
  });

  return {
    report_type: 'summary',
    period: { start_date: startDate, end_date: endDate },
    overview: {
      order_count: orders.length,
      total_bottles: totalBottles,
      unique_restaurants: new Set(orders.map((o) => o.restaurant_id)).size,
      unique_suppliers: new Set(orders.map((o) => o.seller_supplier_id)).size,
      unique_importers: new Set(orders.map((o) => o.importer_of_record_id)).size
    },
    financial: {
      total_goods_sek: Math.round(totalGoodsSek * 100) / 100,
      total_shipping_sek: Math.round(totalShippingSek * 100) / 100,
      total_order_value_sek: Math.round(totalOrderValueSek * 100) / 100
    },
    alcohol: {
      total_liters_wine: Math.round(totalLitersWine * 100) / 100,
      total_liters_pure_alcohol: Math.round(totalLitersPureAlcohol * 100) / 100,
      estimated_alcohol_tax_sek: Math.round(totalAlcoholTax * 100) / 100
    },
    vat: {
      vat_rate_percent: VAT_RATE * 100,
      estimated_vat_sek: Math.round(totalVat * 100) / 100
    },
    imports: {
      eu_supplier_orders: euOrders.length,
      domestic_supplier_orders: orders.length - euOrders.length
    },
    tax_summary: {
      estimated_alcohol_tax_sek: Math.round(totalAlcoholTax * 100) / 100,
      estimated_vat_sek: Math.round(totalVat * 100) / 100,
      estimated_total_tax_sek: Math.round((totalAlcoholTax + totalVat) * 100) / 100
    }
  };
}
