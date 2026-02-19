/**
 * SUPPLIER WINE DETAIL API
 *
 * GET /api/suppliers/[id]/wines/[wineId] - Get single wine
 * PATCH /api/suppliers/[id]/wines/[wineId] - Update wine (inline editing)
 * DELETE /api/suppliers/[id]/wines/[wineId] - Delete wine
 *
 * Pilot Loop 2.0: Fast inline editing for catalog management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

// Allowed fields for inline editing
const EDITABLE_FIELDS = [
  'name',
  'producer',
  'vintage',
  'price_ex_vat_sek',
  'stock_qty',
  'status',
  'moq',  // min_order_qty in DB is 'moq'
  'lead_time_days',
  'region',
  'country',
  'grape',
  'notes',
  'description',
  'appellation',
  'alcohol_pct',
  'color',
  'bottle_size_ml',
  'organic',
  'biodynamic',
  'sku',
  'case_size',
];

const VALID_COLORS = ['red', 'white', 'rose', 'sparkling', 'fortified', 'orange'];

type RouteParams = {
  params: Promise<{ id: string; wineId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, wineId } = await params;

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

    const { adminClient } = await createRouteClients();

    const { data: wine, error } = await adminClient
      .from('supplier_wines')
      .select('*')
      .eq('id', wineId)
      .eq('supplier_id', supplierId)
      .single();

    if (error || !wine) {
      return NextResponse.json({ error: 'Wine not found' }, { status: 404 });
    }

    return NextResponse.json({ wine });

  } catch (error: any) {
    console.error('Error fetching wine:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, wineId } = await params;

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

    // Filter to only allowed fields
    const updates: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate status if provided
    if (updates.status && !['ACTIVE', 'TEMPORARILY_UNAVAILABLE', 'END_OF_VINTAGE'].includes(updates.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Validate price if provided (must be > 0)
    if (updates.price_ex_vat_sek !== undefined) {
      if (typeof updates.price_ex_vat_sek !== 'number' || updates.price_ex_vat_sek <= 0) {
        return NextResponse.json({ error: 'Pris måste vara större än 0' }, { status: 400 });
      }
    }

    // Validate notes max length
    if (updates.notes !== undefined && updates.notes !== null) {
      if (typeof updates.notes === 'string' && updates.notes.length > 140) {
        return NextResponse.json({ error: 'Anteckning får max vara 140 tecken' }, { status: 400 });
      }
    }

    // Validate description max length
    if (updates.description !== undefined && updates.description !== null) {
      if (typeof updates.description === 'string' && updates.description.length > 2000) {
        return NextResponse.json({ error: 'Beskrivning får max vara 2000 tecken' }, { status: 400 });
      }
    }

    // Validate appellation max length
    if (updates.appellation !== undefined && updates.appellation !== null) {
      if (typeof updates.appellation === 'string' && updates.appellation.length > 200) {
        return NextResponse.json({ error: 'Appellation får max vara 200 tecken' }, { status: 400 });
      }
    }

    // Validate alcohol_pct range
    if (updates.alcohol_pct !== undefined && updates.alcohol_pct !== null) {
      const pct = Number(updates.alcohol_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: 'Alkoholhalt måste vara mellan 0 och 100' }, { status: 400 });
      }
      updates.alcohol_pct = pct;
    }

    // Validate bottle_size_ml
    if (updates.bottle_size_ml !== undefined && updates.bottle_size_ml !== null) {
      const size = Number(updates.bottle_size_ml);
      if (!Number.isInteger(size) || size <= 0) {
        return NextResponse.json({ error: 'Flaskstorlek måste vara ett positivt heltal' }, { status: 400 });
      }
      updates.bottle_size_ml = size;
    }

    // Validate color
    if (updates.color !== undefined && updates.color !== null) {
      if (!VALID_COLORS.includes(updates.color)) {
        return NextResponse.json({ error: 'Ogiltig färg' }, { status: 400 });
      }
    }

    // Validate booleans
    if (updates.organic !== undefined && updates.organic !== null && typeof updates.organic !== 'boolean') {
      return NextResponse.json({ error: 'organic måste vara true/false' }, { status: 400 });
    }
    if (updates.biodynamic !== undefined && updates.biodynamic !== null && typeof updates.biodynamic !== 'boolean') {
      return NextResponse.json({ error: 'biodynamic måste vara true/false' }, { status: 400 });
    }

    // Validate sku max length
    if (updates.sku !== undefined && updates.sku !== null) {
      if (typeof updates.sku === 'string' && updates.sku.length > 100) {
        return NextResponse.json({ error: 'SKU får max vara 100 tecken' }, { status: 400 });
      }
    }

    // Validate case_size
    if (updates.case_size !== undefined && updates.case_size !== null) {
      const cs = Number(updates.case_size);
      if (!Number.isInteger(cs) || cs <= 0) {
        return NextResponse.json({ error: 'Kartongstorlek måste vara ett positivt heltal' }, { status: 400 });
      }
      updates.case_size = cs;
    }

    const { adminClient } = await createRouteClients();

    const { data: wine, error } = await adminClient
      .from('supplier_wines')
      .update(updates)
      .eq('id', wineId)
      .eq('supplier_id', supplierId)
      .select()
      .single();

    if (error) {
      console.error('Error updating wine:', error);
      return NextResponse.json({ error: 'Failed to update wine' }, { status: 500 });
    }

    if (!wine) {
      return NextResponse.json({ error: 'Wine not found' }, { status: 404 });
    }

    return NextResponse.json({ wine, updated: Object.keys(updates) });

  } catch (error: any) {
    console.error('Error updating wine:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, wineId } = await params;

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

    const { adminClient } = await createRouteClients();

    const { error } = await adminClient
      .from('supplier_wines')
      .delete()
      .eq('id', wineId)
      .eq('supplier_id', supplierId);

    if (error) {
      console.error('Error deleting wine:', error);
      return NextResponse.json({ error: 'Failed to delete wine' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting wine:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
