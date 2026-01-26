/**
 * IOR ORDER DETAIL API
 *
 * GET /api/ior/orders/[id]
 *
 * Get order details with lines and events
 *
 * Security:
 * - Tenant isolation
 * - IOR can only see orders where importer_of_record_id matches their importer
 * - For MVP: importer_id passed via header (x-importer-id)
 *
 * Returns:
 * - Order details with enriched restaurant/supplier info
 * - Order lines (snapshot from offer)
 * - Order events (audit trail)
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

    // Verify IOR or ADMIN access
    const hasIORAccess = actorService.hasIORAccess(actor);
    const isAdmin = actorService.hasRole(actor, 'ADMIN');

    if (!hasIORAccess && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: IOR role required' },
        { status: 403 }
      );
    }

    const importerId = actor.importer_id;

    // Fetch order with details
    const result = await orderService.getOrder(orderId, tenantId);

    if (!result) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { order, lines, events } = result;

    // Verify IOR access (order must belong to this importer) - ADMIN bypasses this check
    if (!isAdmin && order.importer_of_record_id !== importerId) {
      return NextResponse.json(
        { error: 'Access denied: You are not the IOR for this order' },
        { status: 403 }
      );
    }

    // Enrich order with restaurant info
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name, contact_email, contact_phone, address')
      .eq('id', order.restaurant_id)
      .single();

    // Enrich order with supplier info
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('namn, type, kontakt_email, kontakt_telefon')
      .eq('id', order.seller_supplier_id)
      .single();

    // Enrich order with importer info (IOR details)
    const { data: importer } = await supabase
      .from('importers')
      .select('legal_name, org_number, contact_name, contact_email, contact_phone, license_number')
      .eq('id', order.importer_of_record_id)
      .single();

    // Fetch delivery location if exists
    let deliveryLocation = null;
    if (order.delivery_location_id) {
      const { data: ddl } = await supabase
        .from('direct_delivery_locations')
        .select('*')
        .eq('id', order.delivery_location_id)
        .single();
      deliveryLocation = ddl;
    }

    // Fetch import case if exists (with full compliance details)
    let importCase: any = null;
    let documents: any[] = [];
    if (order.import_case_id) {
      const { data: imp } = await supabase
        .from('imports')
        .select(`
          id,
          status,
          created_at,
          updated_at,
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

      // Fetch 5369 documents for this import case
      if (imp) {
        const { data: docs } = await supabase
          .from('import_documents')
          .select('id, document_type, version, generated_at, file_path, file_size')
          .eq('import_id', order.import_case_id)
          .eq('document_type', '5369')
          .order('version', { ascending: false })
          .limit(5);  // Latest 5 versions

        documents = docs || [];
      }
    }

    return NextResponse.json(
      {
        order: {
          ...order,
          restaurant: restaurant || null,
          supplier: supplier || null,
          importer: importer || null,
          delivery_location: deliveryLocation,
          import_case: importCase,
          compliance: {
            import_case_status: importCase?.status || null,
            ddl_status: importCase?.delivery_location?.status || null,
            documents_count: documents.length,
            latest_5369: documents[0] || null
          }
        },
        lines,
        events,
        documents
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching IOR order:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
