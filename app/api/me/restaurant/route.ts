/**
 * GET /api/me/restaurant
 *
 * Returns the current user's restaurant info.
 * Used for prefilling forms with restaurant data (e.g., delivery city).
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
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Resolve actor to get restaurant_id
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId,
    });

    if (!actor.restaurant_id) {
      return NextResponse.json(
        { error: 'User is not associated with a restaurant' },
        { status: 404 }
      );
    }

    // Fetch restaurant details
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('id, name, contact_email, contact_phone, org_number, city, address_line1, postal_code')
      .eq('id', actor.restaurant_id)
      .single();

    if (error || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: restaurant.id,
      name: restaurant.name,
      email: restaurant.contact_email,
      phone: restaurant.contact_phone,
      org_number: restaurant.org_number,
      city: restaurant.city,
      address: restaurant.address_line1,
      postal_code: restaurant.postal_code,
    });

  } catch (error: any) {
    console.error('Error fetching restaurant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
