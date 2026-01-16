/**
 * RESTAURANT ORDER DETAIL API
 *
 * GET /api/restaurant/orders/[id]
 *
 * Get order details for restaurant (read-only tracking)
 *
 * Security:
 * - Tenant isolation
 * - Restaurant can only see orders where restaurant_id matches their restaurant
 * - Requires RESTAURANT role (verified via actor service)
 *
 * Returns:
 * - Order details with lines, events timeline, and compliance summary
 * - Compliance summary includes: import status, DDL status, latest 5369 document
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { orderService } from '@/lib/order-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Alias id to orderId per routing standard
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

    // Fetch order with details
    const result = await orderService.getOrder(orderId, tenantId);

    if (!result) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { order, lines, events } = result;

    // Verify restaurant ownership
    if (order.restaurant_id !== restaurantId) {
      return NextResponse.json(
        { error: 'Access denied: Order does not belong to your restaurant' },
        { status: 403 }
      );
    }

    // Enrich order with supplier info
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('namn, type, kontakt_email')
      .eq('id', order.seller_supplier_id)
      .single();

    // Enrich order with importer info
    const { data: importer } = await supabase
      .from('importers')
      .select('legal_name, contact_email')
      .eq('id', order.importer_of_record_id)
      .single();

    // Fetch import case if exists (compliance summary)
    let importCase = null;
    let documents = [];
    let complianceSummary = null;

    if (order.import_id) {
      const { data: imp } = await supabase
        .from('imports')
        .select(`
          id,
          status,
          created_at,
          delivery_location:direct_delivery_locations(
            id,
            status,
            delivery_address_line1,
            postal_code,
            city
          )
        `)
        .eq('id', order.import_id)
        .single();
      importCase = imp;

      // Fetch latest 5369 document
      if (imp) {
        const { data: docs } = await supabase
          .from('import_documents')
          .select('id, document_type, version, generated_at, file_path')
          .eq('import_id', order.import_id)
          .eq('document_type', '5369')
          .order('version', { ascending: false })
          .limit(1);

        documents = docs || [];
      }

      // Build compliance summary (read-only)
      complianceSummary = {
        import_case_id: imp?.id || null,
        import_status: imp?.status || null,
        ddl_status: imp?.delivery_location?.status || null,
        ddl_address: imp?.delivery_location
          ? `${imp.delivery_location.delivery_address_line1}, ${imp.delivery_location.postal_code} ${imp.delivery_location.city}`
          : null,
        latest_5369_version: documents.length > 0 ? documents[0].version : null,
        latest_5369_generated_at: documents.length > 0 ? documents[0].generated_at : null
      };
    }

    return NextResponse.json(
      {
        order: {
          ...order,
          supplier: supplier || null,
          importer: importer || null
        },
        lines,
        events,
        compliance: complianceSummary
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching restaurant order:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
