/**
 * ADMIN SPONSORED CATEGORIES API
 *
 * GET /api/admin/sponsored-categories - List all categories with sponsors
 * POST /api/admin/sponsored-categories - Create new category
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

    // Get all categories
    const { data: categories, error: catError } = await supabase
      .from('sponsored_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (catError) {
      throw new Error(`Failed to fetch categories: ${catError.message}`);
    }

    // Get slot counts and sponsors for each category
    const enrichedCategories = await Promise.all(
      (categories || []).map(async (cat) => {
        // Get active slots with supplier info
        const { data: slots } = await supabase
          .from('sponsored_slots')
          .select(`
            id,
            supplier_id,
            slot_type,
            status,
            starts_at,
            suppliers (
              id,
              namn,
              kontakt_email
            )
          `)
          .eq('category_id', cat.id)
          .eq('status', 'ACTIVE');

        const activeSlots = slots || [];

        return {
          ...cat,
          active_slot_count: activeSlots.length,
          available_slots: cat.sponsor_cap - activeSlots.length,
          is_full: activeSlots.length >= cat.sponsor_cap,
          sponsors: activeSlots.map((slot: any) => ({
            slot_id: slot.id,
            supplier_id: slot.supplier_id,
            supplier_name: slot.suppliers?.namn || 'Okänd',
            supplier_email: slot.suppliers?.kontakt_email,
            slot_type: slot.slot_type,
            starts_at: slot.starts_at
          }))
        };
      })
    );

    return NextResponse.json({
      categories: enrichedCategories,
      count: enrichedCategories.length
    });

  } catch (error: any) {
    console.error('Error listing sponsored categories:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
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

    const body = await request.json();
    const {
      name,
      slug,
      description,
      sponsor_cap = 3,
      price_monthly_sek = 0,
      price_yearly_sek = 0,
      stripe_price_id_monthly,
      stripe_price_id_yearly,
      is_active = true
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'slug must be lowercase letters, numbers, and hyphens only' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('sponsored_categories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 409 }
      );
    }

    // Create category
    const { data: category, error: createError } = await supabase
      .from('sponsored_categories')
      .insert({
        tenant_id: tenantId,
        name,
        slug,
        description: description || null,
        sponsor_cap,
        price_monthly_sek,
        price_yearly_sek,
        stripe_price_id_monthly: stripe_price_id_monthly || null,
        stripe_price_id_yearly: stripe_price_id_yearly || null,
        is_active
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create category: ${createError.message}`);
    }

    return NextResponse.json({
      category,
      message: 'Category created successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating sponsored category:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
