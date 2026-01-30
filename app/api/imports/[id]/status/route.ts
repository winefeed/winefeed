import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';
import { orderService, OrderStatus } from '@/lib/order-service';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getRestaurantRecipients, logOrderEmailEvent } from '@/lib/email-service';
import { orderStatusUpdatedEmail } from '@/lib/email-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing auth context' }, { status: 401 });
    }

    const body = await request.json();
    const { to_status, why } = body;

    if (!to_status) {
      return NextResponse.json({ error: 'Missing required field: to_status' }, { status: 400 });
    }

    const result = await importService.setImportStatus({
      import_id: importId,
      tenant_id: tenantId,
      to_status,
      changed_by: userId,
      note: why || null
    });

    // AUTO-UPDATE ORDERS: When import case is APPROVED, confirm linked orders
    if (to_status === 'APPROVED') {
      try {
        console.log(`Import case ${importId} approved - checking for linked orders to auto-confirm`);

        // Find orders linked to this import case
        const { data: linkedOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, status, restaurant_id')
          .eq('tenant_id', tenantId)
          .eq('import_id', importId);

        if (ordersError) {
          console.error('Error fetching linked orders:', ordersError);
          throw new Error(`Failed to fetch linked orders: ${ordersError.message}`);
        }

        if (linkedOrders && linkedOrders.length > 0) {
          console.log(`Found ${linkedOrders.length} order(s) linked to import case ${importId}`);

          for (const order of linkedOrders) {
            // Only auto-confirm if order is not already in a later status
            // Status progression: CONFIRMED → IN_FULFILLMENT → SHIPPED → DELIVERED
            // Skip if already IN_FULFILLMENT, SHIPPED, or DELIVERED
            const laterStatuses = [OrderStatus.IN_FULFILLMENT, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED];

            if (laterStatuses.includes(order.status as OrderStatus)) {
              console.log(`Skipping order ${order.id} - already in status ${order.status}`);
              continue;
            }

            // Update order status to CONFIRMED (if not already)
            if (order.status !== OrderStatus.CONFIRMED) {
              console.log(`Auto-confirming order ${order.id} (current status: ${order.status})`);

              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  status: OrderStatus.CONFIRMED,
                  updated_at: new Date().toISOString()
                })
                .eq('id', order.id)
                .eq('tenant_id', tenantId);

              if (updateError) {
                console.error(`Failed to update order ${order.id}:`, updateError);
                continue; // Continue with other orders
              }

              // Log order event: STATUS_AUTO_UPDATED
              const { error: eventError } = await supabase
                .from('order_events')
                .insert({
                  tenant_id: tenantId,
                  order_id: order.id,
                  event_type: 'STATUS_AUTO_UPDATED',
                  from_status: order.status,
                  to_status: OrderStatus.CONFIRMED,
                  note: `Order automatically confirmed after import case ${importId} was approved`,
                  metadata: {
                    import_id: importId,
                    trigger: 'IMPORT_APPROVED',
                    previous_status: order.status
                  },
                  actor_user_id: null,
                  actor_name: 'System'
                });

              if (eventError) {
                console.error(`Failed to log auto-update event for order ${order.id}:`, eventError);
              }

              console.log(`✓ Order ${order.id} auto-confirmed (${order.status} → CONFIRMED)`);
            } else {
              console.log(`Order ${order.id} already CONFIRMED - no update needed`);
            }

            // FAIL-SAFE: Send restaurant email notification (ORDER_STATUS_UPDATED)
            try {
              const { data: restaurant } = await supabase
                .from('restaurants')
                .select('name')
                .eq('id', order.restaurant_id)
                .single();

              const recipients = await getRestaurantRecipients(order.restaurant_id, tenantId);

              if (recipients.length === 0) {
                console.warn(`⚠️  No email recipients found for restaurant ${order.restaurant_id}, skipping notification`);
              } else {
                console.log(`📧 Sending order confirmation notification to ${recipients.length} recipient(s) for order ${order.id}`);

                const emailContent = orderStatusUpdatedEmail({
                  restaurantName: restaurant?.name || undefined,
                  orderId: order.id,
                  newStatus: OrderStatus.CONFIRMED,
                  deepLink: `/orders/${order.id}`
                });

                for (const recipientEmail of recipients) {
                  try {
                    const emailResult = await sendEmail({
                      to: recipientEmail,
                      subject: emailContent.subject,
                      html: emailContent.html,
                      text: emailContent.text
                    });

                    await logOrderEmailEvent(tenantId, order.id, {
                      type: 'ORDER_STATUS_UPDATED',
                      to: recipientEmail,
                      success: emailResult.success,
                      error: emailResult.error
                    });

                    console.log(`📧 Notification sent to ${recipientEmail}: ${emailResult.success ? 'SUCCESS' : 'FAILED'}`);
                  } catch (recipientError: any) {
                    console.error(`Failed to send notification to ${recipientEmail} (non-blocking):`, recipientError);
                  }
                }
              }
            } catch (emailError: any) {
              console.error(`Failed to send restaurant notifications for order ${order.id} (non-blocking):`, emailError);
              // Continue - email failure shouldn't block status update
            }
          }

          console.log(`✓ Auto-confirmation complete for import case ${importId}`);
        } else {
          console.log(`No orders linked to import case ${importId}`);
        }
      } catch (autoUpdateError: any) {
        console.error('Error during auto-update of linked orders (non-blocking):', autoUpdateError);
        // Don't fail the import status update - just log the error
      }
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error('Error updating import status:', error);

    if (error.message?.includes('Invalid transition')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
