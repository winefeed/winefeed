/**
 * SUPPLIER OFFERS API
 *
 * GET /api/suppliers/[id]/offers - List offers sent by supplier
 * POST /api/suppliers/[id]/offers - Create new offer
 *
 * REQUIRES: User must be SELLER and owner of the supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    // Build query
    let query = supabase
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
        quote_request:quote_requests!inner(
          id,
          wine:wines!inner(name),
          restaurant:restaurants!inner(name)
        )
      `)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: offers, error } = await query;

    if (error) {
      console.error('Error fetching offers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch offers' },
        { status: 500 }
      );
    }

    // Transform to flat structure
    const transformedOffers = (offers || []).map((offer: any) => ({
      id: offer.id,
      request_id: offer.quote_request?.id,
      restaurant_name: offer.quote_request?.restaurant?.name || 'Okänd restaurang',
      wine_name: offer.quote_request?.wine?.name || 'Okänt vin',
      quantity: offer.quantity,
      offered_price: offer.offered_price,
      status: offer.status,
      created_at: offer.created_at,
      expires_at: offer.expires_at,
      // Shipping info
      is_franco: offer.is_franco || false,
      shipping_cost_sek: offer.shipping_cost_sek,
      shipping_notes: offer.shipping_notes,
      // Calculated total with shipping
      total_with_shipping: offer.is_franco
        ? offer.offered_price * offer.quantity
        : (offer.offered_price * offer.quantity) + (offer.shipping_cost_sek || 0),
    }));

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

    // Verify quote request exists and is open
    const { data: quoteRequest } = await supabase
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
    const { data: existingOffer } = await supabase
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
    const { data: offer, error } = await supabase
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
