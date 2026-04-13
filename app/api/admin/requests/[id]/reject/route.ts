/**
 * ADMIN — Reject an open broadcast request
 *
 * POST /api/admin/requests/[id]/reject
 * Body: { reason?: string }
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    const { data: req, error: fetchError } = await supabase
      .from('requests')
      .select('id, request_type, status')
      .eq('id', params.id)
      .single();

    if (fetchError || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.request_type !== 'open' || req.status !== 'PENDING_REVIEW') {
      return NextResponse.json(
        { error: 'Only open PENDING_REVIEW requests can be rejected here' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('requests')
      .update({ status: 'REJECTED' })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reject', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: params.id, status: 'REJECTED' });
  } catch (err: any) {
    console.error('POST /api/admin/requests/[id]/reject error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
