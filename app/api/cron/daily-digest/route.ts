/**
 * /api/cron/daily-digest
 *
 * Vercel Cron (daily 04:30 UTC = 06:30 CEST) — Winefeed morning digest
 * Sends a daily summary email to markus@winefeed.se with:
 * - Pipeline updates, new actors, wines
 * - Order/offer activity last 24h
 * - Actions that need attention
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildDailyDigest } from '@/lib/daily-digest-service';
import { dailyDigestEmail } from '@/lib/email-templates';
import { sendEmail, WINEFEED_FROM } from '@/lib/email-service';

export const maxDuration = 60;

const DIGEST_RECIPIENT = 'markus@winefeed.se';

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

    // Build digest data
    const digestData = await buildDailyDigest();

    // Render email
    const { subject, html, text } = dailyDigestEmail(digestData);

    // Send email
    const emailResult = await sendEmail({
      to: DIGEST_RECIPIENT,
      subject,
      html,
      text,
      from: WINEFEED_FROM,
    });

    const stats = {
      success: emailResult.success,
      recipient: DIGEST_RECIPIENT,
      newOrders: digestData.newOrders.length,
      newOffers: digestData.newOffers.length,
      newRequests: digestData.newRequests.length,
      newWines: digestData.newWines.length,
      newSuppliers: digestData.newSuppliers.length,
      newRestaurants: digestData.newRestaurants.length,
      actions: digestData.actions.length,
      generatedAt: digestData.generatedAt,
    };

    console.log(`[CRON] Daily digest sent: orders=${stats.newOrders}, offers=${stats.newOffers}, actions=${stats.actions}`);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[CRON] Daily digest failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error.message },
      { status: 500 }
    );
  }
}
