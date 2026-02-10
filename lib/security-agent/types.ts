/**
 * Security Agent Types
 *
 * Types for the automated security scanning pipeline.
 * Scans API routes for auth gaps, tenant isolation, brand leakage, and input validation.
 */

// ============================================================================
// Pipeline Options
// ============================================================================

export interface SecurityAgentOptions {
  /** Enable auth pattern scanner */
  enableAuthScanner?: boolean;
  /** Enable tenant isolation scanner */
  enableTenantScanner?: boolean;
  /** Enable brand separation scanner */
  enableBrandScanner?: boolean;
  /** Enable input validation scanner */
  enableInputScanner?: boolean;
  /** Enable environment variable scanner */
  enableEnvScanner?: boolean;
  /** Project root directory (defaults to process.cwd()) */
  projectRoot?: string;
}

export const DEFAULT_OPTIONS: SecurityAgentOptions = {
  enableAuthScanner: true,
  enableTenantScanner: true,
  enableBrandScanner: true,
  enableInputScanner: true,
  enableEnvScanner: true,
};

// ============================================================================
// Severity & Findings
// ============================================================================

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type SecurityCategory =
  | 'auth_missing'
  | 'auth_insufficient'
  | 'tenant_leak'
  | 'brand_leak'
  | 'input_unvalidated'
  | 'env_exposure'
  | 'env_gitignore';

export interface SecurityFinding {
  category: SecurityCategory;
  severity: SecuritySeverity;
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Scanner Results
// ============================================================================

export interface ScannerResult {
  scanner: string;
  findings: SecurityFinding[];
  durationMs: number;
  error?: string;
}

// ============================================================================
// Route Classification
// ============================================================================

export type RouteType = 'admin' | 'ior' | 'access_importer' | 'access_admin' | 'webhook' | 'general';

export interface RouteInfo {
  file: string;
  routePath: string;
  routeType: RouteType;
  httpMethods: string[];
  isPublic: boolean;
}

// ============================================================================
// Report
// ============================================================================

export interface SecurityReport {
  score: number;
  totalFindings: number;
  bySeverity: Record<SecuritySeverity, number>;
  byCategory: Record<SecurityCategory, number>;
  findings: SecurityFinding[];
  scanners: ScannerResult[];
  timestamp: string;
  durationMs: number;
}

export interface SecurityAgentResult {
  report: SecurityReport;
  options: SecurityAgentOptions;
}
