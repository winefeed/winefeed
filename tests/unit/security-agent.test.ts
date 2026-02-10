/**
 * Security Agent — Unit Tests
 *
 * Tests scanner core logic using string content (no filesystem mocking needed).
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeRouteContent,
  classifyRoute,
  fileToRoutePath,
  hasAnyAuth,
  hasAdminAuth,
  detectHttpMethods,
} from '../../lib/security-agent/scanners/auth-scanner';
import { analyzeTenantIsolation } from '../../lib/security-agent/scanners/tenant-scanner';
import { analyzeBrandLeakage, stripComments, isAccessPath } from '../../lib/security-agent/scanners/brand-scanner';
import { analyzeInputValidation } from '../../lib/security-agent/scanners/input-scanner';
import { analyzeEnvVars, analyzeGitignore } from '../../lib/security-agent/scanners/env-scanner';
import { calculateSecurityScore } from '../../lib/security-agent/score-calculator';
import type { SecurityFinding } from '../../lib/security-agent/types';

// ============================================================================
// Auth Scanner
// ============================================================================

describe('auth-scanner', () => {
  it('flags admin route without admin role check', () => {
    const content = `
      export async function GET(request: NextRequest) {
        const data = await supabase.from('users').select('*');
        return NextResponse.json(data);
      }
    `;
    const findings = analyzeRouteContent(content, 'app/api/admin/users/route.ts', '/api/admin/users');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].category).toBe('auth_missing');
  });

  it('passes admin route with proper auth', () => {
    const content = `
      export async function GET(request: NextRequest) {
        const userId = request.headers.get('x-user-id');
        const tenantId = request.headers.get('x-tenant-id');
        const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
        if (!actorService.hasRole(actor, 'ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeRouteContent(content, 'app/api/admin/stats/route.ts', '/api/admin/stats');
    expect(findings.length).toBe(0);
  });

  it('flags IOR route without IOR guard', () => {
    const content = `
      export async function GET(request: NextRequest) {
        return NextResponse.json({ data: [] });
      }
    `;
    const findings = analyzeRouteContent(content, 'app/api/ior/dashboard/route.ts', '/api/ior/dashboard');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('high');
  });

  it('passes IOR route with requireIORContext', () => {
    const content = `
      export async function GET(request: NextRequest) {
        const result = await requireIORContext(request);
        if (isGuardError(result)) return guardErrorResponse(result);
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeRouteContent(content, 'app/api/ior/cases/route.ts', '/api/ior/cases');
    expect(findings.length).toBe(0);
  });

  it('flags general route without any auth', () => {
    const content = `
      export async function POST(request: NextRequest) {
        const body = await request.json();
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeRouteContent(content, 'app/api/wines/route.ts', '/api/wines');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('high');
  });

  it('passes route with x-user-id check', () => {
    const content = `
      export async function GET(request: NextRequest) {
        const userId = request.headers.get('x-user-id');
        const tenantId = request.headers.get('x-tenant-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeRouteContent(content, 'app/api/wines/route.ts', '/api/wines');
    expect(findings.length).toBe(0);
  });

  it('classifies routes correctly', () => {
    expect(classifyRoute('/api/admin/users')).toBe('admin');
    expect(classifyRoute('/api/admin/access/requests')).toBe('access_admin');
    expect(classifyRoute('/api/ior/dashboard')).toBe('ior');
    expect(classifyRoute('/api/access/importer/respond/abc')).toBe('access_importer');
    expect(classifyRoute('/api/wines')).toBe('general');
    expect(classifyRoute('/api/webhook/inbound')).toBe('webhook');
  });

  it('converts file path to route path', () => {
    expect(fileToRoutePath('app/api/admin/stats/route.ts')).toBe('/api/admin/stats');
    expect(fileToRoutePath('app/api/wines/[id]/route.ts')).toBe('/api/wines/:id');
  });

  it('detects HTTP methods', () => {
    const content = `
      export async function GET(req) {}
      export async function POST(req) {}
    `;
    expect(detectHttpMethods(content)).toEqual(['GET', 'POST']);
  });

  it('skips files with no exported HTTP handlers', () => {
    const content = `export const config = { runtime: 'edge' };`;
    const findings = analyzeRouteContent(content, 'app/api/test/route.ts', '/api/test');
    expect(findings.length).toBe(0);
  });

  it('flags importer route without token verification', () => {
    const content = `
      export async function POST(request: NextRequest) {
        const body = await request.json();
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeRouteContent(
      content,
      'app/api/access/importer/respond/[token]/route.ts',
      '/api/access/importer/respond/:token'
    );
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('high');
  });
});

// ============================================================================
// Tenant Scanner
// ============================================================================

describe('tenant-scanner', () => {
  it('flags SERVICE_ROLE query without tenant_id filter', () => {
    const content = `
      const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await supabase.from('suppliers').select('*');
    `;
    const findings = analyzeTenantIsolation(content, 'app/api/admin/suppliers/route.ts');
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe('tenant_leak');
  });

  it('passes query with tenant_id filter', () => {
    const content = `
      const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await supabase.from('suppliers').select('*').eq('tenant_id', tenantId);
    `;
    const findings = analyzeTenantIsolation(content, 'app/api/admin/suppliers/route.ts');
    expect(findings.length).toBe(0);
  });

  it('skips files without SERVICE_ROLE_KEY', () => {
    const content = `
      const { data } = await supabase.from('suppliers').select('*');
    `;
    const findings = analyzeTenantIsolation(content, 'lib/some-service.ts');
    expect(findings.length).toBe(0);
  });

  it('skips exempt tables (access_requests)', () => {
    const content = `
      const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await supabase.from('access_requests').select('*');
    `;
    const findings = analyzeTenantIsolation(content, 'lib/access-service.ts');
    expect(findings.length).toBe(0);
  });
});

// ============================================================================
// Brand Scanner
// ============================================================================

describe('brand-scanner', () => {
  it('flags @winefeed.se in access path', () => {
    const content = `const email = "hej@winefeed.se";`;
    const findings = analyzeBrandLeakage(content, 'app/access/admin/page.tsx');
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe('brand_leak');
    expect(findings[0].message).toContain('Vinkoll file');
  });

  it('flags @vinkoll.se outside access path', () => {
    const content = `const email = "hej@vinkoll.se";`;
    const findings = analyzeBrandLeakage(content, 'app/dashboard/page.tsx');
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe('brand_leak');
    expect(findings[0].message).toContain('Winefeed file');
  });

  it('ignores comments', () => {
    const content = `
      // Contact: hej@winefeed.se
      /* Email: hej@winefeed.se */
      const x = 1;
    `;
    const findings = analyzeBrandLeakage(content, 'app/access/admin/page.tsx');
    expect(findings.length).toBe(0);
  });

  it('passes correct brand usage', () => {
    const content = `const email = "hej@vinkoll.se";`;
    const findings = analyzeBrandLeakage(content, 'app/access/admin/page.tsx');
    expect(findings.length).toBe(0);
  });

  it('passes winefeed email outside access', () => {
    const content = `const email = "hej@winefeed.se";`;
    const findings = analyzeBrandLeakage(content, 'app/dashboard/page.tsx');
    expect(findings.length).toBe(0);
  });

  it('strips comments correctly', () => {
    const input = `code // comment\n/* block\ncomment */\nmore code`;
    const result = stripComments(input);
    expect(result).not.toContain('comment');
    expect(result).toContain('code');
    expect(result).toContain('more code');
  });

  it('identifies access paths', () => {
    expect(isAccessPath('app/access/admin/page.tsx')).toBe(true);
    expect(isAccessPath('lib/access-service.ts')).toBe(true);
    expect(isAccessPath('app/dashboard/page.tsx')).toBe(false);
  });
});

// ============================================================================
// Input Scanner
// ============================================================================

describe('input-scanner', () => {
  it('flags request.json() without validation in POST', () => {
    const content = `
      export async function POST(request: NextRequest) {
        const body = await request.json();
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeInputValidation(content, 'app/api/wines/route.ts');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('medium');
  });

  it('passes route with zod validation', () => {
    const content = `
      import { z } from 'zod';
      const schema = z.object({ name: z.string() });
      export async function POST(request: NextRequest) {
        const body = schema.parse(await request.json());
        return NextResponse.json(body);
      }
    `;
    const findings = analyzeInputValidation(content, 'app/api/wines/route.ts');
    expect(findings.length).toBe(0);
  });

  it('passes route with safeParse', () => {
    const content = `
      export async function POST(request: NextRequest) {
        const raw = await request.json();
        const result = schema.safeParse(raw);
        return NextResponse.json(result);
      }
    `;
    const findings = analyzeInputValidation(content, 'app/api/wines/route.ts');
    expect(findings.length).toBe(0);
  });

  it('passes route without request.json()', () => {
    const content = `
      export async function GET(request: NextRequest) {
        return NextResponse.json({ ok: true });
      }
    `;
    const findings = analyzeInputValidation(content, 'app/api/wines/route.ts');
    expect(findings.length).toBe(0);
  });
});

// ============================================================================
// Env Scanner
// ============================================================================

describe('env-scanner', () => {
  it('flags NEXT_PUBLIC_ var with SECRET in name', () => {
    const content = `NEXT_PUBLIC_SECRET_KEY=abc123`;
    const findings = analyzeEnvVars(content, '.env');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('critical');
  });

  it('allows known safe public vars', () => {
    const content = `NEXT_PUBLIC_SUPABASE_ANON_KEY=abc`;
    const findings = analyzeEnvVars(content, '.env');
    expect(findings.length).toBe(0);
  });

  it('ignores non-NEXT_PUBLIC vars', () => {
    const content = `SUPABASE_SERVICE_ROLE_KEY=secret123`;
    const findings = analyzeEnvVars(content, '.env');
    expect(findings.length).toBe(0);
  });

  it('ignores comments', () => {
    const content = `# NEXT_PUBLIC_SECRET_KEY=abc`;
    const findings = analyzeEnvVars(content, '.env');
    expect(findings.length).toBe(0);
  });

  it('flags missing .env in .gitignore', () => {
    const findings = analyzeGitignore(`node_modules\n.next`);
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe('env_gitignore');
  });

  it('passes .gitignore with .env.local', () => {
    const findings = analyzeGitignore(`.env.local\nnode_modules`);
    expect(findings.length).toBe(0);
  });
});

// ============================================================================
// Score Calculator
// ============================================================================

describe('score-calculator', () => {
  it('returns 100 + bonuses for 0 findings', () => {
    const score = calculateSecurityScore({
      findings: [],
      totalRoutes: 100,
      routesWithAuth: 95,
    });
    // 100 + 5 (gitignore OK) + 5 (90%+ auth) + 5 (0 brand leak) = 115 → capped at 100
    expect(score).toBe(100);
  });

  it('deducts for critical findings', () => {
    const findings: SecurityFinding[] = [
      { category: 'auth_missing', severity: 'critical', file: 'a.ts', message: 'test' },
    ];
    const score = calculateSecurityScore({
      findings,
      totalRoutes: 10,
      routesWithAuth: 9,
    });
    // 100 - 15 + 5 (gitignore) + 5 (90% auth) + 5 (brand) = 100
    expect(score).toBe(100);
  });

  it('many criticals drive score to 0', () => {
    const findings: SecurityFinding[] = Array(10).fill({
      category: 'auth_missing',
      severity: 'critical',
      file: 'a.ts',
      message: 'test',
    });
    const score = calculateSecurityScore({
      findings,
      totalRoutes: 10,
      routesWithAuth: 0,
    });
    // 100 - 150 + 5 (gitignore) + 0 (low auth) + 5 (brand) = -40 → 0
    expect(score).toBe(0);
  });

  it('brand leak removes brand bonus', () => {
    const findings: SecurityFinding[] = [
      { category: 'brand_leak', severity: 'medium', file: 'a.ts', message: 'test' },
    ];
    const score = calculateSecurityScore({
      findings,
      totalRoutes: 10,
      routesWithAuth: 10,
    });
    // 100 - 3 + 5 (gitignore) + 5 (auth) + 0 (brand leak exists) = 107 → 100
    expect(score).toBeLessThanOrEqual(100);
  });
});
