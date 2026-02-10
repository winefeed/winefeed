/**
 * OFFER ACCEPTANCE - PILOT LOOP 1.0
 *
 * POST /api/offers/[id]/accept
 *
 * Accepts a multi-line offer and locks it (immutable snapshot)
 *
 * REQUIRES: RESTAURANT role and ownership of the offer's request
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
 * - User authentication required
 * - Only restaurant owner can accept
 * - Cannot accept twice
 * - Immutable after acceptance
 * - Audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { offerService } from '@/lib/offer-service';
import { orderService } from '@/lib/order-service';
import { sendEmail, getSupplierEmail, getRestaurantEmail, logEmailEvent, logOrderEmailEvent } from '@/lib/email-service';
import { offerAcceptedEmail, orderConfirmationEmail } from '@/lib/email-templates';
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
    // Alias id to offerId per routing standard
    const { id: offerId } = params;

    // Extract auth context - userId is REQUIRED
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only RESTAURANT users or ADMIN can accept offers
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'RESTAURANT')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Load offer first to check existence and ownership
    // Note: offers table doesn't have tenant_id, get restaurant via request
    const { data: existingOffer, error: offerError } = await supabase
      .from('offers')
      .select(`
        id,
        request_id,
        supplier_id,
        status,
        requests!inner (
          id,
          restaurant_id
        )
      `)
      .eq('id', offerId)
      .single();

    if (offerError || !existingOffer) {
      if (offerError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Get restaurant_id from the related request
    // Note: Supabase returns nested relation as object when parent uses .single()
    const requestData = existingOffer.requests as unknown as { id: string; restaurant_id: string };
    const offerRestaurantId = requestData?.restaurant_id;

    // Verify restaurant ownership of the offer (non-admin only)
    if (!actorService.hasRole(actor, 'ADMIN')) {
      if (offerRestaurantId !== actor.restaurant_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check if restaurant has org_number (required for orders/invoicing)
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('org_number')
      .eq('id', offerRestaurantId)
      .single();

    if (!restaurant?.org_number) {
      return NextResponse.json(
        {
          errorCode: 'ORG_NUMBER_REQUIRED',
          error: 'Organisationsnummer krävs för att acceptera offert',
          details: 'Du måste lägga till organisationsnummer innan du kan lägga en beställning.'
        },
        { status: 400 }
      );
    }

    // Validate assignment is valid and not expired
    const { data: assignment, error: assignmentError } = await supabase
      .from('quote_request_assignments')
      .select('id, status, expires_at')
      .eq('quote_request_id', existingOffer.request_id)
      .eq('supplier_id', existingOffer.supplier_id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'No valid assignment found for this offer. Only offers from assigned suppliers can be accepted.' },
        { status: 403 }
      );
    }

    // Check if assignment has expired
    if (assignment.status === 'EXPIRED' ||
        (assignment.expires_at && new Date(assignment.expires_at) < new Date())) {
      return NextResponse.json(
        {
          errorCode: 'OFFER_EXPIRED',
          error: 'This offer has expired and cannot be accepted.',
          details: 'The supplier assignment window has closed.'
        },
        { status: 403 }
      );
    }

    // Parse optional acceptedLineIds for partial acceptance
    let acceptedLineIds: string[] | undefined;
    try {
      const body = await request.json();
      if (body.acceptedLineIds && Array.isArray(body.acceptedLineIds)) {
        acceptedLineIds = body.acceptedLineIds;
      }
    } catch {
      // No body or invalid JSON — accept all lines (full acceptance)
    }

    // Accept offer via service (lock + snapshot + event)
    const result = await offerService.acceptOffer(tenantId, offerId, userId, acceptedLineIds);

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

    // PILOT: Send order confirmation email to restaurant
    // Fail-safe: Email failure doesn't block acceptance
    if (orderId) {
      try {
        const { offer } = result;
        const restaurantEmail = await getRestaurantEmail(offer.restaurant_id, tenantId);

        if (restaurantEmail) {
          // Fetch order details for email
          const orderDetails = await orderService.getOrder(orderId, tenantId);

          if (orderDetails) {
            const { data: restaurantData } = await supabase
              .from('restaurants')
              .select('name, city')
              .eq('id', offer.restaurant_id)
              .single();

            const { data: supplierData } = await supabase
              .from('suppliers')
              .select('namn')
              .eq('id', offer.supplier_id || '')
              .single();

            // Build items for email
            const items = orderDetails.lines?.map((line: any) => ({
              wineName: line.wine_name || 'Vin',
              quantity: line.quantity || 0,
              priceSek: line.price_sek ? Math.round(line.price_sek / 100) : undefined,
              provorder: line.provorder || false,
              provorderFee: line.provorder_fee || undefined
            })) || [];

            const totalBottles = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

            const emailContent = orderConfirmationEmail({
              recipientName: restaurantData?.name || 'Kära kund',
              orderId: orderId,
              restaurantName: restaurantData?.name || 'Er restaurang',
              supplierName: supplierData?.namn || 'Leverantör',
              totalBottles,
              deliveryAddress: restaurantData?.city || undefined,
              items
            });

            const emailResult = await sendEmail({
              to: restaurantEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text
            });

            await logOrderEmailEvent(tenantId, orderId, {
              type: 'ORDER_CONFIRMATION',
              to: restaurantEmail,
              success: emailResult.success,
              error: emailResult.error
            });

            if (!emailResult.success) {
              console.warn(`⚠️  Failed to send order confirmation email: ${emailResult.error}`);
            }
          }
        }
      } catch (emailError: any) {
        console.error('Error sending order confirmation email:', emailError);
        // Don't throw - email is not critical
      }
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
