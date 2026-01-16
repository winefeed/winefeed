/**
 * INVITE VERIFICATION API
 *
 * GET /api/invites/verify?token=...
 *
 * Validates invite token and returns metadata
 * Used by /invite page to show invite details before acceptance
 *
 * Security:
 * - No auth required (token is the auth)
 * - Returns masked email (m***@domain.com)
 * - No sensitive data exposed
 */

import { NextRequest, NextResponse } from 'next/server';
import { inviteService } from '@/lib/invite-service';

// Helper: Mask email address
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';

  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  return `${maskedLocal}@${domain}`;
}

export async function GET(request: NextRequest) {
  try {
    // Extract token from query params
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing required parameter: token' },
        { status: 400 }
      );
    }

    // Verify invite
    const result = await inviteService.verifyInvite(token);

    // Return verification result with masked email
    return NextResponse.json(
      {
        is_valid: result.is_valid,
        email: result.is_valid ? maskEmail(result.email) : undefined,
        role: result.is_valid ? result.role : undefined,
        entity_name: result.is_valid ? result.entity_name : undefined,
        expires_at: result.is_valid ? result.expires_at : undefined,
        error: result.error || undefined
      },
      { status: result.is_valid ? 200 : 400 }
    );

  } catch (error: any) {
    console.error('Error verifying invite:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
