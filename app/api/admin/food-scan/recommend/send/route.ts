/**
 * POST /api/admin/food-scan/recommend/send — Send a wine recommendation email
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { sendRecommendation } from '@/lib/sommelier-outreach/outreach-service';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { recommendation_id, recipient_email, subject, html } = body;

    if (!recommendation_id || !recipient_email) {
      return NextResponse.json(
        { error: 'recommendation_id and recipient_email are required' },
        { status: 400 },
      );
    }

    // DEV SAFETY: Override recipient to admin email to avoid sending to real restaurants
    const DEV_OVERRIDE_EMAIL = process.env.DEV_EMAIL_OVERRIDE;
    const safeRecipient = DEV_OVERRIDE_EMAIL || recipient_email;
    if (DEV_OVERRIDE_EMAIL) {
      console.log(`[Recommend] DEV: Redirecting email from ${recipient_email} → ${DEV_OVERRIDE_EMAIL}`);
    }

    const result = await sendRecommendation(
      recommendation_id,
      safeRecipient,
      subject,
      html,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Recommend] Send error:', error);
    return NextResponse.json(
      { error: 'Failed to send recommendation', message: error.message },
      { status: 500 },
    );
  }
}
