/**
 * SIMILAR WINES API
 *
 * GET /api/suppliers/[id]/wines/[wineId]/similar
 *
 * Returns similar wines from the catalog for cross-supplier discovery.
 * Uses wine similarity engine — pure lookup, no AI calls.
 *
 * Auth: any authenticated user (supplier, restaurant, admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import { findSimilarWines } from '@/lib/matching-agent/wine-similarity';
import type { SupplierWineRow } from '@/lib/matching-agent/types';

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

    // Allow: admin, supplier owner, or any authenticated restaurant user
    const isAdmin = actorService.hasRole(actor, 'ADMIN');
    const isOwner = actorService.hasRole(actor, 'SELLER') && actor.supplier_id === supplierId;
    const isRestaurant = actorService.hasRole(actor, 'RESTAURANT');

    if (!isAdmin && !isOwner && !isRestaurant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { adminClient } = await createRouteClients();

    // Fetch the target wine
    const { data: targetWine, error: targetError } = await adminClient
      .from('supplier_wines')
      .select('*')
      .eq('id', wineId)
      .eq('supplier_id', supplierId)
      .single();

    if (targetError || !targetWine) {
      return NextResponse.json({ error: 'Wine not found' }, { status: 404 });
    }

    // Determine if this is a same-supplier query (for supplier portfolio view)
    const sameSupplierOnly = request.nextUrl.searchParams.get('same_supplier') === 'true';

    // Fetch all active wines from catalog
    let query = adminClient
      .from('supplier_wines')
      .select('*')
      .eq('is_active', true);

    if (sameSupplierOnly) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: allWines, error: allError } = await query;

    if (allError || !allWines) {
      return NextResponse.json({ error: 'Could not fetch wines' }, { status: 500 });
    }

    const similar = findSimilarWines(
      targetWine as SupplierWineRow,
      allWines as SupplierWineRow[],
      8,
    );

    // For API response, include supplier info for each similar wine
    const supplierIds = [...new Set(similar.map(s => s.wine.supplier_id))];
    let suppliersMap: Record<string, { id: string; namn: string }> = {};

    if (supplierIds.length > 0) {
      const { data: suppliers } = await adminClient
        .from('suppliers')
        .select('id, namn')
        .in('id', supplierIds);

      if (suppliers) {
        suppliersMap = Object.fromEntries(suppliers.map(s => [s.id, s]));
      }
    }

    return NextResponse.json({
      similar: similar.map(s => ({
        wine: {
          id: s.wine.id,
          name: s.wine.name,
          producer: s.wine.producer,
          country: s.wine.country,
          region: s.wine.region,
          grape: s.wine.grape,
          color: s.wine.color,
          vintage: s.wine.vintage,
          price_ex_vat_sek: s.wine.price_ex_vat_sek,
          supplier_id: s.wine.supplier_id,
          supplier_name: suppliersMap[s.wine.supplier_id]?.namn || '',
          moq: s.wine.moq || s.wine.min_order_qty,
          stock_qty: s.wine.stock_qty,
          organic: s.wine.organic,
          biodynamic: s.wine.biodynamic,
        },
        similarity: s.similarity,
        reasons: s.reasons,
      })),
    });

  } catch (error: unknown) {
    console.error('Error finding similar wines:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
