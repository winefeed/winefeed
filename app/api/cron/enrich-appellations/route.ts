/**
 * GET /api/cron/enrich-appellations
 *
 * Weekly cron — fills supplier_wines.appellation for active wines missing it.
 * The import route already runs inference post-import (capped at 50 per run),
 * so this is the catch-all for stragglers, legacy rows, and edge paths that
 * create wines without going through the import pipeline.
 * Auth: CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { inferAppellations } from '@/lib/catalog-agent/appellation-inference';

export const maxDuration = 120;

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: wines, error: fetchError } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, country, region, grape, vintage')
    .eq('is_active', true)
    .is('appellation', null)
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error('[CRON] enrich-appellations fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch wines', details: fetchError.message }, { status: 500 });
  }

  if (!wines || wines.length === 0) {
    console.log('[CRON] enrich-appellations: no wines need enrichment');
    return NextResponse.json({ enriched: 0, nulled: 0, checked: 0 });
  }

  const map = await inferAppellations(wines);
  let enriched = 0;
  let nulled = 0;

  for (const [id, appellation] of map.entries()) {
    if (!appellation) {
      nulled++;
      continue;
    }
    const { error } = await supabase
      .from('supplier_wines')
      .update({ appellation })
      .eq('id', id);
    if (!error) enriched++;
  }

  console.log(`[CRON] enrich-appellations: enriched=${enriched}, nulled=${nulled}, checked=${wines.length}`);
  return NextResponse.json({ enriched, nulled, checked: wines.length });
}
