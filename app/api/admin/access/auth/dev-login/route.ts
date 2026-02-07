/**
 * GET /api/admin/access/auth/dev-login?email=test@test.com
 *
 * DEV ONLY - Skip magic link, create consumer & set cookie directly.
 * Only works when NODE_ENV !== 'production'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConsumerByEmail, createConsumer } from '@/lib/access-service';
import { setAccessCookie } from '@/lib/access-auth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get('email') || 'test@test.com';
  const redirect = request.nextUrl.searchParams.get('redirect') || '/admin/access/mina-sidor';

  let consumer = await getConsumerByEmail(email);
  if (!consumer) {
    consumer = await createConsumer(email, 'Test User');
  }

  await setAccessCookie(consumer.id);

  return NextResponse.redirect(new URL(redirect, request.url));
}
