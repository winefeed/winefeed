/**
 * GET /api/me/restaurant - Returns the current user's restaurant info.
 * PATCH /api/me/restaurant - Update restaurant info (e.g., org_number).
 *
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

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();

    // Build update object with only allowed fields
    const updates: Record<string, string | null> = {};

    // Validate and add org_number if provided
    if (body.org_number !== undefined) {
      if (body.org_number) {
        const orgPattern = /^\d{6}-\d{4}$/;
        if (!orgPattern.test(body.org_number)) {
          return NextResponse.json(
            { error: 'Ogiltigt organisationsnummer. Förväntat format: XXXXXX-XXXX' },
            { status: 400 }
          );
        }
        updates.org_number = body.org_number;
      } else {
        updates.org_number = null;
      }
    }

    // Add other allowed fields
    if (body.city !== undefined) updates.city = body.city || null;
    if (body.address_line1 !== undefined) updates.address_line1 = body.address_line1 || null;
    if (body.postal_code !== undefined) updates.postal_code = body.postal_code || null;
    if (body.contact_email !== undefined) updates.contact_email = body.contact_email || null;
    if (body.contact_phone !== undefined) updates.contact_phone = body.contact_phone || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update restaurant
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', actor.restaurant_id)
      .select('id, name, org_number, city')
      .single();

    if (error) {
      console.error('Error updating restaurant:', error);
      return NextResponse.json(
        { error: 'Failed to update restaurant' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Restaurant updated',
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        org_number: restaurant.org_number,
        city: restaurant.city,
      }
    });

  } catch (error: any) {
    console.error('Error updating restaurant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
