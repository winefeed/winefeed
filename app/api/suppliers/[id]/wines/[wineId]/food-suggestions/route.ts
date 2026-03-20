/**
 * FOOD SUGGESTIONS API
 *
 * GET /api/suppliers/[id]/wines/[wineId]/food-suggestions
 *
 * Returns food pairing suggestions for a specific wine.
 * Uses reverse pairing engine — pure lookup, no AI calls.
 *
 * Auth: supplier must own the wine, or admin, or restaurant viewing results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import { suggestFoodsForWine } from '@/lib/matching-agent/reverse-pairing';

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

    const { data: wine, error } = await adminClient
      .from('supplier_wines')
      .select('grape, color, region, country, body, tannin, acidity, description')
      .eq('id', wineId)
      .eq('supplier_id', supplierId)
      .single();

    if (error || !wine) {
      return NextResponse.json({ error: 'Wine not found' }, { status: 404 });
    }

    const suggestions = suggestFoodsForWine({
      grape: wine.grape,
      color: wine.color,
      region: wine.region,
      country: wine.country,
      body: wine.body,
      tannin: wine.tannin,
      acidity: wine.acidity,
      description: wine.description,
    });

    return NextResponse.json({ suggestions });

  } catch (error: unknown) {
    console.error('Error generating food suggestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
