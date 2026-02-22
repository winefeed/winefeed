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
import { checkRateLimit, getRateLimitType, getRateLimitHeaders } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // SECURITY: Strip any client-supplied auth context headers to prevent spoofing.
  // These headers are set exclusively by this middleware after session validation.
  request.headers.delete('x-user-id');
  request.headers.delete('x-tenant-id');

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
    '/llms.txt',         // AI-discoverable metadata (llmstxt.org)
    '/api/health',       // Health check (monitoring + smoke tests)
    '/api/admin/access', // Vinkoll Access API (has own cookie auth)
    '/admin/access',     // Vinkoll Access pages (own auth, separate from Winefeed)
    '/access/admin',     // Vinkoll Access admin (separate from Winefeed)
    '/access/importer/respond',       // Importer respond page (token-based auth)
    '/access/importer/confirm',       // Importer confirm page (token-based auth)
    '/api/access/importer/respond',   // Importer respond API (token-based auth)
    '/api/access/importer/confirm',   // Importer confirm API (token-based auth)
    '/api/cron',                      // Vercel Cron jobs (own CRON_SECRET auth)
    '/catalog',                       // Public supplier catalog (token-based)
    '/api/catalog',                   // Public catalog API (token-based)
    '/restauranger',                  // Public landing page for restaurants
    '/leverantorer',                  // Public landing page for suppliers
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

  // Static assets - skip auth and rate limiting
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    // Get client IP (Vercel provides this header)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ??
               request.headers.get('x-real-ip') ??
               '127.0.0.1';

    const rateLimitType = getRateLimitType(pathname);
    const rateLimitResult = await checkRateLimit(ip, rateLimitType);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitResult.reset
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }
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

    // Content-Signal headers for Vinkoll Access pages (AI agent content negotiation)
    if (pathname.startsWith('/admin/access')) {
      response.headers.set('Content-Signal', 'training=disallow, search=allow, agent=allow');
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
