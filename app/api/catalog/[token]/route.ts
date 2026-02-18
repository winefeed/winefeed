/**
 * PUBLIC CATALOG API
 *
 * GET /api/catalog/[token] - Returns public wine catalog for a supplier
 *
 * No authentication required. Token-based access.
 * NEVER exposes prices, MOQ, stock, notes, or SKU.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { adminClient } = await createRouteClients();

    // Look up supplier by catalog token + must be shared
    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, namn, type')
      .eq('catalog_token', token)
      .eq('catalog_shared', true)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });
    }

    // Fetch ACTIVE wines — explicit select, NEVER prices/MOQ/stock/notes/SKU
    const { data: wines, error: winesError } = await adminClient
      .from('supplier_wines')
      .select('id, name, producer, vintage, region, country, grape, color, description, appellation, alcohol_pct, bottle_size_ml, organic, biodynamic, case_size')
      .eq('supplier_id', supplier.id)
      .eq('status', 'ACTIVE')
      .order('producer', { ascending: true })
      .order('name', { ascending: true });

    if (winesError) {
      console.error('Error fetching catalog wines:', winesError);
      return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 });
    }

    return NextResponse.json(
      {
        supplier: {
          name: supplier.namn,
          type: supplier.type,
        },
        wines: wines || [],
      },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('Error loading public catalog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
