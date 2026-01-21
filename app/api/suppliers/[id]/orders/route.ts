/**
 * SUPPLIER ORDERS API
 *
 * GET /api/suppliers/[id]/orders - List orders for supplier
 */

import { NextRequest, NextResponse } from 'next/server';
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
    const { id: supplierId } = await params;
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
      query = query.eq('status', status);
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
    const transformedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      offer_id: order.offer?.id,
      restaurant_name: order.offer?.quote_request?.restaurant?.name || 'Okänd restaurang',
      wine_name: order.offer?.quote_request?.wine?.name || 'Okänt vin',
      quantity: order.offer?.quantity || 0,
      total_price: order.total_price || order.offer?.offered_price || 0,
      status: order.status,
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
