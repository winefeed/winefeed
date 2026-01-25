/**
 * SUPPLIER PROFILE API
 *
 * GET /api/supplier/profile
 *
 * Returns full supplier profile for the current user
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
      .select('id, namn, type, org_number, license_number, kontakt_email, telefon, hemsida, is_active')
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
