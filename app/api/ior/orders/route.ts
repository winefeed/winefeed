/**
 * IOR ORDERS API - LIST
 *
 * GET /api/ior/orders
 *
 * List orders where current user is the Importer-of-Record (IOR)
 *
 * Query Parameters:
 * - status: Filter by order status (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
 * - limit: Number of orders to return (default: 50)
 * - offset: Offset for pagination (default: 0)
 *
 * Security:
 * - Tenant isolation
 * - IOR can only see orders where importer_of_record_id matches their importer
 * - For MVP: importer_id passed via header (x-importer-id)
 *
 * Returns:
 * - List of orders with restaurant, supplier, and status info
 */

import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '@/lib/order-service';
import { actorService } from '@/lib/actor-service';
import { createRouteClients } from '@/lib/supabase/route-client';

export async function GET(request: NextRequest) {
  try {
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

    // Verify IOR or ADMIN access
    const hasIORAccess = actorService.hasIORAccess(actor);
    const isAdmin = actorService.hasRole(actor, 'ADMIN');

    if (!hasIORAccess && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: IOR role required' },
        { status: 403 }
      );
    }

    const { userClient } = await createRouteClients();

    // For IOR users, use their importer_id; for ADMIN, show all IOR orders
    const importerId = actor.importer_id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate status if provided
    const validStatuses = ['CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch orders for IOR (or all IOR orders for ADMIN)
    let orders: any[] = [];
    if (importerId && !isAdmin) {
      // IOR user (non-admin) - fetch orders for their specific importer only
      orders = await orderService.listOrdersForIOR({
        importer_id: importerId,
        tenant_id: tenantId,
        status: status as any,
        limit,
        offset
      });
    } else if (isAdmin) {
      // ADMIN without specific importer - fetch all orders with IOR assigned
      let query = userClient
        .from('orders')
        .select(`
          id,
          tenant_id,
          restaurant_id,
          offer_id,
          request_id,
          seller_supplier_id,
          importer_of_record_id,
          delivery_location_id,
          import_case_id,
          status,
          total_lines,
          total_quantity,
          currency,
          created_by,
          created_at,
          updated_at
        `)
        .eq('tenant_id', tenantId)
        .not('importer_of_record_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        throw new Error(`Failed to list IOR orders: ${queryError.message}`);
      }
      orders = data || [];
    }

    // Enrich orders with restaurant and supplier names
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        // Fetch restaurant name
        const { data: restaurant } = await userClient
          .from('restaurants')
          .select('name, contact_email')
          .eq('id', order.restaurant_id)
          .single();

        // Fetch supplier name
        const { data: supplier } = await userClient
          .from('suppliers')
          .select('namn, type')
          .eq('id', order.seller_supplier_id)
          .single();

        return {
          ...order,
          restaurant_name: restaurant?.name || 'Unknown',
          restaurant_contact_email: restaurant?.contact_email || null,
          supplier_name: supplier?.namn || 'Unknown',
          supplier_type: supplier?.type || null
        };
      })
    );

    return NextResponse.json(
      {
        orders: enrichedOrders,
        count: enrichedOrders.length,
        limit,
        offset
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing IOR orders:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
