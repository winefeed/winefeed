/**
 * SUPPLIER ORDERS API
 *
 * GET /api/suppliers/[id]/orders - List orders for supplier
 *
 * REQUIRES: User must be SELLER and owner of the supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

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
    const { id: supplierId } = await params;

    // Auth check - verify user owns this supplier
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER and own this supplier (or ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    // Build query for orders via offers
    let query = supabase
      .from('orders')
      .select(`
        id,
        status,
        total_price,
        created_at,
        delivery_date,
        shipping_address,
        offer:offers!inner(
          id,
          offered_price,
          quantity,
          supplier_id,
          quote_request:quote_requests!inner(
            id,
            wine:wines!inner(name),
            restaurant:restaurants!inner(name)
          )
        )
      `)
      .eq('offer.supplier_id', supplierId)
      .order('created_at', { ascending: false });

    // Filter by status
    if (status !== 'all') {
      // Map frontend status to actual status values
      const statusMap: Record<string, string[]> = {
        pending: ['PENDING_SUPPLIER_CONFIRMATION'],
        confirmed: ['CONFIRMED', 'IN_FULFILLMENT'],
        shipped: ['SHIPPED'],
        delivered: ['DELIVERED'],
        cancelled: ['CANCELLED'],
      };

      const mappedStatuses = statusMap[status];
      if (mappedStatuses) {
        query = query.in('status', mappedStatuses);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Transform to flat structure
    // Map status for frontend display
    const statusDisplayMap: Record<string, string> = {
      'PENDING_SUPPLIER_CONFIRMATION': 'pending',
      'CONFIRMED': 'confirmed',
      'IN_FULFILLMENT': 'confirmed',
      'SHIPPED': 'shipped',
      'DELIVERED': 'delivered',
      'CANCELLED': 'cancelled',
    };

    const transformedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      offer_id: order.offer?.id,
      restaurant_name: order.offer?.quote_request?.restaurant?.name || 'Okänd restaurang',
      wine_name: order.offer?.quote_request?.wine?.name || 'Okänt vin',
      quantity: order.offer?.quantity || 0,
      total_price: order.total_price || order.offer?.offered_price || 0,
      status: statusDisplayMap[order.status] || order.status?.toLowerCase(),
      raw_status: order.status, // Original status for actions
      created_at: order.created_at,
      delivery_date: order.delivery_date,
      shipping_address: order.shipping_address,
    }));

    return NextResponse.json({
      orders: transformedOrders,
    });

  } catch (error: any) {
    console.error('Error in orders API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
