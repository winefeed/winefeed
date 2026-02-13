/**
 * GET /api/admin/growth/email-status?ids=resend_id1,resend_id2
 *
 * Check email delivery/open status via Resend API.
 * Returns { [resend_id]: "delivered" | "opened" | "bounced" | ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const ids = request.nextUrl.searchParams.get('ids');
    if (!ids) {
      return NextResponse.json({ error: 'Missing ids param' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const idList = ids.split(',').filter(Boolean).slice(0, 50);
    const statuses: Record<string, string> = {};

    await Promise.all(
      idList.map(async (id) => {
        try {
          const res = await fetch(`https://api.resend.com/emails/${id}`, {
            headers: { Authorization: `Bearer ${resendKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            statuses[id] = data.last_event || 'unknown';
          }
        } catch {
          // Skip failed lookups
        }
      })
    );

    return NextResponse.json(statuses);
  } catch (error: any) {
    console.error('Email status error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
