/**
 * ADMIN — Approve or reject an open broadcast request
 *
 * POST /api/admin/requests/[id]/approve   — approve and fan out
 * POST /api/admin/requests/[id]/reject    — mark rejected
 *
 * REQUIRES: ADMIN role
 * Only works on requests where request_type = 'open' and status = 'PENDING_REVIEW'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { assignOpenRequest, type OpenCriteria } from '@/lib/matching-agent/open-request-fanout';

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
      .select('id, request_type, status, open_criteria, restaurant_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.request_type !== 'open') {
      return NextResponse.json({ error: 'Only open requests can be approved here' }, { status: 400 });
    }

    if (req.status !== 'PENDING_REVIEW') {
      return NextResponse.json(
        { error: `Request is in status ${req.status}, only PENDING_REVIEW can be approved` },
        { status: 400 }
      );
    }

    // Run fan-out FIRST so a partial failure doesn't leave us with an OPEN
    // request that no supplier has been notified about.
    const fanout = await assignOpenRequest(params.id, req.open_criteria as OpenCriteria);

    if (fanout.assignments_created === 0) {
      return NextResponse.json(
        {
          error: 'No matching suppliers found — request not approved',
          suppliers_matched: fanout.suppliers_matched,
        },
        { status: 422 }
      );
    }

    // Flip status to OPEN now that suppliers have been assigned.
    const { error: updateError } = await supabase
      .from('requests')
      .update({ status: 'OPEN' })
      .eq('id', params.id);

    if (updateError) {
      console.error('Failed to flip status after fan-out:', updateError);
      return NextResponse.json(
        { error: 'Fan-out succeeded but status update failed', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: params.id,
      status: 'OPEN',
      fanout,
    });
  } catch (err: any) {
    console.error('POST /api/admin/requests/[id]/approve error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
