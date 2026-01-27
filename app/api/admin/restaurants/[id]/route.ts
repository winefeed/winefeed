/**
 * ADMIN RESTAURANT DETAIL API
 *
 * GET /api/admin/restaurants/[id]
 *
 * Returns detailed info about a specific restaurant
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: restaurantId } = params;
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

    // Get restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError) {
      if (restaurantError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
      }
      console.error('Error fetching restaurant:', restaurantError);
      return NextResponse.json({ error: 'Failed to fetch restaurant' }, { status: 500 });
    }

    // Get users for this restaurant
    const { data: users } = await supabase
      .from('restaurant_users')
      .select('id, user_id, role, created_at')
      .eq('restaurant_id', restaurantId);

    // Get user details
    const userIds = users?.map(u => u.user_id) || [];
    const { data: userProfiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const usersWithDetails = users?.map(u => {
      const profile = userProfiles?.find(p => p.id === u.user_id);
      return {
        id: u.id,
        userId: u.user_id,
        email: profile?.email || 'Okand',
        name: profile?.name || null,
        role: u.role,
        createdAt: u.created_at,
      };
    }) || [];

    // Get requests for this restaurant
    const { data: requests } = await supabase
      .from('requests')
      .select('id, status, fritext, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get orders for this restaurant
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        orgNumber: restaurant.org_number || null,
        address: restaurant.address || null,
        city: restaurant.city || null,
        postalCode: restaurant.postal_code || null,
        country: restaurant.country || null,
        email: restaurant.email || null,
        phone: restaurant.phone || null,
        createdAt: restaurant.created_at,
      },
      users: usersWithDetails,
      recentRequests: requests?.map(r => ({
        id: r.id,
        status: r.status || 'OPEN',
        fritext: r.fritext || null,
        createdAt: r.created_at,
      })) || [],
      recentOrders: orders?.map(o => ({
        id: o.id,
        status: o.status,
        createdAt: o.created_at,
      })) || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching restaurant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
