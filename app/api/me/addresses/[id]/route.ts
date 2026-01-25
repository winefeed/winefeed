/**
 * RESTAURANT DELIVERY ADDRESS API - SINGLE
 *
 * GET /api/me/addresses/[id] - Get specific address
 * PATCH /api/me/addresses/[id] - Update address
 * DELETE /api/me/addresses/[id] - Soft delete address (set is_active = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

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

    const { data: address, error } = await supabase
      .from('restaurant_delivery_addresses')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', actor.restaurant_id)
      .single();

    if (error || !address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ address });
  } catch (error: any) {
    console.error('Error fetching address:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

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

    // Verify address belongs to restaurant
    const { data: existing } = await supabase
      .from('restaurant_delivery_addresses')
      .select('id')
      .eq('id', id)
      .eq('restaurant_id', actor.restaurant_id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};

    if (body.label !== undefined) updateData.label = body.label.trim();
    if (body.address_line1 !== undefined) updateData.address_line1 = body.address_line1.trim();
    if (body.address_line2 !== undefined) updateData.address_line2 = body.address_line2?.trim() || null;
    if (body.postal_code !== undefined) updateData.postal_code = body.postal_code.trim();
    if (body.city !== undefined) updateData.city = body.city.trim();
    if (body.country_code !== undefined) updateData.country_code = body.country_code;
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name?.trim() || null;
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone?.trim() || null;
    if (body.delivery_instructions !== undefined) updateData.delivery_instructions = body.delivery_instructions?.trim() || null;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data: address, error } = await supabase
      .from('restaurant_delivery_addresses')
      .update(updateData)
      .eq('id', id)
      .eq('restaurant_id', actor.restaurant_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update address: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      address,
    });
  } catch (error: any) {
    console.error('Error updating address:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

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

    // Soft delete - set is_active = false
    const { error } = await supabase
      .from('restaurant_delivery_addresses')
      .update({ is_active: false })
      .eq('id', id)
      .eq('restaurant_id', actor.restaurant_id);

    if (error) {
      throw new Error(`Failed to delete address: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Address deleted',
    });
  } catch (error: any) {
    console.error('Error deleting address:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
