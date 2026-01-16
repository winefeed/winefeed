import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/suppliers/onboard
 *
 * Creates a new supplier with SWEDISH_IMPORTER type and associated auth user.
 *
 * Request body:
 * {
 *   email: string;
 *   password: string;
 *   supplierName: string;
 *   contactEmail: string;
 *   phone?: string;
 *   website?: string;
 *   orgNumber?: string;
 *   licenseNumber?: string;
 *   normalDeliveryDays?: number;
 * }
 *
 * Response:
 * {
 *   supplier: Supplier;
 *   user: { id: string; email: string };
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { email, password, supplierName, contactEmail } = body;
    if (!email || !password || !supplierName || !contactEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, supplierName, contactEmail' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || !emailRegex.test(contactEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create Supabase admin client (service role)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Step 1: Create supplier record first
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        namn: supplierName,
        kontakt_email: contactEmail,
        telefon: body.phone || null,
        hemsida: body.website || null,
        normalleveranstid_dagar: body.normalDeliveryDays || 3,
        type: 'SWEDISH_IMPORTER',
        org_number: body.orgNumber || null,
        license_number: body.licenseNumber || null,
        license_verified: false,
        is_active: true,
      })
      .select()
      .single();

    if (supplierError) {
      console.error('Failed to create supplier:', supplierError);
      return NextResponse.json(
        { error: 'Failed to create supplier', details: supplierError.message },
        { status: 500 }
      );
    }

    // Step 2: Create auth user with supplier metadata
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // Auto-confirm for now (can add email verification later)
      user_metadata: {
        user_type: 'supplier',
        supplier_id: supplier.id,
        supplier_name: supplierName,
        role: 'admin',
      },
    });

    if (authError) {
      console.error('Failed to create auth user:', authError);

      // Rollback: delete supplier if auth creation failed
      await supabase.from('suppliers').delete().eq('id', supplier.id);

      return NextResponse.json(
        { error: 'Failed to create user account', details: authError.message },
        { status: 500 }
      );
    }

    // Step 3: Create supplier_users record (linking auth user to supplier)
    // This should be handled by the database trigger, but let's verify
    const { error: linkError } = await supabase
      .from('supplier_users')
      .insert({
        id: authData.user.id,
        supplier_id: supplier.id,
        role: 'admin',
        is_active: true,
      });

    if (linkError && !linkError.message.includes('duplicate')) {
      console.error('Failed to link supplier user:', linkError);
      // This is not critical since the trigger should handle it
      // but log for debugging
    }

    return NextResponse.json(
      {
        supplier: {
          id: supplier.id,
          name: supplier.namn,
          type: supplier.type,
          email: supplier.kontakt_email,
          orgNumber: supplier.org_number,
          licenseNumber: supplier.license_number,
          isActive: supplier.is_active,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        message: 'Supplier onboarded successfully',
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
