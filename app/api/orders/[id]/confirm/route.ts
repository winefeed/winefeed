/**
 * ORDER CONFIRM API
 *
 * POST /api/orders/[id]/confirm
 *
 * Confirm an order (for Swedish importers)
 * Changes status from PENDING_SUPPLIER_CONFIRMATION to CONFIRMED
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { orderService } from '@/lib/order-service';
import { sendEmail, getRestaurantRecipients, getSupplierEmail } from '@/lib/email-service';
import { orderConfirmationEmail } from '@/lib/email-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { adminClient } = await createRouteClients();

    // Get order to find supplier
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('seller_supplier_id')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this supplier
    const { data: supplierUser, error: accessError } = await adminClient
      .from('supplier_users')
      .select('supplier_id')
      .eq('id', userId)
      .eq('supplier_id', order.seller_supplier_id)
      .single();

    if (accessError || !supplierUser) {
      return NextResponse.json(
        { error: 'Access denied - not authorized for this order' },
        { status: 403 }
      );
    }

    // Parse optional note from body
    let note: string | undefined;
    try {
      const body = await request.json();
      note = body.note;
    } catch {
      // No body, that's fine
    }

    // Confirm the order
    const result = await orderService.confirmOrderBySupplier({
      order_id: orderId,
      tenant_id: tenantId,
      supplier_id: order.seller_supplier_id,
      actor_user_id: userId,
      note,
    });

    // Send confirmation emails (fail-safe)
    try {
      // Get full order details for email
      const { data: fullOrder } = await adminClient
        .from('orders')
        .select(`
          id,
          buyer_restaurant_id,
          seller_supplier_id,
          delivery_address,
          total_bottles
        `)
        .eq('id', orderId)
        .single();

      if (fullOrder) {
        // Get restaurant and supplier details
        const { data: restaurant } = await adminClient
          .from('restaurants')
          .select('name, contact_email')
          .eq('id', fullOrder.buyer_restaurant_id)
          .single();

        const { data: supplier } = await adminClient
          .from('suppliers')
          .select('namn, kontakt_email')
          .eq('id', fullOrder.seller_supplier_id)
          .single();

        // Get order lines
        const { data: orderLines } = await adminClient
          .from('order_lines')
          .select('wine_name, quantity, offered_unit_price_ore')
          .eq('order_id', orderId);

        const items = (orderLines || []).map(line => ({
          wineName: line.wine_name,
          quantity: line.quantity,
          priceSek: line.offered_unit_price_ore ? Math.round(line.offered_unit_price_ore / 100) : undefined,
        }));

        const totalValue = (orderLines || []).reduce(
          (sum, line) => sum + (line.offered_unit_price_ore || 0) * line.quantity / 100,
          0
        );

        // Send to restaurant
        const restaurantRecipients = await getRestaurantRecipients(fullOrder.buyer_restaurant_id, tenantId);
        for (const email of restaurantRecipients) {
          const emailContent = orderConfirmationEmail({
            recipientName: restaurant?.name || 'Restaurang',
            orderId,
            restaurantName: restaurant?.name || 'Er restaurang',
            supplierName: supplier?.namn || 'Leverantör',
            totalBottles: fullOrder.total_bottles || items.reduce((sum, i) => sum + i.quantity, 0),
            totalValueSek: totalValue > 0 ? Math.round(totalValue) : undefined,
            deliveryAddress: fullOrder.delivery_address,
            items,
          });

          await sendEmail({
            to: email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        }

        // Send to supplier
        const supplierEmail = supplier?.kontakt_email || await getSupplierEmail(fullOrder.seller_supplier_id, tenantId);
        if (supplierEmail) {
          const emailContent = orderConfirmationEmail({
            recipientName: supplier?.namn || 'Leverantör',
            orderId,
            restaurantName: restaurant?.name || 'Restaurang',
            supplierName: supplier?.namn || 'Er firma',
            totalBottles: fullOrder.total_bottles || items.reduce((sum, i) => sum + i.quantity, 0),
            totalValueSek: totalValue > 0 ? Math.round(totalValue) : undefined,
            deliveryAddress: fullOrder.delivery_address,
            items,
          });

          await sendEmail({
            to: supplierEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        }

        console.log(`📧 Order confirmation emails sent for order ${orderId}`);
      }
    } catch (emailError) {
      console.error('Error sending order confirmation emails:', emailError);
      // Don't fail - emails are not critical
    }

    return NextResponse.json({
      success: true,
      order_id: result.order_id,
      status: result.status,
      message: 'Order confirmed successfully',
    });

  } catch (error: any) {
    console.error('Error confirming order:', error);

    if (error.message?.includes('Cannot confirm')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to confirm order', details: error.message },
      { status: 500 }
    );
  }
}
