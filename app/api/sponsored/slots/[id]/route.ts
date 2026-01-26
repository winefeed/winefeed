/**
 * SPONSORED SLOT DETAIL API
 *
 * DELETE /api/sponsored/slots/[id]
 * Unassign (cancel) a slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';
import { actorService } from '@/lib/actor-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: slotId } = await params;

    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Resolve actor - must be supplier
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'Supplier access required' },
        { status: 403 }
      );
    }

    // Unassign slot
    const result = await sponsoredSlotsService.unassignSlot(
      slotId,
      actor.supplier_id,
      tenantId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Slot unassigned successfully'
    });

  } catch (error: any) {
    console.error('Error unassigning slot:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
