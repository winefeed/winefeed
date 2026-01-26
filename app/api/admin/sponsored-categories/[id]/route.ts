/**
 * ADMIN SPONSORED CATEGORY DETAIL API
 *
 * GET /api/admin/sponsored-categories/[id] - Get category details
 * PATCH /api/admin/sponsored-categories/[id] - Update category
 * DELETE /api/admin/sponsored-categories/[id] - Delete category
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

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // Verify admin access
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get category
    const { data: category, error } = await supabase
      .from('sponsored_categories')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get sponsors
    const { data: slots } = await supabase
      .from('sponsored_slots')
      .select(`
        id,
        supplier_id,
        slot_type,
        status,
        starts_at,
        stripe_subscription_id,
        suppliers (
          id,
          namn,
          kontakt_email
        )
      `)
      .eq('category_id', id)
      .eq('status', 'ACTIVE');

    return NextResponse.json({
      category: {
        ...category,
        active_slot_count: (slots || []).length,
        sponsors: (slots || []).map((slot: any) => ({
          slot_id: slot.id,
          supplier_id: slot.supplier_id,
          supplier_name: slot.suppliers?.namn || 'Okänd',
          supplier_email: slot.suppliers?.kontakt_email,
          slot_type: slot.slot_type,
          starts_at: slot.starts_at,
          has_stripe_subscription: !!slot.stripe_subscription_id
        }))
      }
    });

  } catch (error: any) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // Verify admin access
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Verify category exists
    const { data: existing, error: fetchError } = await supabase
      .from('sponsored_categories')
      .select('id, sponsor_cap')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      'name',
      'slug',
      'description',
      'sponsor_cap',
      'price_monthly_sek',
      'price_yearly_sek',
      'stripe_price_id_monthly',
      'stripe_price_id_yearly',
      'is_active'
    ];

    // Filter to allowed fields
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Validate slug if being updated
    if (updates.slug && !/^[a-z0-9-]+$/.test(updates.slug)) {
      return NextResponse.json(
        { error: 'slug must be lowercase letters, numbers, and hyphens only' },
        { status: 400 }
      );
    }

    // Check slug uniqueness if being updated
    if (updates.slug) {
      const { data: slugExists } = await supabase
        .from('sponsored_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', updates.slug)
        .neq('id', id)
        .single();

      if (slugExists) {
        return NextResponse.json(
          { error: 'A category with this slug already exists' },
          { status: 409 }
        );
      }
    }

    // If reducing sponsor_cap, check current usage
    if (updates.sponsor_cap !== undefined) {
      const { count } = await supabase
        .from('sponsored_slots')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id)
        .eq('status', 'ACTIVE');

      if (count && updates.sponsor_cap < count) {
        return NextResponse.json(
          { error: `Cannot reduce cap below current usage (${count} active slots)` },
          { status: 400 }
        );
      }
    }

    // Update category
    const { data: category, error: updateError } = await supabase
      .from('sponsored_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update category: ${updateError.message}`);
    }

    return NextResponse.json({
      category,
      message: 'Category updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // Verify admin access
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Check for active slots
    const { count } = await supabase
      .from('sponsored_slots')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)
      .eq('status', 'ACTIVE');

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${count} active slot(s). Deactivate instead.` },
        { status: 400 }
      );
    }

    // Delete category
    const { error: deleteError } = await supabase
      .from('sponsored_categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      throw new Error(`Failed to delete category: ${deleteError.message}`);
    }

    return NextResponse.json({
      message: 'Category deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
