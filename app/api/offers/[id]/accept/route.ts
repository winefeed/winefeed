/**
 * OFFER ACCEPTANCE - PILOT LOOP 1.0
 *
 * POST /api/offers/[id]/accept
 *
 * Accepts a multi-line offer and locks it (immutable snapshot)
 *
 * Flow:
 * 1. Validate offer exists and is not already accepted
 * 2. Lock offer (set status = ACCEPTED, locked_at = now)
 * 3. Create immutable snapshot (offer + lines)
 * 4. Log acceptance event
 * 5. Return locked offer + snapshot
 *
 * Security:
 * - Tenant isolation
 * - Cannot accept twice
 * - Immutable after acceptance
 * - Audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { offerService } from '@/lib/offer-service';
import { orderService } from '@/lib/order-service';
import { sendEmail, getSupplierEmail, logEmailEvent } from '@/lib/email-service';
import { offerAcceptedEmail } from '@/lib/email-templates';
import { createClient } from '@supabase/supabase-js';

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
    // Alias id to offerId per routing standard
    const { id: offerId } = params;

    // Extract tenant context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');  // Optional actor

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Accept offer via service (lock + snapshot + event)
    const result = await offerService.acceptOffer(tenantId, offerId, userId || undefined);

    // EU-SELLER → IOR FLOW: Create order from accepted offer
    // Fail-safe: Order creation failure doesn't block acceptance (logged but not thrown)
    let orderId: string | null = null;
    try {
      const orderResult = await orderService.createOrderFromAcceptedOffer({
        offer_id: offerId,
        tenant_id: tenantId,
        actor_user_id: userId || undefined
      });
      orderId = orderResult.order_id;
      console.log(`✓ Order created: ${orderId} from accepted offer ${offerId}`);
    } catch (orderError: any) {
      console.error('⚠️  Failed to create order from accepted offer:', orderError);
      // Don't throw - order creation is important but not critical for acceptance
      // IOR can still manually create order later if needed
    }

    // PILOT LOOP 1.0: Send email notification to supplier
    // Fail-safe: Email failure doesn't block acceptance
    try {
      const { offer } = result;

      // Get supplier email
      if (offer.supplier_id) {
        const supplierEmail = await getSupplierEmail(offer.supplier_id, tenantId);

        if (supplierEmail) {
          // Fetch supplier and restaurant details for email
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('namn')
            .eq('id', offer.supplier_id)
            .single();

          const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('name')
            .eq('id', offer.restaurant_id)
            .single();

          // Generate and send email
          const emailContent = offerAcceptedEmail({
            supplierName: supplierData?.namn || 'Er leverans',
            restaurantName: restaurantData?.name || 'Restaurang',
            offerId: offerId,
            requestId: offer.request_id || null,
            offerTitle: offer.title || 'Offert',
            acceptedAt: offer.accepted_at
          });

          const emailResult = await sendEmail({
            to: supplierEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          });

          // Log email event
          await logEmailEvent(tenantId, offerId, {
            type: 'OFFER_ACCEPTED',
            to: supplierEmail,
            success: emailResult.success,
            error: emailResult.error
          });

          if (!emailResult.success) {
            console.warn(`⚠️  Failed to send offer accepted email: ${emailResult.error}`);
          }
        } else {
          console.warn(`⚠️  No email found for supplier ${offer.supplier_id}`);
        }
      }
    } catch (emailError: any) {
      console.error('Error sending offer accepted email:', emailError);
      // Don't throw - email is not critical
    }

    return NextResponse.json(
      {
        message: 'Offer accepted successfully',
        offer: result.offer,
        snapshot: result.snapshot,
        accepted_at: result.offer.accepted_at,
        locked_at: result.offer.locked_at,
        order_id: orderId  // EU-SELLER → IOR: Order ID if created successfully
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error accepting offer:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (error.message?.includes('already accepted')) {
      return NextResponse.json(
        {
          errorCode: 'ALREADY_ACCEPTED',
          error: 'Offer already accepted',
          details: 'This offer has already been accepted and cannot be accepted again.'
        },
        { status: 409 }
      );
    }

    if (error.message?.includes('already locked')) {
      return NextResponse.json(
        {
          errorCode: 'ALREADY_LOCKED',
          error: 'Offer is locked',
          details: 'This offer has been locked and cannot be modified.'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
