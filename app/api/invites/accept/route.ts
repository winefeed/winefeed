/**
 * INVITE ACCEPTANCE API
 *
 * POST /api/invites/accept
 *
 * Accepts invite: Creates auth user, links to entity, marks invite as used
 *
 * Flow:
 * 1. Verify token is valid
 * 2. Create Supabase auth user (or link existing)
 * 3. Link user to restaurant_users or supplier_users
 * 4. Mark invite as used
 * 5. Return user info for login
 *
 * Security:
 * - No auth required (token is the auth)
 * - Token can only be used once
 * - Creates email-confirmed user (no verification needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { inviteService } from '@/lib/invite-service';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { token, password, name } = body;

    // Validate required fields
    if (!token) {
      return NextResponse.json(
        { error: 'Missing required field: token' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Missing required field: password' },
        { status: 400 }
      );
    }

    // Validate password strength (basic)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Accept invite (creates user + links to entity)
    const result = await inviteService.acceptInvite({
      token,
      password,
      name: name || undefined
    });

    return NextResponse.json(
      {
        message: 'Invite accepted successfully',
        user_id: result.user_id,
        email: result.email,
        role: result.role
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error accepting invite:', error);

    // Handle specific error cases
    if (error.message?.includes('Invalid invite')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error.message?.includes('already been used')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    if (error.message?.includes('expired')) {
      return NextResponse.json(
        { error: error.message },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
