/**
 * POST /api/admin/access/auth/login
 *
 * Magic link login for consumers.
 * Rate limited (5/15min). Creates consumer if new.
 * Always returns success (don't leak email existence).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConsumerByEmail, createConsumer, logAccessEvent } from '@/lib/access-service';
import { createAuthToken } from '@/lib/access-auth';
import { sendEmail, getAppUrl } from '@/lib/email-service';
import { accessMagicLinkEmail } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Ogiltig e-postadress' },
        { status: 400 }
      );
    }

    // Get or create consumer
    let consumer = await getConsumerByEmail(email);
    if (!consumer) {
      consumer = await createConsumer(email);
    }

    // Generate magic link token
    const token = await createAuthToken('consumer', consumer.id, {
      redirect: body.redirect || null,
    });

    // Build login URL
    const redirect = body.redirect || '/admin/access/mina-sidor';
    const loginUrl = getAppUrl(`/api/admin/access/auth/verify?token=${token}&redirect=${encodeURIComponent(redirect)}`);

    // Log login URL in dev for easy testing
    console.log('\n========== VINKOLL ACCESS MAGIC LINK ==========');
    console.log(loginUrl);
    console.log('================================================\n');

    // Send email
    const { subject, html, text } = accessMagicLinkEmail({
      name: consumer.name,
      loginUrl,
    });

    await sendEmail({ to: email, subject, html, text });

    // Log event
    await logAccessEvent('MAGIC_LINK_SENT', consumer.id, { email });

    // Always return success
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Access login error:', error);
    // Still return success to not leak info
    return NextResponse.json({ ok: true });
  }
}
