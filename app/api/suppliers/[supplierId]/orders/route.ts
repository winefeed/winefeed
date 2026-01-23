/**
 * SUPPLIER ORDERS API
 *
 * GET /api/suppliers/[supplierId]/orders
 *
 * List orders for a supplier (from accepted offers)
 * Includes orders pending supplier confirmation
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
  { params }: { params: { supplierId: string } }
) {
  try {
    const { supplierId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify user has access to this supplier
    const { data: supplierUser, error: accessError } = await supabase
      .from('supplier_users')
      .select('supplier_id')
      .eq('id', userId)
      .eq('supplier_id', supplierId)
      .single();

    if (accessError || !supplierUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get status filter
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        id,
        status,
        total_lines,
        total_quantity,
        currency,
        created_at,
        updated_at,
        offer:offers!inner(
          id,
          title
        ),
        restaurant:restaurants!inner(
          id,
          name,
          contact_email
        )
      `)
      .eq('seller_supplier_id', supplierId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status && status !== 'all') {
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
      }
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Failed to fetch orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Transform to expected format
    const transformedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      offer_id: order.offer?.id,
      restaurant_name: order.restaurant?.name || 'Unknown',
      restaurant_email: order.restaurant?.contact_email,
      wine_name: order.offer?.title || 'Multiple wines',
      quantity: order.total_quantity || 0,
      total_price: 0, // Would need to calculate from order_lines
      status: order.status?.toLowerCase().replace('pending_supplier_confirmation', 'pending'),
      raw_status: order.status, // Keep original for actions
      created_at: order.created_at,
      delivery_date: null,
      shipping_address: null,
    }));

    return NextResponse.json({ orders: transformedOrders });

  } catch (error: any) {
    console.error('Error in supplier orders API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
