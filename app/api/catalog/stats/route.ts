import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/catalog/stats
 *
 * Returns aggregate catalog statistics — total active wines and how many
 * are direct-import (EU) vs domestic stock. Cached for 1 hour.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const revalidate = 3600; // 1 hour

export async function GET() {
  try {
    const [totalRes, domesticRes, euRes] = await Promise.all([
      supabase
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
      supabase
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE')
        .eq('location', 'domestic'),
      supabase
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE')
        .in('location', ['eu', 'non_eu']),
    ]);

    return NextResponse.json(
      {
        total: totalRes.count ?? 0,
        domestic: domesticRes.count ?? 0,
        directImport: euRes.count ?? 0,
      },
      {
        headers: {
          // Browser + CDN cache — stats change slowly
          'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (err) {
    console.error('[catalog/stats] error:', err);
    return NextResponse.json({ total: 0, domestic: 0, directImport: 0 }, { status: 500 });
  }
}
