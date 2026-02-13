/**
 * SUPPLIER EXPIRING OFFERS API
 *
 * GET /api/supplier/expiring-offers - Get offers that are expiring soon
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier linked to user' },
        { status: 404 }
      );
    }

    const { adminClient } = await createRouteClients();

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get offers that are pending/sent and have an expiry date within 7 days
    const { data: offers } = await adminClient
      .from('offers')
      .select(`
        id,
        title,
        status,
        expires_at,
        valid_until,
        created_at,
        restaurants!inner(name)
      `)
      .eq('supplier_id', actor.supplier_id)
      .in('status', ['SENT', 'DRAFT', 'pending'])
      .order('expires_at', { ascending: true, nullsFirst: false });

    if (!offers || offers.length === 0) {
      return NextResponse.json({ offers: [] });
    }

    // Calculate days left and filter to those expiring within 7 days
    const expiringOffers = offers
      .map(offer => {
        // Use expires_at or valid_until or default to 14 days from creation
        const expiryDate = offer.expires_at
          ? new Date(offer.expires_at)
          : offer.valid_until
          ? new Date(offer.valid_until)
          : new Date(new Date(offer.created_at).getTime() + 14 * 24 * 60 * 60 * 1000);

        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: offer.id,
          title: offer.title,
          restaurant_name: (offer.restaurants as any)?.name || 'Restaurang',
          expires_at: expiryDate.toISOString(),
          days_left: Math.max(0, daysLeft),
          status: offer.status,
        };
      })
      .filter(offer => offer.days_left <= 7 && offer.days_left >= 0)
      .sort((a, b) => a.days_left - b.days_left);

    return NextResponse.json({
      offers: expiringOffers,
      total: expiringOffers.length,
      critical_count: expiringOffers.filter(o => o.days_left <= 2).length,
    });
  } catch (error: any) {
    console.error('Error fetching expiring offers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
