/**
 * ADMIN ORDER API - SINGLE ORDER
 *
 * GET /api/admin/orders/[id] - Get order details
 * PATCH /api/admin/orders/[id] - Update order (concierge mode, status)
 *
 * Security:
 * - Requires ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
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
      tenant_id: tenantId
    });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Access denied: ADMIN role required' },
        { status: 403 }
      );
    }

    // Fetch order with all details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_lines (*)
      `)
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch related data
    const [supplierRes, importerRes, restaurantRes, eventsRes] = await Promise.all([
      supabase.from('suppliers').select('namn, type').eq('id', order.seller_supplier_id).single(),
      supabase.from('importers').select('legal_name').eq('id', order.importer_of_record_id).single(),
      supabase.from('restaurants').select('name, city').eq('id', order.restaurant_id).single(),
      supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      order: {
        ...order,
        supplier_name: supplierRes.data?.namn || 'Unknown',
        supplier_type: supplierRes.data?.type || null,
        importer_name: importerRes.data?.legal_name || 'Unknown',
        restaurant_name: restaurantRes.data?.name || 'Unknown',
        restaurant_city: restaurantRes.data?.city || null,
      },
      events: eventsRes.data || [],
    });
  } catch (error: any) {
    console.error('Error fetching admin order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
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
      tenant_id: tenantId
    });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Access denied: ADMIN role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      handled_by_winefeed,
      concierge_notes,
      status,
      payment_status,
      dispute_status,
      dispute_resolved_at,
      invoice_number,
    } = body;

    // Verify order exists
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, handled_by_winefeed')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Handle concierge mode toggle
    if (typeof handled_by_winefeed === 'boolean') {
      updates.handled_by_winefeed = handled_by_winefeed;
      if (handled_by_winefeed && !existingOrder.handled_by_winefeed) {
        // First time enabling concierge mode
        updates.concierge_handled_at = new Date().toISOString();
        updates.concierge_handled_by = userId;
      }
    }

    // Handle concierge notes
    if (concierge_notes !== undefined) {
      updates.concierge_notes = concierge_notes;
    }

    // Handle status change
    if (status) {
      const validStatuses = ['CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    // Handle payment status
    if (payment_status) {
      const validPaymentStatuses = ['pending', 'invoiced', 'paid', 'overdue', 'refunded'];
      if (!validPaymentStatuses.includes(payment_status)) {
        return NextResponse.json(
          { error: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.payment_status = payment_status;
      if (payment_status === 'paid') {
        updates.payment_paid_at = new Date().toISOString();
      }
    }

    // Handle invoice number
    if (invoice_number !== undefined) {
      updates.invoice_number = invoice_number;
    }

    // Handle dispute status
    if (dispute_status) {
      const validDisputeStatuses = ['none', 'reported', 'investigating', 'resolved'];
      if (!validDisputeStatuses.includes(dispute_status)) {
        return NextResponse.json(
          { error: `Invalid dispute status. Must be one of: ${validDisputeStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.dispute_status = dispute_status;
      if (dispute_status === 'resolved') {
        updates.dispute_resolved_at = dispute_resolved_at || new Date().toISOString();
      }
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    // Log event if status changed or concierge mode changed
    const events: any[] = [];

    if (status && status !== existingOrder.status) {
      events.push({
        tenant_id: tenantId,
        order_id: orderId,
        event_type: 'STATUS_CHANGED',
        from_status: existingOrder.status,
        to_status: status,
        actor_user_id: userId,
        actor_name: 'Admin',
        note: `Status ändrad från ${existingOrder.status} till ${status}`,
      });
    }

    if (typeof handled_by_winefeed === 'boolean' && handled_by_winefeed !== existingOrder.handled_by_winefeed) {
      events.push({
        tenant_id: tenantId,
        order_id: orderId,
        event_type: handled_by_winefeed ? 'CONCIERGE_ENABLED' : 'CONCIERGE_DISABLED',
        actor_user_id: userId,
        actor_name: 'Admin',
        note: handled_by_winefeed
          ? 'Winefeed hanterar denna order åt kunden'
          : 'Concierge-läge avaktiverat',
        metadata: concierge_notes ? { notes: concierge_notes } : null,
      });
    }

    if (events.length > 0) {
      await supabase.from('order_events').insert(events);
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('Error updating admin order:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
