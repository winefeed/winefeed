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
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    console.log('[IOR Orders API] Auth context:', { tenantId, userId });

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context', tenantId: !!tenantId, userId: !!userId },
        { status: 401 }
      );
    }

    // Resolve actor context
    console.log('[IOR Orders API] Resolving actor...');
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });
    console.log('[IOR Orders API] Actor resolved:', { roles: actor.roles, importer_id: actor.importer_id });

    // Verify IOR access
    if (!actorService.hasIORAccess(actor)) {
      return NextResponse.json(
        { error: 'Access denied: IOR role required', roles: actor.roles },
        { status: 403 }
      );
    }

    const importerId = actor.importer_id!;
    console.log('[IOR Orders API] Using importer_id:', importerId);

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

    // Fetch orders for IOR
    console.log('[IOR Orders API] Fetching orders...', { importerId, tenantId, status, limit, offset });
    const orders = await orderService.listOrdersForIOR({
      importer_id: importerId,
      tenant_id: tenantId,
      status: status as any,
      limit,
      offset
    });
    console.log('[IOR Orders API] Found', orders.length, 'orders');

    // Enrich orders with restaurant and supplier names
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        // Fetch restaurant name
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name, contact_email')
          .eq('id', order.restaurant_id)
          .single();

        // Fetch supplier name
        const { data: supplier } = await supabase
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
    console.error('[IOR Orders API] Error:', error?.message, error?.stack);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
