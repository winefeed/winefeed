/**
 * /api/cron/access-reminders
 *
 * Vercel Cron (daily 07:00 UTC) — automated Vinkoll Access housekeeping:
 * 1. Remind importers who haven't responded within 5 days
 * 2. Expire requests with no response after 7 days
 * 3. Send admin daily summary to hej@vinkoll.se
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAccessReminders } from '@/lib/access-service';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processAccessReminders();

    console.log(`[CRON] Access reminders completed: reminded=${result.reminded}, expired=${result.expired}, summary=${result.summary_sent}`);
    if (result.errors.length > 0) {
      console.warn('[CRON] Errors:', result.errors);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[CRON] Access reminders failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error.message },
      { status: 500 }
    );
  }
}
