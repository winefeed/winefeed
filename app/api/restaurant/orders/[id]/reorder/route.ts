/**
 * REORDER API - Quick reorder from existing order
 *
 * POST /api/restaurant/orders/[id]/reorder
 *
 * Creates a new request to the same supplier with the same wines.
 * Allows quantity adjustments.
 *
 * Body:
 * {
 *   lines: [{ wine_sku_id: string, quantity: number }],  // Optional: override quantities
 *   leverans_ort?: string,
 *   leverans_senast?: string
 * }
 *
 * Returns:
 * - request_id: The new request ID
 * - message: Success message
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface ReorderLineInput {
  wine_sku_id?: string;
  line_number?: number;
  quantity: number;
}

interface ReorderInput {
  lines?: ReorderLineInput[];
  leverans_ort?: string;
  leverans_senast?: string;
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: orderId } = params;

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

    // Parse request body
    const body: ReorderInput = await request.json().catch(() => ({}));

    // 1. Fetch original order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        restaurant_id,
        seller_supplier_id,
        delivery_city,
        delivery_address
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

    // Verify restaurant ownership
    if (order.restaurant_id !== restaurantId) {
      return NextResponse.json(
        { error: 'Access denied: Order does not belong to your restaurant' },
        { status: 403 }
      );
    }

    // 2. Fetch original order lines
    const { data: orderLines, error: linesError } = await supabase
      .from('order_lines')
      .select(`
        id,
        wine_sku_id,
        wine_master_id,
        wine_name,
        producer,
        vintage,
        country,
        region,
        quantity,
        unit_price_sek,
        line_number
      `)
      .eq('order_id', orderId)
      .order('line_number', { ascending: true });

    if (linesError || !orderLines || orderLines.length === 0) {
      return NextResponse.json(
        { error: 'Order has no lines' },
        { status: 400 }
      );
    }

    // 3. Fetch supplier info
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, namn')
      .eq('id', order.seller_supplier_id)
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: 'Original supplier not found' },
        { status: 400 }
      );
    }

    // 4. Merge quantities from input (if provided)
    const linesToOrder = orderLines.map((line) => {
      // Find override quantity if provided
      const override = body.lines?.find(
        (l) => l.wine_sku_id === line.wine_sku_id || l.line_number === line.line_number
      );
      return {
        ...line,
        quantity: override?.quantity ?? line.quantity
      };
    });

    // Calculate totals
    const totalQuantity = linesToOrder.reduce((sum, line) => sum + line.quantity, 0);
    const avgPrice = linesToOrder.reduce((sum, line) => sum + (line.unit_price_sek || 0), 0) / linesToOrder.length;

    // 5. Create new request (marked as reorder)
    const { data: newRequest, error: requestError } = await supabase
      .from('requests')
      .insert({
        tenant_id: tenantId,
        restaurant_id: restaurantId,
        // Build fritext from wines
        fritext: `Återbeställning: ${linesToOrder.map(l => l.wine_name).join(', ')}`,
        antal_flaskor: totalQuantity,
        budget_per_flaska: Math.ceil(avgPrice * 1.1), // Allow 10% price increase
        leverans_ort: body.leverans_ort || order.delivery_city || null,
        leverans_senast: body.leverans_senast || null,
        status: 'pending',
        // Mark as reorder for tracking
        metadata: {
          is_reorder: true,
          original_order_id: orderId,
          target_supplier_id: supplier.id,
          target_supplier_name: supplier.namn
        }
      })
      .select()
      .single();

    if (requestError || !newRequest) {
      console.error('Failed to create reorder request:', requestError);
      return NextResponse.json(
        { error: 'Failed to create reorder request' },
        { status: 500 }
      );
    }

    // 6. Create request lines (so supplier sees exact wines)
    const requestLines = linesToOrder.map((line, index) => ({
      tenant_id: tenantId,
      request_id: newRequest.id,
      wine_sku_id: line.wine_sku_id,
      wine_master_id: line.wine_master_id,
      wine_name: line.wine_name,
      producer: line.producer,
      vintage: line.vintage,
      country: line.country,
      region: line.region,
      quantity: line.quantity,
      target_price_sek: line.unit_price_sek,
      line_number: index + 1
    }));

    // Check if request_lines table exists, if not just store in metadata
    const { error: requestLinesError } = await supabase
      .from('request_lines')
      .insert(requestLines);

    if (requestLinesError) {
      // Table might not exist - update request metadata instead
      console.log('request_lines table not available, storing in metadata');
      await supabase
        .from('requests')
        .update({
          metadata: {
            ...newRequest.metadata,
            lines: linesToOrder.map(l => ({
              wine_sku_id: l.wine_sku_id,
              wine_name: l.wine_name,
              producer: l.producer,
              quantity: l.quantity,
              target_price_sek: l.unit_price_sek
            }))
          }
        })
        .eq('id', newRequest.id);
    }

    // 7. Send notification to supplier about the reorder request
    // (The supplier will see this as a new request with the exact wines pre-filled)

    return NextResponse.json({
      request_id: newRequest.id,
      supplier_id: supplier.id,
      supplier_name: supplier.namn,
      total_quantity: totalQuantity,
      lines_count: linesToOrder.length,
      message: `Återbeställning skickad till ${supplier.namn}`
    });

  } catch (error: unknown) {
    console.error('Error processing reorder:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
