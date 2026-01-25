/**
 * CURRENT SUPPLIER API
 *
 * GET /api/me/supplier
 *
 * Returns current authenticated user's supplier context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // MVP: Get user context from headers
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get supplier from supplier_users table
    const { data: supplierUser, error: supplierUserError } = await supabase
      .from('supplier_users')
      .select('supplier_id')
      .eq('id', userId)
      .single();

    if (supplierUserError || !supplierUser) {
      return NextResponse.json(
        { error: 'Not a supplier user' },
        { status: 403 }
      );
    }

    // Get supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, namn, type, org_number, is_active')
      .eq('id', supplierUser.supplier_id)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get user email
    let userEmail: string | undefined;
    try {
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      userEmail = user?.user?.email;
    } catch {
      // Continue without email
    }

    // Build roles array - check if supplier also has IOR access
    const roles: string[] = ['SELLER'];

    // Check if supplier's org_number matches an importer (gives IOR role)
    if (supplier.org_number) {
      const { data: importer } = await supabase
        .from('importers')
        .select('id')
        .eq('org_number', supplier.org_number)
        .eq('tenant_id', tenantId)
        .single();

      if (importer) {
        roles.push('IOR');
      }
    }

    return NextResponse.json({
      supplierId: supplier.id,
      supplierName: supplier.namn,
      supplierType: supplier.type,
      orgNumber: supplier.org_number,
      isActive: supplier.is_active,
      userEmail,
      roles,
    });

  } catch (error: any) {
    console.error('Error fetching supplier context:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
