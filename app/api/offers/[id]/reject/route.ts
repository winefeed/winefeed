/**
 * OFFER REJECT API
 *
 * POST /api/offers/[id]/reject
 *
 * Restaurant rejects an offer.
 * Transition: SENT/VIEWED → REJECTED
 *
 * Body: { reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import {
  validateOfferTransition,
  OfferStatus,
  InvalidStatusTransitionError,
} from '@/lib/state-machine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(
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

    const offerId = params.id;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Fetch current offer with request info
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select(`
        id,
        status,
        supplier_id,
        request_id,
        requests!inner(restaurant_id)
      `)
      .eq('id', offerId)
      .single();

    if (fetchError || !offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Authorization: Only restaurant owner or admin can reject
    const requestRestaurantId = (offer.requests as any)?.restaurant_id;
    const isOwner = requestRestaurantId === actor.restaurant_id;
    const isAdmin = actorService.hasRole(actor, 'ADMIN');

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to reject this offer' },
        { status: 403 }
      );
    }

    // Validate transition
    const fromStatus = (offer.status || 'SENT') as OfferStatus;
    const toStatus: OfferStatus = 'REJECTED';

    try {
      validateOfferTransition(fromStatus, toStatus);
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

    // Update offer
    const { data: updatedOffer, error: updateError } = await supabase
      .from('offers')
      .update({
        status: 'REJECTED',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq('id', offerId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to reject offer: ${updateError.message}`);
    }

    // Log event
    await supabase.from('offer_events').insert({
      offer_id: offerId,
      event_type: 'rejected',
      from_status: fromStatus,
      to_status: toStatus,
      actor_user_id: userId,
      actor_name: actor.user_email || 'Unknown',
      metadata: { reason: reason || null },
    });

    return NextResponse.json({
      success: true,
      offer: updatedOffer,
      transition: {
        from: fromStatus,
        to: toStatus,
      },
    });
  } catch (error: any) {
    console.error('Error rejecting offer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
