/**
 * ORDER DECLINE API
 *
 * POST /api/orders/[id]/decline
 *
 * Decline an order (for Swedish importers)
 * Changes status from PENDING_SUPPLIER_CONFIRMATION to CANCELLED
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { orderService } from '@/lib/order-service';

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

    // Parse reason from body (required)
    let reason: string;
    try {
      const body = await request.json();
      reason = body.reason;

      if (!reason || reason.trim() === '') {
        return NextResponse.json(
          { error: 'Reason is required when declining an order' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Request body with reason is required' },
        { status: 400 }
      );
    }

    // Decline the order
    const result = await orderService.declineOrderBySupplier({
      order_id: orderId,
      tenant_id: tenantId,
      supplier_id: order.seller_supplier_id,
      actor_user_id: userId,
      reason,
    });

    return NextResponse.json({
      success: true,
      order_id: result.order_id,
      status: result.status,
      message: 'Order declined',
    });

  } catch (error: any) {
    console.error('Error declining order:', error);

    if (error.message?.includes('Cannot decline')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to decline order', details: error.message },
      { status: 500 }
    );
  }
}
