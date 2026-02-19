/**
 * SUPPLIER OFFERS API
 *
 * GET /api/suppliers/[id]/offers - List offers sent by supplier
 * POST /api/suppliers/[id]/offers - Create new offer (legacy single-wine)
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
    const { adminClient } = await createRouteClients();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    // Build query — join offer_lines + supplier_wines for multi-line offers
    let query = adminClient
      .from('offers')
      .select(`
        id,
        offered_price,
        quantity,
        status,
        created_at,
        expires_at,
        notes,
        is_franco,
        shipping_cost_sek,
        shipping_notes,
        supplier_wine_id,
        min_total_quantity,
        request_id,
        offer_lines (
          id,
          supplier_wine_id,
          offered_unit_price_ore,
          price_ex_vat_sek,
          quantity,
          accepted,
          supplier_wines (
            name,
            producer,
            vintage
          )
        ),
        requests (
          id,
          restaurant_id,
          restaurants (
            name
          )
        )
      `)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    // Filter by status
    if (status !== 'all') {
      if (status === 'accepted') {
        // Include both ACCEPTED and PARTIALLY_ACCEPTED
        query = query.in('status', ['accepted', 'ACCEPTED', 'PARTIALLY_ACCEPTED']);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data: offers, error } = await query;

    if (error) {
      console.error('Error fetching offers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch offers' },
        { status: 500 }
      );
    }

    // Transform to response structure with lines[]
    const transformedOffers = (offers || []).map((offer: any) => {
      const requestData = offer.requests as any;
      const restaurantName = requestData?.restaurants?.name || 'Okänd restaurang';

      const lines = (offer.offer_lines || []).map((line: any) => {
        const sw = line.supplier_wines;
        const priceSek = line.price_ex_vat_sek
          ? Number(line.price_ex_vat_sek)
          : line.offered_unit_price_ore
            ? line.offered_unit_price_ore / 100
            : 0;
        return {
          id: line.id,
          wineName: sw?.name || 'Okänt vin',
          producer: sw?.producer || '',
          vintage: sw?.vintage || null,
          priceSek,
          quantity: line.quantity || 0,
          totalSek: priceSek * (line.quantity || 0),
          accepted: line.accepted,
        };
      });

      // Legacy fallback: no offer_lines → build virtual line from offer-level data
      if (lines.length === 0 && offer.offered_price) {
        lines.push({
          id: null,
          wineName: 'Vin', // Legacy offers don't have wine name in lines
          producer: '',
          vintage: null,
          priceSek: offer.offered_price,
          quantity: offer.quantity || 0,
          totalSek: offer.offered_price * (offer.quantity || 0),
          accepted: null,
        });
      }

      const totalBottles = lines.reduce((sum: number, l: any) => sum + l.quantity, 0);
      const totalSek = lines.reduce((sum: number, l: any) => sum + l.totalSek, 0);
      const totalWithShipping = offer.is_franco
        ? totalSek
        : totalSek + (offer.shipping_cost_sek || 0);

      return {
        id: offer.id,
        request_id: requestData?.id || offer.request_id,
        restaurant_name: restaurantName,
        status: offer.status,
        created_at: offer.created_at,
        expires_at: offer.expires_at,
        is_franco: offer.is_franco || false,
        shipping_cost_sek: offer.shipping_cost_sek,
        min_total_quantity: offer.min_total_quantity,
        lines,
        wineCount: lines.length,
        totalBottles,
        totalSek,
        totalWithShipping,
        // Legacy flat fields for backwards compat
        wine_name: lines[0]?.wineName || 'Okänt vin',
        quantity: totalBottles,
        offered_price: totalSek,
      };
    });

    return NextResponse.json({
      offers: transformedOffers,
    });

  } catch (error: any) {
    console.error('Error in offers API:', error);
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

    // Must be SELLER and own this supplier
    if (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      quote_request_id,
      offered_price,
      quantity,
      notes,
      expires_at,
      // Shipping fields
      is_franco,
      shipping_cost_sek,
      shipping_notes
    } = body;

    // Validate required fields
    if (!quote_request_id || !offered_price || !quantity) {
      return NextResponse.json(
        { error: 'quote_request_id, offered_price, and quantity are required' },
        { status: 400 }
      );
    }

    // Validate shipping: if not franco, shipping_cost_sek should be provided
    // (optional for backwards compatibility)
    const isFranco = is_franco === true;

    const { adminClient } = await createRouteClients();

    // Verify quote request exists and is open
    const { data: quoteRequest } = await adminClient
      .from('quote_requests')
      .select('id, status')
      .eq('id', quote_request_id)
      .single();

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    if (quoteRequest.status !== 'open') {
      return NextResponse.json(
        { error: 'Quote request is no longer open' },
        { status: 400 }
      );
    }

    // Check if supplier already has an offer for this request
    const { data: existingOffer } = await adminClient
      .from('offers')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('quote_request_id', quote_request_id)
      .single();

    if (existingOffer) {
      return NextResponse.json(
        { error: 'You already have an offer for this request' },
        { status: 400 }
      );
    }

    // Create offer with shipping info
    const { data: offer, error } = await adminClient
      .from('offers')
      .insert({
        supplier_id: supplierId,
        quote_request_id,
        offered_price,
        quantity,
        notes: notes || null,
        expires_at: expires_at || null,
        status: 'pending',
        // Shipping fields
        is_franco: isFranco,
        shipping_cost_sek: isFranco ? null : (shipping_cost_sek || null),
        shipping_notes: shipping_notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating offer:', error);
      return NextResponse.json(
        { error: 'Failed to create offer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ offer }, { status: 201 });

  } catch (error: any) {
    console.error('Error in offers POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
