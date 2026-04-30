/**
 * GET /api/cron/enrich-styles
 *
 * Daily cron (03:00 UTC) — pre-compute body/tannin/acidity for wines missing style profiles.
 * Only fills NULL values; never overwrites manually-set values.
 * Auth: CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { inferWineStyle } from '@/lib/matching-agent/style-inference';

export const maxDuration = 120;

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
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

    // Fetch wines where any style column is NULL
    const { data: wines, error: fetchError } = await supabase
      .from('supplier_wines')
      .select('id, name, grape, color, region, description, vintage, body, tannin, acidity')
      .or('body.is.null,tannin.is.null,acidity.is.null');

    if (fetchError) {
      console.error('[CRON] enrich-styles fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch wines', details: fetchError.message }, { status: 500 });
    }

    if (!wines || wines.length === 0) {
      console.log('[CRON] enrich-styles: no wines need enrichment');
      return NextResponse.json({ enriched: 0, skipped: 0, errors: 0 });
    }

    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < wines.length; i += BATCH_SIZE) {
      const batch = wines.slice(i, i + BATCH_SIZE);
      const updates: { id: string; body?: string; tannin?: string; acidity?: string }[] = [];

      for (const wine of batch) {
        try {
          const style = inferWineStyle(
            wine.grape || '',
            wine.color || '',
            wine.region || undefined,
            wine.description || undefined,
            wine.vintage ?? undefined,
          );

          // Only fill NULL columns — respect manually-set values
          const update: Record<string, string> = {};
          if (wine.body === null) update.body = style.body;
          if (wine.tannin === null) update.tannin = style.tannin;
          if (wine.acidity === null) update.acidity = style.acidity;

          if (Object.keys(update).length > 0) {
            updates.push({ id: wine.id, ...update });
          } else {
            skipped++;
          }
        } catch (err: any) {
          console.error(`[CRON] enrich-styles error for wine ${wine.id} (${wine.name}):`, err.message);
          errors++;
        }
      }

      // Batch update
      for (const { id, ...fields } of updates) {
        const { error: updateError } = await supabase
          .from('supplier_wines')
          .update(fields)
          .eq('id', id);

        if (updateError) {
          console.error(`[CRON] enrich-styles update failed for ${id}:`, updateError.message);
          errors++;
        } else {
          enriched++;
        }
      }
    }

    console.log(`[CRON] enrich-styles completed: enriched=${enriched}, skipped=${skipped}, errors=${errors}`);

    return NextResponse.json({ enriched, skipped, errors, total: wines.length });
  } catch (error: any) {
    console.error('[CRON] enrich-styles failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error.message },
      { status: 500 },
    );
  }
}
