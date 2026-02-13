/**
 * SUPPLIER WINES API
 *
 * GET /api/suppliers/[id]/wines - List wines in supplier catalog
 * POST /api/suppliers/[id]/wines - Add wine to catalog
 *
 * REQUIRES: User must be SELLER and owner of the supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params;

    // Auth check - verify user owns this supplier
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER and own this supplier (or ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    const { userClient } = await createRouteClients();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = userClient
      .from('supplier_wines')
      .select('*', { count: 'exact' })
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    // Add search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,producer.ilike.%${search}%,article_number.ilike.%${search}%`);
    }

    // Filter by status if provided
    const status = searchParams.get('status');
    if (status && ['ACTIVE', 'TEMPORARILY_UNAVAILABLE', 'END_OF_VINTAGE'].includes(status)) {
      query = query.eq('status', status);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: wines, error, count } = await query;

    if (error) {
      console.error('Error fetching wines:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wines' },
        { status: 500 }
      );
    }

    // Get offer usage counts for these wines
    // Count how many offer_lines reference each wine by name (since we don't have direct FK)
    const wineNames = (wines || []).map(w => w.name);
    let offerCounts: Record<string, number> = {};

    if (wineNames.length > 0) {
      const { data: offerLines } = await userClient
        .from('offer_lines')
        .select('name')
        .in('name', wineNames);

      if (offerLines) {
        for (const line of offerLines) {
          offerCounts[line.name] = (offerCounts[line.name] || 0) + 1;
        }
      }
    }

    // Enrich wines with offer count
    const enrichedWines = (wines || []).map(wine => ({
      ...wine,
      offer_count: offerCounts[wine.name] || 0,
    }));

    return NextResponse.json({
      wines: enrichedWines,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });

  } catch (error: any) {
    console.error('Error in wines API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params;

    // Auth check - verify user owns this supplier
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER and own this supplier (or ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { name, producer, vintage, price } = body;
    if (!name) {
      return NextResponse.json(
        { error: 'Wine name is required' },
        { status: 400 }
      );
    }

    const { userClient } = await createRouteClients();

    // Create wine entry
    const { data: wine, error } = await userClient
      .from('supplier_wines')
      .insert({
        supplier_id: supplierId,
        name,
        producer: producer || null,
        vintage: vintage || null,
        country: body.country || null,
        region: body.region || null,
        grape_varieties: body.grape_varieties || null,
        wine_type: body.wine_type || null,
        volume_ml: body.volume_ml || 750,
        alcohol_percentage: body.alcohol_percentage || null,
        price: price || null,
        currency: body.currency || 'SEK',
        stock_quantity: body.stock_quantity || null,
        article_number: body.article_number || null,
        ean: body.ean || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating wine:', error);
      return NextResponse.json(
        { error: 'Failed to create wine' },
        { status: 500 }
      );
    }

    return NextResponse.json({ wine }, { status: 201 });

  } catch (error: any) {
    console.error('Error in wines POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
