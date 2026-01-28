/**
 * MIDDLEWARE - ROUTE PROTECTION
 *
 * Global authentication guard for Winefeed
 * Requires login for all routes except public ones
 *
 * Public routes:
 * - /login (auth page)
 * - /invite (invite acceptance flow)
 * - /api/invites/* (invite API endpoints)
 * - Static assets (_next/*, favicon.ico, etc.)
 *
 * Protected routes:
 * - All other pages require authenticated user
 * - Admin routes require admin role/flag
 *
 * API routes:
 * - Return 401 JSON if not authenticated (no redirect)
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - no auth required
  const publicPaths = [
    '/login',
    '/invite',
    '/api/invites/verify',
    '/api/invites/accept',
    '/signup',           // Public restaurant registration
    '/api/org-lookup',   // Org number lookup (public)
    '/api/restaurants/onboard',  // Restaurant registration (public)
    '/api/suppliers/onboard',    // Supplier registration (public)
    '/supplier/login',
    '/supplier/forgot-password',
    '/supplier/reset-password',
    '/api/auth/forgot-password',
    '/api/auth/login',   // Unified login API
    '/api/auth/logout',  // Logout API
    '/portal-select',    // Portal selector for multi-role users
    '/forgot-password',  // Forgot password page
    '/pitch',            // Public pitch page
    '/api/health',       // Health check (monitoring + smoke tests)
  ];

  // Exact match for root landing page
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Development/Test: Allow header-based auth for smoke tests
  // SECURITY: Requires BOTH non-production AND explicit env flag
  const allowTestBypass =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_TEST_BYPASS === 'true';

  if (allowTestBypass && pathname.startsWith('/api/')) {
    const testUserId = request.headers.get('x-user-id');
    const testTenantId = request.headers.get('x-tenant-id');
    if (testUserId && testTenantId) {
      // Pass through with headers intact for testing
      return NextResponse.next({
        request: { headers: request.headers },
      });
    }
  }

  // Static assets - skip auth
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Check if path is public
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Create Supabase client with middleware cookie handling
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public route - allow access
  if (isPublicPath) {
    // If user is already logged in and trying to access /login, redirect to dashboard
    // The dashboard page will handle role-based routing
    if (pathname === '/login' && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // Protected route - require authentication
  if (!user) {
    // API routes - return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Page routes - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

// User is authenticated - set headers and allow access
  // Note: restaurants table doesn't have tenant_id column (MVP single-tenant)
  const tenantId = '00000000-0000-0000-0000-000000000001';
  // Clone request headers and add user context
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-tenant-id', tenantId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
