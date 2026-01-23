/**
 * UNIFIED LOGIN API
 *
 * POST /api/auth/login
 *
 * Authenticates any user and resolves their roles using ActorService.
 * Returns all roles the user has, enabling smart routing to the appropriate portal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService, ActorRole } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Default tenant for MVP
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface RoleInfo {
  role: ActorRole;
  label: string;
  path: string;
  entityId?: string;
  entityName?: string;
}

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

    // Resolve all user roles using ActorService
    const actor = await actorService.resolveActor({
      user_id: authData.user.id,
      tenant_id: DEFAULT_TENANT_ID,
      user_email: authData.user.email,
    });

    // If user has no roles, they're not authorized
    if (actor.roles.length === 0) {
      return NextResponse.json(
        { error: 'Ditt konto har ingen behörighet i systemet' },
        { status: 403 }
      );
    }

    // Build detailed role info for each role
    const roleInfos: RoleInfo[] = [];

    for (const role of actor.roles) {
      switch (role) {
        case 'ADMIN':
          roleInfos.push({
            role: 'ADMIN',
            label: 'Admin',
            path: '/admin',
          });
          break;

        case 'SELLER':
          // Get supplier name
          if (actor.supplier_id) {
            const { data: supplier } = await supabase
              .from('suppliers')
              .select('namn')
              .eq('id', actor.supplier_id)
              .single();

            roleInfos.push({
              role: 'SELLER',
              label: 'Leverantör',
              path: '/supplier',
              entityId: actor.supplier_id,
              entityName: supplier?.namn,
            });
          }
          break;

        case 'IOR':
          // Get importer name
          if (actor.importer_id) {
            const { data: importer } = await supabase
              .from('importers')
              .select('company_name')
              .eq('id', actor.importer_id)
              .single();

            roleInfos.push({
              role: 'IOR',
              label: 'Importör',
              path: '/ior/orders',
              entityId: actor.importer_id,
              entityName: importer?.company_name,
            });
          }
          break;

        case 'RESTAURANT':
          // Get restaurant name
          if (actor.restaurant_id) {
            const { data: restaurant } = await supabase
              .from('restaurants')
              .select('name')
              .eq('id', actor.restaurant_id)
              .single();

            roleInfos.push({
              role: 'RESTAURANT',
              label: 'Restaurang',
              path: '/dashboard/new-request',
              entityId: actor.restaurant_id,
              entityName: restaurant?.name,
            });
          }
          break;
      }
    }

    // Create response with session info
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      roles: roleInfos,
      // Convenience: if only one role, include direct redirect path
      redirectPath: roleInfos.length === 1 ? roleInfos[0].path : '/portal-select',
    });

    // Set Supabase auth cookies so middleware recognizes the session
    // Extract project ref from Supabase URL for cookie name
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || 'supabase';
    const cookieName = `sb-${projectRef}-auth-token`;

    if (authData.session) {
      // Set the auth token cookie in Supabase's expected format
      const cookieValue = JSON.stringify({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
        user: authData.user,
      });

      response.cookies.set(cookieName, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }

    // Set unified session cookie
    response.cookies.set('winefeed_session', JSON.stringify({
      userId: authData.user.id,
      email: authData.user.email,
      tenantId: DEFAULT_TENANT_ID,
      roles: actor.roles,
      supplierId: actor.supplier_id,
      importerId: actor.importer_id,
      restaurantId: actor.restaurant_id,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Also set the old supplier_session cookie for backward compatibility
    if (actor.supplier_id) {
      response.cookies.set('supplier_session', JSON.stringify({
        userId: authData.user.id,
        supplierId: actor.supplier_id,
        email: authData.user.email,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return response;

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ett fel uppstod vid inloggning' },
      { status: 500 }
    );
  }
}
