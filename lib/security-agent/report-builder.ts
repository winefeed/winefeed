/**
 * Security Agent — Report Builder
 *
 * Aggregates scanner results into a final SecurityReport.
 */

import {
  SecurityReport,
  SecuritySeverity,
  SecurityCategory,
  ScannerResult,
} from './types';
import { calculateSecurityScore } from './score-calculator';

const ALL_SEVERITIES: SecuritySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const ALL_CATEGORIES: SecurityCategory[] = [
  'auth_missing',
  'auth_insufficient',
  'tenant_leak',
  'brand_leak',
  'input_unvalidated',
  'env_exposure',
  'env_gitignore',
];

export function buildSecurityReport(
  scannerResults: ScannerResult[],
  totalRoutes: number,
  routesWithAuth: number,
  totalDurationMs: number,
): SecurityReport {
  // Collect all findings
  const findings = scannerResults.flatMap(r => r.findings);

  // Count by severity
  const bySeverity = Object.fromEntries(
    ALL_SEVERITIES.map(s => [s, 0])
  ) as Record<SecuritySeverity, number>;
  for (const f of findings) {
    bySeverity[f.severity]++;
  }

  // Count by category
  const byCategory = Object.fromEntries(
    ALL_CATEGORIES.map(c => [c, 0])
  ) as Record<SecurityCategory, number>;
  for (const f of findings) {
    byCategory[f.category]++;
  }

  // Calculate score
  const score = calculateSecurityScore({ findings, totalRoutes, routesWithAuth });

  return {
    score,
    totalFindings: findings.length,
    bySeverity,
    byCategory,
    findings,
    scanners: scannerResults,
    timestamp: new Date().toISOString(),
    durationMs: totalDurationMs,
  };
}
