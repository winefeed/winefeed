/**
 * ADMIN RESTAURANTS API
 *
 * GET /api/admin/restaurants
 *
 * Returns list of all restaurants with stats
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

    // Get all restaurants
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, org_number, address, city, postal_code, country, created_at')
      .order('name', { ascending: true });

    if (restaurantsError) {
      console.error('Error fetching restaurants:', restaurantsError);
      return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
    }

    // Get user counts per restaurant
    const { data: restaurantUsers, error: usersError } = await supabase
      .from('restaurant_users')
      .select('restaurant_id, user_id');

    // Get request counts per restaurant
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('restaurant_id, status');

    // Get order counts per restaurant
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('restaurant_id, status');

    // Build restaurant list with stats
    const restaurantsWithStats = restaurants?.map(restaurant => {
      const users = restaurantUsers?.filter(u => u.restaurant_id === restaurant.id) || [];
      const restaurantRequests = requests?.filter(r => r.restaurant_id === restaurant.id) || [];
      const restaurantOrders = orders?.filter(o => o.restaurant_id === restaurant.id) || [];

      return {
        id: restaurant.id,
        name: restaurant.name,
        orgNumber: restaurant.org_number,
        address: restaurant.address,
        city: restaurant.city,
        postalCode: restaurant.postal_code,
        country: restaurant.country,
        createdAt: restaurant.created_at,
        stats: {
          userCount: users.length,
          totalRequests: restaurantRequests.length,
          openRequests: restaurantRequests.filter(r => r.status === 'OPEN').length,
          totalOrders: restaurantOrders.length,
          pendingOrders: restaurantOrders.filter(o =>
            o.status === 'PENDING_SUPPLIER_CONFIRMATION' || o.status === 'CONFIRMED'
          ).length,
          deliveredOrders: restaurantOrders.filter(o => o.status === 'DELIVERED').length,
        }
      };
    }) || [];

    return NextResponse.json({
      restaurants: restaurantsWithStats,
      count: restaurantsWithStats.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching restaurants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
