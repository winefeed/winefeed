/**
 * Security Agent — Score Calculator
 *
 * Scoring (0-100):
 *   Start: 100
 *   critical: -15, high: -8, medium: -3, low: -1, info: 0
 *   Bonus: +5 if .gitignore OK, +5 if 90%+ routes have auth, +5 if 0 brand leakage
 */

import { SecurityFinding, SecuritySeverity } from './types';

const SEVERITY_PENALTIES: Record<SecuritySeverity, number> = {
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
  info: 0,
};

export interface ScoreInput {
  findings: SecurityFinding[];
  totalRoutes: number;
  routesWithAuth: number;
}

export function calculateSecurityScore(input: ScoreInput): number {
  let score = 100;

  // Penalties per finding
  for (const finding of input.findings) {
    score -= SEVERITY_PENALTIES[finding.severity];
  }

  // Bonus: .gitignore OK (no env_gitignore findings)
  const hasGitignoreIssue = input.findings.some(f => f.category === 'env_gitignore');
  if (!hasGitignoreIssue) score += 5;

  // Bonus: 90%+ routes have auth
  if (input.totalRoutes > 0) {
    const authRatio = input.routesWithAuth / input.totalRoutes;
    if (authRatio >= 0.9) score += 5;
  }

  // Bonus: 0 brand leakage
  const hasBrandLeak = input.findings.some(f => f.category === 'brand_leak');
  if (!hasBrandLeak) score += 5;

  return Math.max(0, Math.min(100, score));
}
