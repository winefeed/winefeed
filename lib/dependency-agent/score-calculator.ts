/**
 * Dependency Agent — Score Calculator
 *
 * Scoring (0-100):
 *   Start: 100
 *   critical: -20, high: -10, medium: -3, low: -1, info: 0
 *   Bonus: +5 if 0 vulnerabilities, +5 if 0 unused
 */

import { DependencyFinding, DependencySeverity } from './types';

const SEVERITY_PENALTIES: Record<DependencySeverity, number> = {
  critical: 20,
  high: 10,
  medium: 3,
  low: 1,
  info: 0,
};

export interface ScoreInput {
  findings: DependencyFinding[];
}

export function calculateDependencyScore(input: ScoreInput): number {
  let score = 100;

  // Penalties per finding
  for (const finding of input.findings) {
    score -= SEVERITY_PENALTIES[finding.severity];
  }

  // Bonus: 0 vulnerabilities
  const hasVulnerabilities = input.findings.some(f => f.category === 'vulnerability');
  if (!hasVulnerabilities) score += 5;

  // Bonus: 0 unused
  const hasUnused = input.findings.some(f => f.category === 'unused');
  if (!hasUnused) score += 5;

  return Math.max(0, Math.min(100, score));
}
