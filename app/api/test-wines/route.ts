/**
 * TEST ENDPOINT - Debug wine fetching
 *
 * GET /api/test-wines
 *
 * Simple endpoint to test if Supabase connection works
 */

import { NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';

export async function GET() {
  try {
    const { adminClient } = await createRouteClients();

    // Simple count query
    const { count, error: countError } = await adminClient
      .from('supplier_wines')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({
        error: 'Count query failed',
        details: countError.message,
        code: countError.code,
      }, { status: 500 });
    }

    // Fetch first 5 wines
    const { data: wines, error: winesError } = await adminClient
      .from('supplier_wines')
      .select('id, name, producer, country, color, price_ex_vat_sek')
      .limit(5);

    if (winesError) {
      return NextResponse.json({
        error: 'Fetch query failed',
        details: winesError.message,
        code: winesError.code,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total_wines: count,
      sample_wines: wines,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error?.message || 'Unknown',
    }, { status: 500 });
  }
}
