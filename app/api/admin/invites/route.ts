/**
 * ADMIN INVITES API - PILOT ONBOARDING 1.0
 *
 * POST /api/admin/invites - Create and send user invite
 * GET /api/admin/invites - List recent invites
 *
 * Security:
 * - Admin-only (ADMIN_MODE=true or x-user-role=admin)
 * - Tenant-scoped
 * - Email sending is fail-safe
 * - Tokens stored as hash (never plaintext)
 */

import { NextRequest, NextResponse } from 'next/server';
import { inviteService } from '@/lib/invite-service';
import { sendEmail } from '@/lib/email-service';
import { userInviteEmail } from '@/lib/email-templates';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { actorService } from '@/lib/actor-service';
import { adminService } from '@/lib/admin-service';

/**
 * POST /api/admin/invites
 * Create invite and send email
 */
export async function POST(request: NextRequest) {
  try {
    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing auth context' },
        { status: 401 }
      );
    }

    // Security: Admin check
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = await adminService.isAdmin(actor);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required', hint: 'Set ADMIN_MODE=true in .env.local for dev or add user to admin_users table' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, role, restaurant_id, supplier_id } = body;

    // Validate required fields
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, role' },
        { status: 400 }
      );
    }

    if (!['RESTAURANT', 'SUPPLIER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be RESTAURANT or SUPPLIER' },
        { status: 400 }
      );
    }

    if (role === 'RESTAURANT' && !restaurant_id) {
      return NextResponse.json(
        { error: 'restaurant_id is required for RESTAURANT role' },
        { status: 400 }
      );
    }

    if (role === 'SUPPLIER' && !supplier_id) {
      return NextResponse.json(
        { error: 'supplier_id is required for SUPPLIER role' },
        { status: 400 }
      );
    }

    // Create invite
    const inviteResult = await inviteService.createInvite({
      tenant_id: tenantId,
      email,
      role,
      restaurant_id,
      supplier_id,
      created_by_user_id: userId || undefined
    });

    // Fetch entity name for email
    const supabase = getSupabaseAdmin();
    let entityName = 'Unknown';

    if (role === 'RESTAURANT') {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurant_id)
        .single();

      entityName = restaurant?.name || 'Unknown Restaurant';
    } else if (role === 'SUPPLIER') {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('namn')
        .eq('id', supplier_id)
        .single();

      entityName = supplier?.namn || 'Unknown Supplier';
    }

    // Send email (fail-safe: don't block on email errors)
    try {
      const emailContent = userInviteEmail({
        recipientEmail: email,
        role,
        entityName,
        inviteToken: inviteResult.token,
        expiresAt: inviteResult.expires_at
      });

      const emailResult = await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      if (!emailResult.success) {
        console.warn(`⚠️  Failed to send invite email: ${emailResult.error}`);
      }
    } catch (emailError: any) {
      console.error('Error sending invite email:', emailError);
      // Don't throw - invite creation succeeded
    }

    return NextResponse.json(
      {
        message: 'Invite created successfully',
        invite_id: inviteResult.invite_id,
        email,
        role,
        expires_at: inviteResult.expires_at
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error creating invite:', error);

    if (error.message?.includes('Foreign key violation')) {
      return NextResponse.json(
        { error: 'Invalid reference: restaurant or supplier not found' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/invites
 * List recent invites
 */
export async function GET(request: NextRequest) {
  try {
    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing auth context' },
        { status: 401 }
      );
    }

    // Security: Admin check
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = await adminService.isAdmin(actor);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required', hint: 'Set ADMIN_MODE=true in .env.local for dev or add user to admin_users table' },
        { status: 403 }
      );
    }

    // Get recent invites
    const invites = await inviteService.getRecentInvites(tenantId, 20);

    return NextResponse.json(
      {
        invites,
        count: invites.length
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
