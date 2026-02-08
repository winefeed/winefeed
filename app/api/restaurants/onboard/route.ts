/**
 * RESTAURANT ONBOARDING API
 *
 * POST /api/restaurants/onboard
 *
 * Creates a new restaurant account with user.
 * Uses database trigger to auto-create restaurant + restaurant_users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, WINEFEED_FROM } from '@/lib/email-service';
import { welcomeEmail } from '@/lib/email-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface OnboardRequest {
  email: string;
  password: string;
  org_number: string;
  name: string;
  city: string;
  address_line1?: string;
  postal_code?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: OnboardRequest = await request.json();

    // Validate required fields
    const { email, password, org_number, name, city } = body;

    if (!email || !password || !name || !city) {
      return NextResponse.json(
        { error: 'Saknar obligatoriska fält: email, password, name, city' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: 'Ogiltig e-postadress' },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Lösenordet måste vara minst 8 tecken' },
        { status: 400 }
      );
    }

    // Validate org number if provided
    if (org_number) {
      const orgPattern = /^\d{6}-\d{4}$/;
      if (!orgPattern.test(org_number)) {
        return NextResponse.json(
          { error: 'Ogiltigt organisationsnummer. Förväntat format: XXXXXX-XXXX' },
          { status: 400 }
        );
      }
    }

    // Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
      return NextResponse.json(
        { error: 'E-postadressen är redan registrerad' },
        { status: 409 }
      );
    }

    // Create auth user with metadata
    // The database trigger will auto-create restaurants + restaurant_users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for signup flow
      user_metadata: {
        user_type: 'restaurant',
        name: name,
        tenant_id: TENANT_ID,
        role: 'admin', // Restaurant admin
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Kunde inte skapa konto: ' + authError.message },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // Update restaurant with additional fields
    // (trigger creates basic record, we add org_number, city, address)
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        org_number: org_number || null,
        city: city,
        address_line1: body.address_line1 || null,
        postal_code: body.postal_code || null,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Restaurant update error:', updateError);
      // Don't fail - the basic record was created
    }

    // Send welcome email (fail-safe: doesn't block signup)
    try {
      const emailContent = welcomeEmail({
        restaurantName: name,
        email: email,
        city: city
      });

      const emailResult = await sendEmail({
        to: email,
        from: WINEFEED_FROM,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      if (!emailResult.success) {
        console.warn(`⚠️  Failed to send welcome email: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail - email is not critical for signup
    }

    // Sign in the user to create a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Sign-in error:', signInError);
      // Account created but couldn't sign in - redirect to login
      return NextResponse.json({
        success: true,
        user_id: userId,
        message: 'Konto skapat! Logga in för att fortsätta.',
        redirect_path: '/login',
      });
    }

    // Create response with session cookies
    const response = NextResponse.json({
      success: true,
      user_id: userId,
      restaurant_id: userId, // Same as user_id in this model
      message: 'Välkommen till Winefeed!',
      redirect_path: '/dashboard/new-request',
    });

    // Set auth cookie
    if (signInData.session) {
      response.cookies.set('sb-access-token', signInData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;

  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Ett fel uppstod vid registrering' },
      { status: 500 }
    );
  }
}
