/**
 * CURRENT ACTOR API
 *
 * GET /api/me/actor
 *
 * Returns current authenticated user's actor context (roles + entity IDs)
 *
 * Resolution:
 * - RESTAURANT role: From restaurant_users table
 * - SELLER role: From supplier_users table
 * - IOR role: Dual-role via org_number matching (suppliers ↔ importers)
 * - ADMIN role: From ADMIN_MODE env var (MVP) or admin_users table (production)
 *
 * Response:
 * {
 *   "tenant_id": "uuid",
 *   "user_id": "uuid",
 *   "roles": ["RESTAURANT", "SELLER", "IOR"],
 *   "restaurant_id": "uuid",  // if RESTAURANT role
 *   "supplier_id": "uuid",    // if SELLER role
 *   "importer_id": "uuid",    // if IOR role
 *   "user_email": "user@example.com"
 * }
 *
 * Security:
 * - Tenant isolation
 * - Only returns data for authenticated user
 * - No sensitive data (passwords, tokens)
 *
 * MVP: Uses x-user-id and x-tenant-id headers for auth
 * Production: Replace with Supabase Auth session or JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // MVP: Get user context from headers
    // Production: Get from Supabase Auth session or JWT
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user authentication' },
        { status: 401 }
      );
    }

    // Optional: Get user email from auth.users table
    let userEmail: string | undefined;
    try {
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      userEmail = user?.user?.email;
    } catch (error) {
      // Email not critical - continue without it
      console.warn('Could not fetch user email:', error);
    }

    // Resolve actor context
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId,
      user_email: userEmail
    });

    // Return actor context
    return NextResponse.json(actor, { status: 200 });
  } catch (error: any) {
    console.error('Error resolving actor context:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
