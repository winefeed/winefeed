/**
 * Dependency Agent — Report Builder
 *
 * Aggregates scanner results into a final DependencyReport.
 */

import {
  DependencyReport,
  DependencySeverity,
  DependencyCategory,
  ScannerResult,
} from './types';
import { calculateDependencyScore } from './score-calculator';

const ALL_SEVERITIES: DependencySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const ALL_CATEGORIES: DependencyCategory[] = ['vulnerability', 'outdated', 'unused', 'license'];

export function buildDependencyReport(
  scannerResults: ScannerResult[],
  totalDurationMs: number,
): DependencyReport {
  // Collect all findings
  const findings = scannerResults.flatMap(r => r.findings);

  // Count by severity
  const bySeverity = Object.fromEntries(
    ALL_SEVERITIES.map(s => [s, 0])
  ) as Record<DependencySeverity, number>;
  for (const f of findings) {
    bySeverity[f.severity]++;
  }

  // Count by category
  const byCategory = Object.fromEntries(
    ALL_CATEGORIES.map(c => [c, 0])
  ) as Record<DependencyCategory, number>;
  for (const f of findings) {
    byCategory[f.category]++;
  }

  // Calculate score
  const score = calculateDependencyScore({ findings });

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
