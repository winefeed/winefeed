/**
 * Tenant Scanner
 *
 * Finds Supabase queries using SERVICE_ROLE_KEY that don't filter by tenant_id.
 * Since SERVICE_ROLE_KEY bypasses RLS, every query must manually scope to tenant.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecurityFinding, ScannerResult } from '../types';

// Tables that are legitimately NOT tenant-scoped
const TENANT_EXEMPT_TABLES = new Set([
  'access_requests',     // Vinkoll DB — separate Supabase project
  'access_wines',        // Vinkoll DB
  'access_wine_lots',    // Vinkoll DB
  'importers',           // Vinkoll DB
  'watchlists',          // Vinkoll DB
  'watchlist_items',     // Vinkoll DB
  'readiness_packs',     // Vinkoll DB
  'readiness_pack_items', // Vinkoll DB
]);

// Pattern to detect .from('table_name') calls
const FROM_TABLE_REGEX = /\.from\(\s*['"]([^'"]+)['"]\s*\)/g;

// Pattern to detect tenant_id filtering
const TENANT_FILTER_REGEX = /\.eq\(\s*['"]tenant_id['"]/;

// Pattern to detect SERVICE_ROLE_KEY usage
const SERVICE_ROLE_REGEX = /SUPABASE_SERVICE_ROLE_KEY/;

/**
 * Analyze file content for tenant isolation gaps.
 */
export function analyzeTenantIsolation(
  content: string,
  filePath: string,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Only check files that use SERVICE_ROLE_KEY
  if (!SERVICE_ROLE_REGEX.test(content)) return findings;

  const lines = content.split('\n');

  // Find all .from('table') usages
  let match: RegExpExecArray | null;
  const fromRegex = new RegExp(FROM_TABLE_REGEX.source, 'g');

  for (let i = 0; i < lines.length; i++) {
    fromRegex.lastIndex = 0;
    while ((match = fromRegex.exec(lines[i])) !== null) {
      const tableName = match[1];

      // Skip exempt tables
      if (TENANT_EXEMPT_TABLES.has(tableName)) continue;

      // Look ahead in the chain (next ~10 lines) for .eq('tenant_id'
      const lookAheadLines = lines.slice(i, i + 15).join('\n');
      if (!TENANT_FILTER_REGEX.test(lookAheadLines)) {
        findings.push({
          category: 'tenant_leak',
          severity: 'medium',
          file: filePath,
          line: i + 1,
          message: `Query on '${tableName}' (SERVICE_ROLE) without .eq('tenant_id') filter`,
          suggestion: `Add .eq('tenant_id', tenantId) to scope query to current tenant`,
        });
      }
    }
  }

  return findings;
}

/**
 * Run the tenant scanner against real files.
 */
export async function runTenantScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: SecurityFinding[] = [];

  try {
    const dirs = [
      path.join(projectRoot, 'app', 'api'),
      path.join(projectRoot, 'lib'),
    ];

    for (const dir of dirs) {
      const tsFiles = findTsFiles(dir);
      for (const file of tsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const relPath = path.relative(projectRoot, file);
        findings.push(...analyzeTenantIsolation(content, relPath));
      }
    }

    return {
      scanner: 'tenant-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'tenant-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Recursively find all .ts files under a directory.
 */
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}
