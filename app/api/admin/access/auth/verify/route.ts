/**
 * GET /api/admin/access/auth/verify?token=xxx&redirect=...
 *
 * Verify magic link token. Set cookie. Redirect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, setAccessCookie } from '@/lib/access-auth';
import { updateConsumer, logAccessEvent } from '@/lib/access-service';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const redirect = request.nextUrl.searchParams.get('redirect') || '/admin/access/mina-sidor';

  if (!token) {
    return NextResponse.redirect(new URL('/admin/access/login?error=missing_token', request.url));
  }

  try {
    const result = await verifyAuthToken(token);

    if (!result || result.subjectType !== 'consumer') {
      return NextResponse.redirect(new URL('/admin/access/login?error=invalid_token', request.url));
    }

    // Mark consumer as verified if first time
    await updateConsumer(result.subjectId, {
      verified_at: new Date().toISOString(),
    });

    // Set cookie
    await setAccessCookie(result.subjectId);

    // Log event
    await logAccessEvent('LOGIN', result.subjectId);

    // Redirect
    return NextResponse.redirect(new URL(redirect, request.url));
  } catch (error: any) {
    console.error('Token verification error:', error);
    return NextResponse.redirect(new URL('/admin/access/login?error=verification_failed', request.url));
  }
}
