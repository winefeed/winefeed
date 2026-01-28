/**
 * SUPPLIER PROFILE API
 *
 * GET /api/supplier/profile - Returns full supplier profile
 * PATCH /api/supplier/profile - Update supplier settings (min_order_bottles)
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
    // Use header-based authentication
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER to view supplier profile
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // SELLER can only view their own supplier profile
    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier associated with this user' },
        { status: 404 }
      );
    }

    // Get full supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, namn, type, org_number, license_number, kontakt_email, telefon, hemsida, is_active, min_order_bottles, provorder_enabled, provorder_fee_sek')
      .eq('id', actor.supplier_id)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get user email
    let userEmail = '';
    try {
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      userEmail = user?.user?.email || '';
    } catch {
      // Continue without email
    }

    return NextResponse.json({
      supplierId: supplier.id,
      supplierName: supplier.namn,
      supplierType: supplier.type,
      orgNumber: supplier.org_number,
      licenseNumber: supplier.license_number,
      kontaktEmail: supplier.kontakt_email,
      telefon: supplier.telefon,
      hemsida: supplier.hemsida,
      isActive: supplier.is_active,
      minOrderBottles: supplier.min_order_bottles,
      provorderEnabled: supplier.provorder_enabled || false,
      provorderFeeSek: supplier.provorder_fee_sek || 500,
      userEmail,
    });

  } catch (error: any) {
    console.error('Error fetching supplier profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/supplier/profile
 * Update supplier settings (min_order_bottles)
 */
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

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER or ADMIN
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier associated with this user' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build updates object with validated fields
    const updates: Record<string, any> = {};

    // Min order bottles
    if ('minOrderBottles' in body) {
      const value = body.minOrderBottles;
      if (value !== null && (typeof value !== 'number' || value < 0 || !Number.isInteger(value))) {
        return NextResponse.json(
          { error: 'minOrderBottles must be a positive integer or null' },
          { status: 400 }
        );
      }
      updates.min_order_bottles = value;
    }

    // Contact email
    if ('kontaktEmail' in body) {
      const value = body.kontaktEmail;
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json(
          { error: 'kontaktEmail must be a string or null' },
          { status: 400 }
        );
      }
      // Basic email validation
      if (value && !value.includes('@')) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
      updates.kontakt_email = value || null;
    }

    // Phone
    if ('telefon' in body) {
      const value = body.telefon;
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json(
          { error: 'telefon must be a string or null' },
          { status: 400 }
        );
      }
      updates.telefon = value || null;
    }

    // Website
    if ('hemsida' in body) {
      const value = body.hemsida;
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json(
          { error: 'hemsida must be a string or null' },
          { status: 400 }
        );
      }
      updates.hemsida = value || null;
    }

    // Provorder enabled
    if ('provorderEnabled' in body) {
      const value = body.provorderEnabled;
      if (typeof value !== 'boolean') {
        return NextResponse.json(
          { error: 'provorderEnabled must be a boolean' },
          { status: 400 }
        );
      }
      updates.provorder_enabled = value;
    }

    // Provorder fee
    if ('provorderFeeSek' in body) {
      const value = body.provorderFeeSek;
      if (value !== null && (typeof value !== 'number' || value < 0 || !Number.isInteger(value))) {
        return NextResponse.json(
          { error: 'provorderFeeSek must be a positive integer or null' },
          { status: 400 }
        );
      }
      updates.provorder_fee_sek = value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update supplier
    const { data: supplier, error: updateError } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', actor.supplier_id)
      .select('id, min_order_bottles, kontakt_email, telefon, hemsida, provorder_enabled, provorder_fee_sek')
      .single();

    if (updateError) {
      console.error('Error updating supplier:', updateError);
      return NextResponse.json(
        { error: 'Failed to update supplier' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      minOrderBottles: supplier.min_order_bottles,
      kontaktEmail: supplier.kontakt_email,
      telefon: supplier.telefon,
      hemsida: supplier.hemsida,
      provorderEnabled: supplier.provorder_enabled || false,
      provorderFeeSek: supplier.provorder_fee_sek || 500,
    });

  } catch (error: any) {
    console.error('Error updating supplier profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
