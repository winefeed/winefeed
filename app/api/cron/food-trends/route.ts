/**
 * GET /api/cron/food-trends
 *
 * Monthly cron (1st of month, 06:00 UTC) — scan Köket.se for food trends.
 * Auth: CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runTrendScan } from '@/lib/food-scan/food-scan-service';

export const maxDuration = 120;

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

    const result = await runTrendScan();

    console.log(`[CRON] Food trends completed: found=${result.recipes_found}, new=${result.new_dishes}`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[CRON] Food trends failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error.message },
      { status: 500 },
    );
  }
}
