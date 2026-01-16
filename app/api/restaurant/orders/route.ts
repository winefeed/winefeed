/**
 * RESTAURANT ORDERS API - LIST
 *
 * GET /api/restaurant/orders
 *
 * List orders for current restaurant (read-only tracking)
 *
 * Query Parameters:
 * - status: Filter by order status (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
 * - limit: Number of orders to return (default: 50, max: 100)
 * - offset: Offset for pagination (default: 0)
 *
 * Security:
 * - Tenant isolation
 * - Restaurant can only see orders where restaurant_id matches their restaurant
 * - Requires RESTAURANT role (verified via actor service)
 *
 * Returns:
 * - List of orders with supplier, IOR, and compliance summary
 */

import { NextRequest, NextResponse } from 'next/server';
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

    // Verify RESTAURANT access
    if (!actorService.hasRole(actor, 'RESTAURANT') || !actor.restaurant_id) {
      return NextResponse.json(
        { error: 'Access denied: RESTAURANT role required' },
        { status: 403 }
      );
    }

    const restaurantId = actor.restaurant_id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate status if provided
    const validStatuses = ['CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('orders')
      .select('id, created_at, updated_at, status, seller_supplier_id, importer_of_record_id, import_id, total_lines, total_quantity, currency')
      .eq('tenant_id', tenantId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    // Enrich orders with supplier and importer names
    const enrichedOrders = await Promise.all(
      (orders || []).map(async (order) => {
        // Fetch supplier name
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('namn, type')
          .eq('id', order.seller_supplier_id)
          .single();

        // Fetch importer name
        const { data: importer } = await supabase
          .from('importers')
          .select('legal_name')
          .eq('id', order.importer_of_record_id)
          .single();

        // Fetch import case status if exists
        let importStatus = null;
        if (order.import_id) {
          const { data: importCase } = await supabase
            .from('imports')
            .select('status')
            .eq('id', order.import_id)
            .single();
          importStatus = importCase?.status || null;
        }

        return {
          id: order.id,
          created_at: order.created_at,
          updated_at: order.updated_at,
          status: order.status,
          supplier_name: supplier?.namn || 'Unknown',
          supplier_type: supplier?.type || null,
          importer_name: importer?.legal_name || 'Unknown',
          import_id: order.import_id,
          import_status: importStatus,
          lines_count: order.total_lines,
          total_quantity: order.total_quantity,
          currency: order.currency
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
    console.error('Error listing restaurant orders:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
