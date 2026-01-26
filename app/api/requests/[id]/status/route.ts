/**
 * REQUEST STATUS API
 *
 * PATCH /api/requests/[id]/status
 *
 * Changes request status with validation.
 * Allowed transitions:
 * - OPEN → ACCEPTED (via offer acceptance - handled separately)
 * - OPEN → CLOSED (manually close request)
 * - OPEN → CANCELLED (cancel request)
 * - ACCEPTED → CLOSED (close after completion)
 *
 * Body: { status: string, reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import {
  validateRequestTransition,
  RequestStatus,
  InvalidStatusTransitionError,
} from '@/lib/state-machine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId,
    });

    const requestId = params.id;
    const body = await request.json();
    const { status: newStatus, reason } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Fetch current request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('requests')
      .select('id, status, restaurant_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Authorization: Only restaurant owner or admin can change status
    const isOwner = currentRequest.restaurant_id === actor.restaurant_id;
    const isAdmin = actorService.hasRole(actor, 'ADMIN');

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to modify this request' },
        { status: 403 }
      );
    }

    // Validate transition
    const fromStatus = currentRequest.status as RequestStatus;
    const toStatus = newStatus as RequestStatus;

    try {
      validateRequestTransition(fromStatus, toStatus);
    } catch (err) {
      if (err instanceof InvalidStatusTransitionError) {
        return NextResponse.json(
          {
            error: err.message,
            from: err.fromStatus,
            to: err.toStatus,
            allowed: err.allowedTransitions,
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // Build update object
    const updateData: Record<string, any> = {
      status: toStatus,
    };

    if (toStatus === 'CLOSED') {
      updateData.closed_at = new Date().toISOString();
      updateData.closed_reason = reason || null;
    } else if (toStatus === 'CANCELLED') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_reason = reason || null;
    }

    // Update request
    const { data: updatedRequest, error: updateError } = await supabase
      .from('requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    // Log event (trigger will also log, but we add actor info here)
    await supabase.from('request_events').insert({
      request_id: requestId,
      event_type: 'status_change',
      from_status: fromStatus,
      to_status: toStatus,
      note: reason || null,
      actor_user_id: userId,
      actor_name: actor.user_email || 'Unknown',
      metadata: { source: 'api' },
    });

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      transition: {
        from: fromStatus,
        to: toStatus,
      },
    });
  } catch (error: any) {
    console.error('Error updating request status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
