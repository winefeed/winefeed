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
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import {
  validateOfferTransition,
  OfferStatus,
  InvalidStatusTransitionError,
} from '@/lib/state-machine';
import { sendEmail, getSupplierEmail, logEmailEvent, WINEFEED_FROM } from '@/lib/email-service';
import { offerDeclinedEmail } from '@/lib/email-templates';

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

    const { userClient } = await createRouteClients();

    const offerId = params.id;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Fetch current offer with request info
    const { data: offer, error: fetchError } = await userClient
      .from('offers')
      .select(`
        id,
        status,
        supplier_id,
        request_id,
        declined_email_sent_at,
        requests!inner(restaurant_id, fritext)
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
    const { data: updatedOffer, error: updateError } = await userClient
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
    await userClient.from('offer_events').insert({
      offer_id: offerId,
      event_type: 'rejected',
      from_status: fromStatus,
      to_status: toStatus,
      actor_user_id: userId,
      actor_name: actor.user_email || 'Unknown',
      metadata: { reason: reason || null },
    });

    // PILOT: Send decline email to supplier (idempotent)
    // Only send if not already sent (check declined_email_sent_at)
    if (offer.supplier_id && !offer.declined_email_sent_at) {
      try {
        const supplierEmail = await getSupplierEmail(offer.supplier_id, tenantId);

        if (supplierEmail) {
          // Fetch supplier and restaurant names for email
          const [supplierResult, restaurantResult] = await Promise.all([
            userClient.from('suppliers').select('namn').eq('id', offer.supplier_id).single(),
            userClient.from('restaurants').select('name').eq('id', requestRestaurantId).single()
          ]);

          const requestData = offer.requests as any;
          const emailContent = offerDeclinedEmail({
            supplierName: supplierResult.data?.namn || 'Leverantör',
            restaurantName: restaurantResult.data?.name || 'Restaurang',
            offerId: offerId,
            requestTitle: requestData?.fritext?.substring(0, 50) || 'Förfrågan',
            declinedAt: new Date().toISOString(),
            reason: reason || undefined
          });

          const emailResult = await sendEmail({
            to: supplierEmail,
            from: WINEFEED_FROM,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          });

          // Mark email as sent (idempotency)
          await userClient
            .from('offers')
            .update({ declined_email_sent_at: new Date().toISOString() })
            .eq('id', offerId);

          // Log email event
          await logEmailEvent(tenantId, offerId, {
            type: 'OFFER_DECLINED',
            to: supplierEmail,
            success: emailResult.success,
            error: emailResult.error
          });

          if (!emailResult.success) {
            console.warn(`⚠️  Failed to send decline email: ${emailResult.error}`);
          }
        }
      } catch (emailError: any) {
        console.error('Error sending decline email:', emailError);
        // Don't throw - email is not critical
      }
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
    console.error('Error rejecting offer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
