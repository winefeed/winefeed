/**
 * SPONSORED ENTITLEMENT API
 *
 * GET /api/sponsored/entitlement
 * Get supplier's current slot entitlement
 *
 * POST /api/sponsored/entitlement/sync
 * Sync entitlements from subscription tier (called after subscription changes)
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

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'Supplier access required' },
        { status: 403 }
      );
    }

    // Get entitlement
    const entitlement = await sponsoredSlotsService.getSupplierEntitlement(
      actor.supplier_id,
      tenantId
    );

    return NextResponse.json({
      entitlement: {
        included_slots: entitlement.included_slots,
        purchased_slots: entitlement.purchased_slots,
        total_slots: entitlement.total_slots,
        used_slots: entitlement.used_slots,
        remaining_slots: entitlement.remaining_slots
      }
    });

  } catch (error: any) {
    console.error('Error fetching entitlement:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
