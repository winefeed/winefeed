/**
 * Security Agent — Pipeline Orchestrator
 *
 * Runs all security scanners in sequence, each wrapped in try/catch.
 * Produces a final SecurityAgentResult with score and findings.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SecurityAgentOptions,
  SecurityAgentResult,
  ScannerResult,
  DEFAULT_OPTIONS,
} from './types';
import { runAuthScanner, detectHttpMethods, hasAnyAuth } from './scanners/auth-scanner';
import { runTenantScanner } from './scanners/tenant-scanner';
import { runBrandScanner } from './scanners/brand-scanner';
import { runInputScanner } from './scanners/input-scanner';
import { runEnvScanner } from './scanners/env-scanner';
import { buildSecurityReport } from './report-builder';

/**
 * Count total API routes and how many have auth.
 */
function countRouteAuth(projectRoot: string): { totalRoutes: number; routesWithAuth: number } {
  const apiDir = path.join(projectRoot, 'app', 'api');
  const routeFiles = findRouteFiles(apiDir);

  let totalRoutes = 0;
  let routesWithAuth = 0;

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const methods = detectHttpMethods(content);
    if (methods.length === 0) continue;

    totalRoutes++;
    if (hasAnyAuth(content)) routesWithAuth++;
  }

  return { totalRoutes, routesWithAuth };
}

/**
 * Run the full security scan pipeline.
 */
export async function runSecurityScan(
  options: SecurityAgentOptions = DEFAULT_OPTIONS,
): Promise<SecurityAgentResult> {
  const start = Date.now();
  const projectRoot = options.projectRoot || process.cwd();
  const scannerResults: ScannerResult[] = [];

  // Step 1: Auth Scanner
  if (options.enableAuthScanner !== false) {
    try {
      const result = await runAuthScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [auth-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [auth-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'auth-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 2: Tenant Scanner
  if (options.enableTenantScanner !== false) {
    try {
      const result = await runTenantScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [tenant-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [tenant-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'tenant-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 3: Brand Scanner
  if (options.enableBrandScanner !== false) {
    try {
      const result = await runBrandScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [brand-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [brand-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'brand-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 4: Input Scanner
  if (options.enableInputScanner !== false) {
    try {
      const result = await runInputScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [input-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [input-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'input-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 5: Env Scanner
  if (options.enableEnvScanner !== false) {
    try {
      const result = await runEnvScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [env-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [env-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'env-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 6: Build report + score
  const { totalRoutes, routesWithAuth } = countRouteAuth(projectRoot);
  const report = buildSecurityReport(scannerResults, totalRoutes, routesWithAuth, Date.now() - start);

  return { report, options };
}

/**
 * Recursively find all route.ts files.
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
