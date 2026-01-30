/**
 * IOR ORDER CREATE IMPORT CASE API
 *
 * POST /api/ior/orders/[id]/create-import
 *
 * Create import case for order (on-demand)
 * Requires restaurant to have an approved DDL
 *
 * Request body: (empty or optional metadata)
 *
 * Security:
 * - Tenant isolation
 * - IOR can only create import case for orders where importer_of_record_id matches their importer
 * - Verifies restaurant has approved DDL
 * - Auto-links order to created import case
 */

import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '@/lib/order-service';
import { actorService } from '@/lib/actor-service';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    // Verify IOR access
    if (!actorService.hasIORAccess(actor)) {
      return NextResponse.json(
        { error: 'Access denied: IOR role required' },
        { status: 403 }
      );
    }

    const importerId = actor.importer_id!;

    // Verify IOR access (order must belong to this importer)
    const orderCheck = await orderService.getOrder(orderId, tenantId);
    if (!orderCheck) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (orderCheck.order.importer_of_record_id !== importerId) {
      return NextResponse.json(
        { error: 'Access denied: You are not the IOR for this order' },
        { status: 403 }
      );
    }

    // Check if order already has import case
    if (orderCheck.order.import_case_id) {
      return NextResponse.json(
        {
          error: 'Order already has import case',
          import_id: orderCheck.order.import_case_id
        },
        { status: 409 }
      );
    }

    // Create import case
    const result = await orderService.createImportCaseForOrder({
      order_id: orderId,
      tenant_id: tenantId,
      actor_user_id: userId || undefined
    });

    return NextResponse.json(
      {
        message: 'Import case created and linked successfully',
        order_id: orderId,
        import_id: result.import_id
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating import case:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.message?.includes('already linked')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error.message?.includes('No approved DDL')) {
      return NextResponse.json(
        {
          error: 'Cannot create import case',
          details: error.message,
          hint: 'Restaurant must have an approved Direct Delivery Location (DDL) before creating an import case.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
