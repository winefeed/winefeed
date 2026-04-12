/**
 * UNDISMISS ASSIGNMENT API
 *
 * PATCH /api/supplier/requests/[id]/undismiss
 *
 * Allows a supplier to undo a dismiss/archive on a quote request assignment.
 * Sets dismissed_at = NULL.
 *
 * REQUIRES: SELLER role, owns the assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { id: requestId } = params;

    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier linked to user' },
        { status: 404 }
      );
    }

    const { adminClient } = await createRouteClients();

    const { data, error } = await adminClient
      .from('quote_request_assignments')
      .update({ dismissed_at: null })
      .eq('quote_request_id', requestId)
      .eq('supplier_id', actor.supplier_id)
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ dismissed: false });
  } catch (error: any) {
    console.error('Error undismissing assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
