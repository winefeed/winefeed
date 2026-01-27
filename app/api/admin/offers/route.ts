/**
 * ADMIN OFFERS API
 *
 * GET /api/admin/offers
 *
 * Returns list of all offers with details
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get all offers
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });

    if (offersError) {
      console.error('Error fetching offers:', offersError);
      return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
    }

    // Get suppliers for names
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, namn');

    // Get requests for context
    const { data: requests } = await supabase
      .from('requests')
      .select('id, fritext, restaurant_id');

    // Get restaurants for names
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name');

    // Get offer lines count
    const { data: offerLines } = await supabase
      .from('offer_lines')
      .select('id, offer_id');

    // Build offer list with details
    const offersWithDetails = offers?.map(offer => {
      const supplier = suppliers?.find(s => s.id === offer.supplier_id);
      const req = requests?.find(r => r.id === offer.request_id);
      const restaurant = req ? restaurants?.find(r => r.id === req.restaurant_id) : null;
      const lines = offerLines?.filter(l => l.offer_id === offer.id) || [];

      return {
        id: offer.id,
        status: offer.status || 'DRAFT',
        supplierId: offer.supplier_id,
        supplierName: supplier?.namn || 'Okand',
        requestId: offer.request_id,
        requestFritext: req?.fritext || null,
        restaurantName: restaurant?.name || 'Okand',
        linesCount: lines.length,
        validUntil: offer.valid_until || null,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at || offer.created_at,
      };
    }) || [];

    return NextResponse.json({
      offers: offersWithDetails,
      count: offersWithDetails.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
