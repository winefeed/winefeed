/**
 * SPONSORED SLOTS API
 *
 * GET /api/sponsored/slots
 * Get supplier's active slots
 *
 * POST /api/sponsored/slots
 * Assign a slot to a category (uses entitlement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest) {
  try {
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

    if (!actor.supplier_id && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Supplier access required' },
        { status: 403 }
      );
    }

    // Get supplier_id from query param (admin) or from actor
    const searchParams = request.nextUrl.searchParams;
    const supplierId = actorService.hasRole(actor, 'ADMIN')
      ? searchParams.get('supplier_id') || actor.supplier_id
      : actor.supplier_id;

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID required' },
        { status: 400 }
      );
    }

    // Get supplier's slots
    const slots = await sponsoredSlotsService.getSupplierSlots(supplierId);

    // Get entitlement info
    const entitlement = await sponsoredSlotsService.getSupplierEntitlement(
      supplierId,
      tenantId
    );

    return NextResponse.json({
      slots,
      entitlement: {
        included_slots: entitlement.included_slots,
        purchased_slots: entitlement.purchased_slots,
        total_slots: entitlement.total_slots,
        used_slots: entitlement.used_slots,
        remaining_slots: entitlement.remaining_slots
      }
    });

  } catch (error: any) {
    console.error('Error fetching sponsored slots:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Parse body
    const body = await request.json();
    const { category_id } = body;

    if (!category_id) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      );
    }

    // Assign slot
    const result = await sponsoredSlotsService.assignSlot(
      actor.supplier_id,
      category_id,
      tenantId,
      'INCLUDED'  // Using included slot from entitlement
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      slot: result.slot
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error assigning slot:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
