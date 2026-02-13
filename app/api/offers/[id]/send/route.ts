/**
 * OFFER SEND API
 *
 * POST /api/offers/[id]/send
 *
 * Sends a draft offer to the restaurant.
 * Transition: DRAFT → SENT
 *
 * Body: { message?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import {
  validateOfferTransition,
  OfferStatus,
  InvalidStatusTransitionError,
} from '@/lib/state-machine';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    const { adminClient } = await createRouteClients();

    const offerId = params.id;
    const body = await request.json().catch(() => ({}));
    const { message } = body;

    // Fetch current offer
    const { data: offer, error: fetchError } = await adminClient
      .from('offers')
      .select('id, status, supplier_id, request_id')
      .eq('id', offerId)
      .single();

    if (fetchError || !offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Authorization: Only supplier owner or admin can send
    const isOwner = offer.supplier_id === actor.supplier_id;
    const isAdmin = actorService.hasRole(actor, 'ADMIN');

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to send this offer' },
        { status: 403 }
      );
    }

    // Validate transition
    const fromStatus = (offer.status || 'DRAFT') as OfferStatus;
    const toStatus: OfferStatus = 'SENT';

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
    const { data: updatedOffer, error: updateError } = await adminClient
      .from('offers')
      .update({
        status: 'SENT',
        sent_at: new Date().toISOString(),
      })
      .eq('id', offerId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to send offer: ${updateError.message}`);
    }

    // Log event
    await adminClient.from('offer_events').insert({
      offer_id: offerId,
      event_type: 'sent',
      from_status: fromStatus,
      to_status: toStatus,
      actor_user_id: userId,
      actor_name: actor.user_email || 'Unknown',
      metadata: { message: message || null },
    });

    // Update quote_request_assignment status to RESPONDED
    if (offer.request_id && offer.supplier_id) {
      await adminClient
        .from('quote_request_assignments')
        .update({ status: 'RESPONDED' })
        .eq('quote_request_id', offer.request_id)
        .eq('supplier_id', offer.supplier_id);
    }

    return NextResponse.json({
      success: true,
      offer: updatedOffer,
      transition: {
        from: fromStatus,
        to: toStatus,
      },
    });
  } catch (error: any) {
    console.error('Error sending offer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
