/**
 * OFFERS API - GET/PATCH BY ID
 *
 * GET /api/offers/[id] - Get offer with lines and events
 * PATCH /api/offers/[id] - Update offer (only if status = DRAFT)
 *
 * Security:
 * - Tenant isolation
 * - Immutability enforcement (cannot update if locked)
 * - Audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { offerService } from '@/lib/offer-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Alias id to offerId per routing standard
    const { id: offerId } = params;

    // Extract tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Get offer via service
    const data = await offerService.getOffer(tenantId, offerId);

    if (!data) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching offer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Alias id to offerId per routing standard
    const { id: offerId } = params;

    // Extract tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { offer, lines } = body;

    // Update offer metadata
    if (offer) {
      try {
        await offerService.updateOffer(tenantId, offerId, offer);
      } catch (error: any) {
        if (error.message?.includes('Cannot update offer')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }

    // Update lines
    if (lines && Array.isArray(lines)) {
      try {
        await offerService.updateOfferLines(tenantId, offerId, lines);
      } catch (error: any) {
        if (error.message?.includes('Cannot update lines')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message?.includes('SECURITY_VIOLATION')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    // Return updated offer
    const data = await offerService.getOffer(tenantId, offerId);

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Error updating offer:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
