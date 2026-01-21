/**
 * SUPPLIER LOGIN API
 *
 * POST /api/auth/supplier-login
 *
 * Authenticates a supplier user and sets session headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-post och lösenord krävs' },
        { status: 400 }
      );
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Felaktig e-post eller lösenord' },
        { status: 401 }
      );
    }

    // Verify user is a supplier user
    const { data: supplierUser, error: supplierError } = await supabase
      .from('supplier_users')
      .select('id, supplier_id, role')
      .eq('id', authData.user.id)
      .single();

    if (supplierError || !supplierUser) {
      return NextResponse.json(
        { error: 'Kontot är inte kopplat till någon leverantör' },
        { status: 403 }
      );
    }

    // Get supplier details
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, name, is_active')
      .eq('id', supplierUser.supplier_id)
      .single();

    if (!supplier?.is_active) {
      return NextResponse.json(
        { error: 'Leverantörskontot är inaktiverat' },
        { status: 403 }
      );
    }

    // Create response with session cookies/headers
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        supplierId: supplier.id,
        supplierName: supplier.name,
        role: supplierUser.role,
      },
    });

    // Set session cookies for MVP
    // In production, use proper session management
    response.cookies.set('supplier_session', JSON.stringify({
      userId: authData.user.id,
      supplierId: supplier.id,
      email: authData.user.email,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;

  } catch (error: any) {
    console.error('Supplier login error:', error);
    return NextResponse.json(
      { error: 'Ett fel uppstod vid inloggning' },
      { status: 500 }
    );
  }
}
