/**
 * Auth Scanner
 *
 * Reads all app/api/** /route.ts files and checks that each HTTP handler
 * has appropriate authentication checks based on route type.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SecurityFinding,
  ScannerResult,
  RouteType,
  RouteInfo,
} from '../types';

// Auth patterns to look for in route handlers
const AUTH_PATTERNS = [
  /request\.headers\.get\(['"]x-user-id['"]\)/,
  /request\.headers\.get\(['"]x-tenant-id['"]\)/,
  /actorService\.resolveActor/,
  /requireVinkollAdmin/,
  /requireIORContext/,
  /verifyAuthToken/,
  /supabase\.auth\.getUser/,
  /validateInboundSecret/,
];

// Admin-specific patterns
const ADMIN_AUTH_PATTERNS = [
  /actorService\.hasRole\(.*['"]ADMIN['"]\)/,
  /requireVinkollAdmin/,
];

// IOR-specific patterns
const IOR_AUTH_PATTERNS = [
  /requireIORContext/,
  /actorService\.hasRole\(.*['"]IOR['"]\)/,
];

// Token-based auth patterns (for importer routes)
const TOKEN_AUTH_PATTERNS = [
  /verifyAuthToken/,
  /verifyAuthTokenPeek/,
];

// HTTP method exports
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Public paths from middleware — routes that skip middleware auth.
 */
const PUBLIC_PATHS = [
  '/login',
  '/invite',
  '/api/invites/verify',
  '/api/invites/accept',
  '/signup',
  '/api/org-lookup',
  '/api/restaurants/onboard',
  '/api/suppliers/onboard',
  '/supplier/login',
  '/supplier/forgot-password',
  '/supplier/reset-password',
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/portal-select',
  '/forgot-password',
  '/pitch',
  '/api/health',
  '/api/admin/access',
  '/access/admin',
  '/access/importer/respond',
  '/access/importer/confirm',
  '/api/access/importer/respond',
  '/api/access/importer/confirm',
];

/**
 * Classify a route path into a type.
 */
export function classifyRoute(routePath: string): RouteType {
  if (routePath.startsWith('/api/admin/access/') || routePath.startsWith('/api/admin/access')) {
    return 'access_admin';
  }
  if (routePath.startsWith('/api/admin/')) {
    return 'admin';
  }
  if (routePath.startsWith('/api/ior/')) {
    return 'ior';
  }
  if (routePath.startsWith('/api/access/importer/')) {
    return 'access_importer';
  }
  if (routePath.includes('/webhook') || routePath.includes('/inbound')) {
    return 'webhook';
  }
  return 'general';
}

/**
 * Convert file path to API route path.
 * e.g. app/api/admin/stats/route.ts → /api/admin/stats
 */
export function fileToRoutePath(filePath: string): string {
  // Normalize separators and find app/api
  const normalized = filePath.replace(/\\/g, '/');
  const appIndex = normalized.indexOf('app/');
  if (appIndex === -1) return filePath;

  let route = normalized.slice(appIndex + 3); // skip "app"
  route = route.replace(/\/route\.ts$/, '');
  // Replace [param] with :param for readability
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  return route;
}

/**
 * Check if a route is public (skips middleware auth).
 */
export function isPublicRoute(routePath: string): boolean {
  return PUBLIC_PATHS.some(p => routePath.startsWith(p));
}

/**
 * Detect which HTTP methods are exported in a route file.
 */
export function detectHttpMethods(content: string): string[] {
  return HTTP_METHODS.filter(method => {
    const regex = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    return regex.test(content);
  });
}

/**
 * Check if content has ANY auth pattern.
 */
export function hasAnyAuth(content: string): boolean {
  return AUTH_PATTERNS.some(p => p.test(content));
}

/**
 * Check if content has admin-specific auth.
 */
export function hasAdminAuth(content: string): boolean {
  return ADMIN_AUTH_PATTERNS.some(p => p.test(content));
}

/**
 * Check if content has IOR-specific auth.
 */
export function hasIORAuth(content: string): boolean {
  return IOR_AUTH_PATTERNS.some(p => p.test(content));
}

/**
 * Check if content has token-based auth.
 */
export function hasTokenAuth(content: string): boolean {
  return TOKEN_AUTH_PATTERNS.some(p => p.test(content));
}

/**
 * Analyze a single route file content and return findings.
 */
export function analyzeRouteContent(
  content: string,
  filePath: string,
  routePath: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const routeType = classifyRoute(routePath);
  const isPublic = isPublicRoute(routePath);
  const methods = detectHttpMethods(content);

  if (methods.length === 0) return findings;

  // Public routes with their own auth (e.g. token-based) are OK
  // but routes that are public AND have no auth at all are concerning
  const hasAuth = hasAnyAuth(content);

  switch (routeType) {
    case 'admin':
      if (!hasAdminAuth(content)) {
        findings.push({
          category: 'auth_missing',
          severity: 'critical',
          file: filePath,
          message: `Admin route ${routePath} missing admin role check (actorService.hasRole ADMIN or requireVinkollAdmin)`,
          suggestion: 'Add actorService.hasRole(actor, "ADMIN") check',
        });
      }
      break;

    case 'access_admin':
      if (!hasAdminAuth(content) && !content.includes('requireVinkollAdmin')) {
        findings.push({
          category: 'auth_missing',
          severity: 'critical',
          file: filePath,
          message: `Vinkoll admin route ${routePath} missing admin guard (requireVinkollAdmin)`,
          suggestion: 'Add requireVinkollAdmin() check',
        });
      }
      break;

    case 'ior':
      if (!hasIORAuth(content)) {
        findings.push({
          category: 'auth_missing',
          severity: 'high',
          file: filePath,
          message: `IOR route ${routePath} missing IOR guard (requireIORContext)`,
          suggestion: 'Add requireIORContext(request) check',
        });
      }
      break;

    case 'access_importer':
      if (!hasTokenAuth(content)) {
        findings.push({
          category: 'auth_missing',
          severity: 'high',
          file: filePath,
          message: `Importer route ${routePath} missing token verification (verifyAuthToken)`,
          suggestion: 'Add verifyAuthToken() check',
        });
      }
      break;

    case 'webhook':
      if (!content.includes('validateInboundSecret') && !hasAuth) {
        findings.push({
          category: 'auth_missing',
          severity: 'high',
          file: filePath,
          message: `Webhook route ${routePath} missing secret validation`,
          suggestion: 'Add validateInboundSecret() or similar secret check',
        });
      }
      break;

    case 'general':
      if (!hasAuth && !isPublic) {
        findings.push({
          category: 'auth_missing',
          severity: 'high',
          file: filePath,
          message: `Route ${routePath} has no authentication check and is not in publicPaths`,
          suggestion: 'Add x-user-id/x-tenant-id header checks or actorService.resolveActor',
        });
      }
      break;
  }

  return findings;
}

/**
 * Run the auth scanner against real files.
 */
export async function runAuthScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: SecurityFinding[] = [];

  try {
    const apiDir = path.join(projectRoot, 'app', 'api');
    const routeFiles = findRouteFiles(apiDir);

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const routePath = fileToRoutePath(path.relative(projectRoot, file));
      const routeFindings = analyzeRouteContent(content, path.relative(projectRoot, file), routePath);
      findings.push(...routeFindings);
    }

    return {
      scanner: 'auth-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'auth-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Recursively find all route.ts files under a directory.
 */
function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}
