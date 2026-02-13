/**
 * BULK UPDATE WINES API
 *
 * POST /api/suppliers/[id]/wines/bulk-update
 *
 * Update multiple wines at once
 * Pilot Loop 2.0: Efficient catalog management
 *
 * Body:
 * {
 *   wine_ids: string[],
 *   updates: { status?: string, price_ex_vat_sek?: number, ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

// Fields allowed for bulk update (subset of individual update)
const BULK_EDITABLE_FIELDS = [
  'status',
  'price_ex_vat_sek',
  'stock_qty',
  'moq',  // min_order_qty in DB is 'moq'
];

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId } = await params;

    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { wine_ids, updates } = body;

    // Validate input
    if (!wine_ids || !Array.isArray(wine_ids) || wine_ids.length === 0) {
      return NextResponse.json({ error: 'wine_ids array is required' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Limit batch size
    if (wine_ids.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 wines per batch' }, { status: 400 });
    }

    // Filter to only allowed fields
    const filteredUpdates: Record<string, any> = {};
    for (const field of BULK_EDITABLE_FIELDS) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate status if provided
    if (filteredUpdates.status && !['ACTIVE', 'TEMPORARILY_UNAVAILABLE', 'END_OF_VINTAGE'].includes(filteredUpdates.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const { adminClient } = await createRouteClients();

    // Verify all wines belong to this supplier
    const { data: existingWines, error: checkError } = await adminClient
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', supplierId)
      .in('id', wine_ids);

    if (checkError) {
      console.error('Error checking wines:', checkError);
      return NextResponse.json({ error: 'Failed to verify wines' }, { status: 500 });
    }

    const existingIds = new Set(existingWines?.map(w => w.id) || []);
    const invalidIds = wine_ids.filter(id => !existingIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json({
        error: 'Some wine IDs are invalid or do not belong to this supplier',
        invalid_ids: invalidIds.slice(0, 5), // Show first 5
      }, { status: 400 });
    }

    // Perform bulk update
    const { data: updatedWines, error: updateError } = await adminClient
      .from('supplier_wines')
      .update(filteredUpdates)
      .eq('supplier_id', supplierId)
      .in('id', wine_ids)
      .select('id');

    if (updateError) {
      console.error('Error bulk updating wines:', updateError);
      return NextResponse.json({ error: 'Failed to update wines' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated_count: updatedWines?.length || 0,
      updated_fields: Object.keys(filteredUpdates),
    });

  } catch (error: any) {
    console.error('Error in bulk update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
