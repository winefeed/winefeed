/**
 * IOR ORDER STATUS UPDATE API
 *
 * POST /api/ior/orders/[id]/status
 *
 * Update order fulfillment status
 *
 * Valid transitions:
 * - CONFIRMED → IN_FULFILLMENT | CANCELLED
 * - IN_FULFILLMENT → SHIPPED | CANCELLED
 * - SHIPPED → DELIVERED | CANCELLED
 * - DELIVERED → (terminal)
 * - CANCELLED → (terminal)
 *
 * Request body:
 * {
 *   "to_status": "SHIPPED",
 *   "note": "Optional note",
 *   "metadata": { "tracking_number": "ABC123", ... }
 * }
 *
 * Security:
 * - Tenant isolation
 * - IOR can only update orders where importer_of_record_id matches their importer
 * - Status transitions validated
 * - Audit trail via order_events
 */

import { NextRequest, NextResponse } from 'next/server';
import { orderService, OrderStatus } from '@/lib/order-service';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getRestaurantRecipients, logOrderEmailEvent } from '@/lib/email-service';
import { orderStatusUpdatedEmail } from '@/lib/email-templates';

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
    // Alias id to orderId per routing standard
    const { id: orderId } = params;

    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Resolve actor context
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    // Verify IOR access
    if (!actorService.hasIORAccess(actor)) {
      return NextResponse.json(
        { error: 'Access denied: IOR role required' },
        { status: 403 }
      );
    }

    const importerId = actor.importer_id!;

    // Parse request body
    const body = await request.json();
    const { to_status, note, metadata } = body;

    if (!to_status) {
      return NextResponse.json(
        { error: 'Missing required field: to_status' },
        { status: 400 }
      );
    }

    // Validate to_status
    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(to_status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify IOR access (order must belong to this importer)
    const orderCheck = await orderService.getOrder(orderId, tenantId);
    if (!orderCheck) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (orderCheck.order.importer_of_record_id !== importerId) {
      return NextResponse.json(
        { error: 'Access denied: You are not the IOR for this order' },
        { status: 403 }
      );
    }

    // Get importer name for actor_name
    const { data: importer } = await supabase
      .from('importers')
      .select('legal_name')
      .eq('id', importerId)
      .single();

    // Update order status
    const result = await orderService.setOrderStatus({
      order_id: orderId,
      tenant_id: tenantId,
      to_status: to_status as OrderStatus,
      actor_user_id: userId || undefined,
      actor_name: importer?.legal_name || 'IOR',
      note: note || undefined,
      metadata: metadata || undefined
    });

    // FAIL-SAFE: Send restaurant email notifications to all users (don't block status update)
    try {
      // Get restaurant details and all recipients
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', orderCheck.order.restaurant_id)
        .single();

      // Get all email recipients for this restaurant
      const recipients = await getRestaurantRecipients(
        orderCheck.order.restaurant_id,
        tenantId
      );

      if (recipients.length === 0) {
        console.warn(`⚠️  No email recipients found for restaurant ${orderCheck.order.restaurant_id}, skipping notification`);
      } else {
        console.log(`📧 Sending order status notification to ${recipients.length} recipient(s) for order ${orderId}`);

        // Generate email template once
        const emailContent = orderStatusUpdatedEmail({
          restaurantName: restaurant?.name || undefined,
          orderId: orderId,
          newStatus: result.to_status,
          deepLink: `/orders/${orderId}`
        });

        // Send email to all recipients
        for (const recipientEmail of recipients) {
          try {
            // Send email (fail-safe per recipient)
            const emailResult = await sendEmail({
              to: recipientEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text
            });

            // Log email event to order_events (one per recipient)
            await logOrderEmailEvent(tenantId, orderId, {
              type: 'ORDER_STATUS_UPDATED',
              to: recipientEmail,
              success: emailResult.success,
              error: emailResult.error
            });

            console.log(`📧 Notification sent to ${recipientEmail}: ${emailResult.success ? 'SUCCESS' : 'FAILED'}`);
          } catch (recipientError: any) {
            console.error(`Failed to send notification to ${recipientEmail} (non-blocking):`, recipientError);
            // Continue with other recipients
          }
        }

        console.log(`📧 Completed sending notifications for order ${orderId} to ${recipients.length} recipient(s)`);
      }
    } catch (emailError: any) {
      console.error('Failed to send restaurant notifications (non-blocking):', emailError);
      // Continue - email failure shouldn't block status update
    }

    return NextResponse.json(
      {
        message: `Order status updated: ${result.from_status} → ${result.to_status}`,
        order_id: result.order_id,
        from_status: result.from_status,
        to_status: result.to_status
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating order status:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (error.message?.includes('Invalid status transition')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
