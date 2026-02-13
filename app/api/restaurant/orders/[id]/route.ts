/**
 * ORDER DETAIL API
 *
 * GET /api/restaurant/orders/[id]
 *
 * Get order details (read-only tracking)
 *
 * Security:
 * - Tenant isolation
 * - RESTAURANT: Can only see orders where restaurant_id matches their restaurant
 * - ADMIN: Can view any order (cross-restaurant access)
 *
 * Returns:
 * - Order details with lines, events timeline, and compliance summary
 * - Compliance summary includes: import status, DDL status, latest 5369 document
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { orderService } from '@/lib/order-service';
import { createRouteClients } from '@/lib/supabase/route-client';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // Verify RESTAURANT or ADMIN access
    const isAdmin = actorService.hasRole(actor, 'ADMIN');
    const isRestaurant = actorService.hasRole(actor, 'RESTAURANT') && actor.restaurant_id;

    if (!isAdmin && !isRestaurant) {
      return NextResponse.json(
        { error: 'Access denied: RESTAURANT or ADMIN role required' },
        { status: 403 }
      );
    }

    // Fetch order with details
    const result = await orderService.getOrder(orderId, tenantId);

    if (!result) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { order, lines, events } = result;

    // Verify restaurant ownership (skip for ADMIN)
    if (!isAdmin && order.restaurant_id !== actor.restaurant_id) {
      return NextResponse.json(
        { error: 'Access denied: Order does not belong to your restaurant' },
        { status: 403 }
      );
    }

    const { userClient } = await createRouteClients();

    // Enrich order with supplier info
    const { data: supplier } = await userClient
      .from('suppliers')
      .select('namn, type, kontakt_email')
      .eq('id', order.seller_supplier_id)
      .single();

    // Enrich order with importer info
    const { data: importer } = await userClient
      .from('importers')
      .select('legal_name, contact_email')
      .eq('id', order.importer_of_record_id)
      .single();

    // Fetch import case if exists (compliance summary)
    let importCase: any = null;
    let documents: any[] = [];
    let complianceSummary: any = null;

    if (order.import_case_id) {
      const { data: imp } = await userClient
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
        .eq('id', order.import_case_id)
        .single();
      importCase = imp;

      // Fetch latest 5369 document
      if (imp) {
        const { data: docs } = await userClient
          .from('import_documents')
          .select('id, document_type, version, generated_at, file_path')
          .eq('import_id', order.import_case_id)
          .eq('document_type', '5369')
          .order('version', { ascending: false })
          .limit(1);

        documents = docs || [];
      }

      // Build compliance summary (read-only)
      const ddl = Array.isArray(imp?.delivery_location) ? imp.delivery_location[0] : imp?.delivery_location;
      complianceSummary = {
        import_case_id: imp?.id || null,
        import_status: imp?.status || null,
        ddl_status: ddl?.status || null,
        ddl_address: ddl
          ? `${ddl.delivery_address_line1}, ${ddl.postal_code} ${ddl.city}`
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
