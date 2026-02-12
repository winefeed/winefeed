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

    // Fetch restaurant details including billing fields
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select(`
        id, name, contact_email, contact_phone, org_number, city, address_line1, postal_code,
        billing_email, billing_contact_person, billing_contact_phone,
        billing_address, billing_postal_code, billing_city, billing_reference,
        cuisine_type, price_segment, wine_preference_notes
      `)
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
      // Billing fields
      billing_email: restaurant.billing_email,
      billing_contact_person: restaurant.billing_contact_person,
      billing_contact_phone: restaurant.billing_contact_phone,
      billing_address: restaurant.billing_address,
      billing_postal_code: restaurant.billing_postal_code,
      billing_city: restaurant.billing_city,
      billing_reference: restaurant.billing_reference,
      // Wine profile fields
      cuisine_type: restaurant.cuisine_type,
      price_segment: restaurant.price_segment,
      wine_preference_notes: restaurant.wine_preference_notes,
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

    // Add other allowed fields (map API names to DB column names)
    if (body.name !== undefined) updates.name = body.name || null;
    if (body.city !== undefined) updates.city = body.city || null;
    if (body.address !== undefined) updates.address_line1 = body.address || null;
    if (body.address_line1 !== undefined) updates.address_line1 = body.address_line1 || null;
    if (body.postal_code !== undefined) updates.postal_code = body.postal_code || null;
    if (body.email !== undefined) updates.contact_email = body.email || null;
    if (body.contact_email !== undefined) updates.contact_email = body.contact_email || null;
    if (body.phone !== undefined) updates.contact_phone = body.phone || null;
    if (body.contact_phone !== undefined) updates.contact_phone = body.contact_phone || null;
    // Billing fields
    if (body.billing_email !== undefined) updates.billing_email = body.billing_email || null;
    if (body.billing_contact_person !== undefined) updates.billing_contact_person = body.billing_contact_person || null;
    if (body.billing_contact_phone !== undefined) updates.billing_contact_phone = body.billing_contact_phone || null;
    if (body.billing_address !== undefined) updates.billing_address = body.billing_address || null;
    if (body.billing_postal_code !== undefined) updates.billing_postal_code = body.billing_postal_code || null;
    if (body.billing_city !== undefined) updates.billing_city = body.billing_city || null;
    if (body.billing_reference !== undefined) updates.billing_reference = body.billing_reference || null;

    // Wine profile fields
    if (body.cuisine_type !== undefined) (updates as any).cuisine_type = Array.isArray(body.cuisine_type) ? body.cuisine_type : null;
    if (body.price_segment !== undefined) {
      const valid = [null, 'casual', 'mid-range', 'fine-dining'];
      (updates as any).price_segment = valid.includes(body.price_segment) ? body.price_segment : null;
    }
    if (body.wine_preference_notes !== undefined) updates.wine_preference_notes = body.wine_preference_notes || null;

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
      .select(`
        id, name, contact_email, contact_phone, org_number, city, address_line1, postal_code,
        billing_email, billing_contact_person, billing_contact_phone,
        billing_address, billing_postal_code, billing_city, billing_reference,
        cuisine_type, price_segment, wine_preference_notes
      `)
      .single();

    if (error) {
      console.error('Error updating restaurant:', error);
      return NextResponse.json(
        { error: 'Failed to update restaurant' },
        { status: 500 }
      );
    }

    // Return full restaurant data (mapped to API names)
    return NextResponse.json({
      id: restaurant.id,
      name: restaurant.name,
      email: restaurant.contact_email,
      phone: restaurant.contact_phone,
      org_number: restaurant.org_number,
      city: restaurant.city,
      address: restaurant.address_line1,
      postal_code: restaurant.postal_code,
      billing_email: restaurant.billing_email,
      billing_contact_person: restaurant.billing_contact_person,
      billing_contact_phone: restaurant.billing_contact_phone,
      billing_address: restaurant.billing_address,
      billing_postal_code: restaurant.billing_postal_code,
      billing_city: restaurant.billing_city,
      billing_reference: restaurant.billing_reference,
      cuisine_type: restaurant.cuisine_type,
      price_segment: restaurant.price_segment,
      wine_preference_notes: restaurant.wine_preference_notes,
    });

  } catch (error: any) {
    console.error('Error updating restaurant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
