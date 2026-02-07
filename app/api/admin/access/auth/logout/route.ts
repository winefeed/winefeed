/**
 * POST /api/admin/access/auth/logout
 *
 * Clear access consumer cookie.
 */

import { NextResponse } from 'next/server';
import { clearAccessCookie, getAccessConsumerId } from '@/lib/access-auth';
import { logAccessEvent } from '@/lib/access-service';

export async function POST() {
  try {
    const consumerId = await getAccessConsumerId();
    if (consumerId) {
      await logAccessEvent('LOGOUT', consumerId);
    }
    await clearAccessCookie();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ ok: true });
  }
}
