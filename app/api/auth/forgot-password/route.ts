/**
 * FORGOT PASSWORD API
 *
 * POST /api/auth/forgot-password
 *
 * Sends a password reset email via Supabase Auth
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
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'E-postadress krävs' },
        { status: 400 }
      );
    }

    // Get the base URL for the redirect - must be in Supabase allowed redirect URLs
    const redirectTo = 'https://winefeed.se/supplier/reset-password';

    console.log('Password reset redirectTo:', redirectTo);

    // Send password reset email via Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not for security
      // Always return success to prevent email enumeration
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message: 'Om e-postadressen finns i systemet skickas en återställningslänk'
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Ett fel uppstod. Försök igen.' },
      { status: 500 }
    );
  }
}
