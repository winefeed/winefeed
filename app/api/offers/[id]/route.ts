/**
 * OFFERS API - GET/PATCH BY ID
 *
 * GET /api/offers/[id] - Get offer with lines and events
 * PATCH /api/offers/[id] - Update offer (only if status = DRAFT)
 *
 * REQUIRES: RESTAURANT (owner), SELLER (creator), or ADMIN role
 *
 * Security:
 * - Tenant isolation
 * - User authentication required
 * - Immutability enforcement (cannot update if locked)
 * - Audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { offerService } from '@/lib/offer-service';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Alias id to offerId per routing standard
    const { id: offerId } = params;

    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Get offer via service
    const data = await offerService.getOffer(tenantId, offerId);

    if (!data) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Access control: ADMIN sees all, RESTAURANT must own request, SELLER must own offer
    if (!actorService.hasRole(actor, 'ADMIN')) {
      if (actorService.hasRole(actor, 'RESTAURANT')) {
        if (data.offer.restaurant_id !== actor.restaurant_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else if (actorService.hasRole(actor, 'SELLER')) {
        if (data.offer.supplier_id !== actor.supplier_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
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

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Alias id to offerId per routing standard
    const { id: offerId } = params;

    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only SELLER (owner) or ADMIN can update offers
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify ownership for SELLER
    if (actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      const existingOffer = await offerService.getOffer(tenantId, offerId);
      if (!existingOffer || existingOffer.offer.supplier_id !== actor.supplier_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
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
