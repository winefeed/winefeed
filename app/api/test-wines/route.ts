/**
 * TEST ENDPOINT - Debug wine fetching
 *
 * GET /api/test-wines
 *
 * Simple endpoint to test if Supabase connection works
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Check env vars
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json({
        error: 'Missing environment variables',
        hasUrl: !!url,
        hasKey: !!key,
      }, { status: 500 });
    }

    // Create client
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Simple count query
    const { count, error: countError } = await supabase
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
    const { data: wines, error: winesError } = await supabase
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
