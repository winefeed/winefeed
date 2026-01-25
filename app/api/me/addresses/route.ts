/**
 * RESTAURANT DELIVERY ADDRESSES API
 *
 * GET /api/me/addresses - List all addresses for current user's restaurant
 * POST /api/me/addresses - Create new delivery address
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

    // Fetch addresses
    const { data: addresses, error } = await supabase
      .from('restaurant_delivery_addresses')
      .select('*')
      .eq('restaurant_id', actor.restaurant_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('label', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch addresses: ${error.message}`);
    }

    return NextResponse.json({
      addresses: addresses || [],
    });
  } catch (error: any) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Validate required fields
    const { label, address_line1, postal_code, city } = body;

    if (!label || !address_line1 || !postal_code || !city) {
      return NextResponse.json(
        { error: 'Saknar obligatoriska fält: label, address_line1, postal_code, city' },
        { status: 400 }
      );
    }

    // Create address
    const { data: address, error } = await supabase
      .from('restaurant_delivery_addresses')
      .insert({
        tenant_id: tenantId,
        restaurant_id: actor.restaurant_id,
        label: label.trim(),
        address_line1: address_line1.trim(),
        address_line2: body.address_line2?.trim() || null,
        postal_code: postal_code.trim(),
        city: city.trim(),
        country_code: body.country_code || 'SE',
        contact_name: body.contact_name?.trim() || null,
        contact_phone: body.contact_phone?.trim() || null,
        delivery_instructions: body.delivery_instructions?.trim() || null,
        is_default: body.is_default || false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create address: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      address,
    });
  } catch (error: any) {
    console.error('Error creating address:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
