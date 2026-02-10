/**
 * Dependency Agent Types
 *
 * Types for the automated dependency scanning pipeline.
 * Scans for vulnerabilities, outdated packages, unused deps, and license issues.
 */

// ============================================================================
// Pipeline Options
// ============================================================================

export interface DependencyAgentOptions {
  /** Enable vulnerability scanner (npm audit) */
  enableVulnerabilityScanner?: boolean;
  /** Enable outdated package scanner */
  enableOutdatedScanner?: boolean;
  /** Enable unused dependency scanner */
  enableUnusedScanner?: boolean;
  /** Enable license scanner */
  enableLicenseScanner?: boolean;
  /** Project root directory (defaults to process.cwd()) */
  projectRoot?: string;
}

export const DEFAULT_OPTIONS: DependencyAgentOptions = {
  enableVulnerabilityScanner: true,
  enableOutdatedScanner: true,
  enableUnusedScanner: true,
  enableLicenseScanner: true,
};

// ============================================================================
// Severity & Findings
// ============================================================================

export type DependencySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type DependencyCategory =
  | 'vulnerability'
  | 'outdated'
  | 'unused'
  | 'license';

export interface DependencyFinding {
  category: DependencyCategory;
  severity: DependencySeverity;
  package: string;
  message: string;
  /** CVE ID for vulnerabilities */
  cveId?: string;
  /** Current version */
  currentVersion?: string;
  /** Latest available version */
  latestVersion?: string;
  /** License name */
  license?: string;
  suggestion?: string;
}

// ============================================================================
// Scanner Results
// ============================================================================

export interface ScannerResult {
  scanner: string;
  findings: DependencyFinding[];
  durationMs: number;
  error?: string;
}

// ============================================================================
// Report
// ============================================================================

export interface DependencyReport {
  score: number;
  totalFindings: number;
  bySeverity: Record<DependencySeverity, number>;
  byCategory: Record<DependencyCategory, number>;
  findings: DependencyFinding[];
  scanners: ScannerResult[];
  timestamp: string;
  durationMs: number;
}

export interface DependencyAgentResult {
  report: DependencyReport;
  options: DependencyAgentOptions;
}
