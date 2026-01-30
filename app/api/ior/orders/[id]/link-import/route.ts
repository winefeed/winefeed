/**
 * IOR ORDER LINK IMPORT CASE API
 *
 * POST /api/ior/orders/[id]/link-import
 *
 * Link order to existing import case
 *
 * Request body:
 * {
 *   "import_id": "uuid"
 * }
 *
 * Security:
 * - Tenant isolation
 * - IOR can only link orders where importer_of_record_id matches their importer
 * - Import case must belong to same IOR
 * - Validates IOR match between order and import case
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

    // Parse request body
    const body = await request.json();
    const { import_id } = body;

    if (!import_id) {
      return NextResponse.json(
        { error: 'Missing required field: import_id' },
        { status: 400 }
      );
    }

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

    // Link import case
    await orderService.linkImportCase({
      order_id: orderId,
      import_id,
      tenant_id: tenantId
    });

    return NextResponse.json(
      {
        message: 'Import case linked successfully',
        order_id: orderId,
        import_id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error linking import case:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.message?.includes('IOR mismatch')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
