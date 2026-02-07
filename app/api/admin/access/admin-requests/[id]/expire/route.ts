/**
 * /api/admin/access/admin-requests/[id]/expire
 *
 * POST: Manually mark a request as expired (admin backstop)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logAccessEvent } from '@/lib/access-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Only expire if not already in a terminal state
    const { data: req } = await admin
      .from('access_requests')
      .select('status')
      .eq('id', id)
      .single();

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.status === 'expired') {
      return NextResponse.json({ error: 'Already expired' }, { status: 409 });
    }

    const { error } = await admin
      .from('access_requests')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to expire request' }, { status: 500 });
    }

    await logAccessEvent('REQUEST_EXPIRED_MANUAL', null, {
      request_id: id,
      expired_by: user.id,
      previous_status: req.status,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Expire request error:', error);
    return NextResponse.json(
      { error: 'Failed to expire request' },
      { status: 500 }
    );
  }
}
