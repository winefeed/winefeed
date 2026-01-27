/**
 * ADMIN REQUESTS API
 *
 * GET /api/admin/requests
 *
 * Returns list of all requests with details
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

    // Get all requests
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    // Get restaurants for names
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name');

    // Get offers count per request
    const { data: offers } = await supabase
      .from('offers')
      .select('id, request_id, status');

    // Build request list with details
    const requestsWithDetails = requests?.map(req => {
      const restaurant = restaurants?.find(r => r.id === req.restaurant_id);
      const requestOffers = offers?.filter(o => o.request_id === req.id) || [];

      return {
        id: req.id,
        status: req.status || 'OPEN',
        fritext: req.fritext || null,
        restaurantId: req.restaurant_id,
        restaurantName: restaurant?.name || 'Okand',
        offersCount: requestOffers.length,
        acceptedOffers: requestOffers.filter(o => o.status === 'ACCEPTED').length,
        createdAt: req.created_at,
        updatedAt: req.updated_at || req.created_at,
      };
    }) || [];

    return NextResponse.json({
      requests: requestsWithDetails,
      count: requestsWithDetails.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
