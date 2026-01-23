/**
 * LOGOUT API
 *
 * POST /api/auth/logout
 *
 * Clears all session cookies and signs out from Supabase
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST() {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });

    // Clear all session cookies
    response.cookies.delete('winefeed_session');
    response.cookies.delete('supplier_session');

    return response;

  } catch (error: any) {
    console.error('Logout error:', error);
    // Even if there's an error, try to clear cookies
    const response = NextResponse.json({ success: true });
    response.cookies.delete('winefeed_session');
    response.cookies.delete('supplier_session');
    return response;
  }
}
