/**
 * SUPPLIER PROFILE API
 *
 * GET /api/supplier/profile
 *
 * Returns full supplier profile for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // Get session from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('supplier_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    let session;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const { userId, supplierId } = session;

    if (!userId || !supplierId) {
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 401 }
      );
    }

    // Get full supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, namn, type, org_number, license_number, kontakt_email, telefon, hemsida, is_active')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get user email
    let userEmail = session.email || '';
    if (!userEmail) {
      try {
        const { data: user } = await supabase.auth.admin.getUserById(userId);
        userEmail = user?.user?.email || '';
      } catch {
        // Continue without email
      }
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
