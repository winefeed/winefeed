/**
 * ADMIN WINES API
 *
 * GET /api/admin/wines
 *
 * Returns all wines with supplier info, filterable by supplier_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplier_id');

    // Build query
    let query = supabase
      .from('supplier_wines')
      .select('id, supplier_id, name, producer, country, region, color, price_ex_vat_sek, stock_qty, moq, is_active, created_at')
      .order('created_at', { ascending: false });

    // Filter by supplier if provided
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: wines, error: winesError } = await query;

    if (winesError) {
      console.error('Error fetching wines:', winesError);
      return NextResponse.json({ error: 'Failed to fetch wines', details: winesError.message }, { status: 500 });
    }

    // Get all suppliers for the filter dropdown
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, namn, type')
      .order('namn', { ascending: true });

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
    }

    // Map supplier names to wines
    const supplierMap = new Map(suppliers?.map(s => [s.id, s]) || []);
    const winesWithSupplier = wines?.map(wine => ({
      ...wine,
      supplierName: supplierMap.get(wine.supplier_id)?.namn || 'Okänd',
      supplierType: supplierMap.get(wine.supplier_id)?.type || 'unknown',
      priceSek: wine.price_ex_vat_sek ? Math.round(wine.price_ex_vat_sek / 100) : null,
    })) || [];

    return NextResponse.json({
      wines: winesWithSupplier,
      suppliers: suppliers || [],
      count: winesWithSupplier.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in admin wines API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
