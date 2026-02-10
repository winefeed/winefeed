/**
 * License Scanner
 *
 * Reads license info from node_modules/{dep}/package.json.
 * Classifies: GPL/AGPL = high, LGPL = medium, MIT/Apache/BSD = info, missing = low.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DependencyFinding, ScannerResult, DependencySeverity } from '../types';

// License risk classification
const LICENSE_RISK: Record<string, DependencySeverity> = {
  // Copyleft — high risk for proprietary projects
  'GPL': 'high',
  'GPL-2.0': 'high',
  'GPL-3.0': 'high',
  'AGPL': 'high',
  'AGPL-3.0': 'high',
  'AGPL-3.0-only': 'high',
  'AGPL-3.0-or-later': 'high',
  // Weak copyleft — medium risk
  'LGPL': 'medium',
  'LGPL-2.1': 'medium',
  'LGPL-3.0': 'medium',
  // Permissive — no risk
  'MIT': 'info',
  'Apache-2.0': 'info',
  'BSD-2-Clause': 'info',
  'BSD-3-Clause': 'info',
  'ISC': 'info',
  '0BSD': 'info',
  'Unlicense': 'info',
  'CC0-1.0': 'info',
  'BlueOak-1.0.0': 'info',
  'Python-2.0': 'info',
};

/**
 * Classify a license string into a severity level.
 */
export function classifyLicense(license: string | undefined): { severity: DependencySeverity; normalized: string } {
  if (!license) {
    return { severity: 'low', normalized: 'UNKNOWN' };
  }

  const normalized = license.trim();

  // Exact match
  if (LICENSE_RISK[normalized] !== undefined) {
    return { severity: LICENSE_RISK[normalized], normalized };
  }

  // Partial match (e.g. "MIT License" → MIT)
  // SPDX expression with OR — check first, use most permissive
  if (normalized.includes(' OR ')) {
    const parts = normalized.split(' OR ').map(p => p.trim().replace(/[()]/g, ''));
    const severities = parts.map(p => classifyLicense(p).severity);
    if (severities.includes('info')) return { severity: 'info', normalized };
    if (severities.includes('low')) return { severity: 'low', normalized };
    if (severities.includes('medium')) return { severity: 'medium', normalized };
    return { severity: 'high', normalized };
  }

  const upper = normalized.toUpperCase();
  if (upper.includes('AGPL')) {
    return { severity: 'high', normalized };
  }
  if (upper.includes('LGPL')) {
    return { severity: 'medium', normalized };
  }
  if (upper.includes('GPL') || upper.includes('GENERAL PUBLIC LICENSE')) {
    return { severity: 'high', normalized };
  }
  if (upper.includes('MIT') || upper.includes('APACHE') || upper.includes('BSD') || upper.includes('ISC')) {
    return { severity: 'info', normalized };
  }

  return { severity: 'low', normalized };
}

/**
 * Read license from a package's package.json in node_modules.
 */
export function readPackageLicense(
  nodeModulesDir: string,
  pkgName: string,
): string | undefined {
  try {
    const pkgJsonPath = path.join(nodeModulesDir, pkgName, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return undefined;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    return pkgJson.license || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Analyze licenses for all dependencies.
 */
export function analyzeLicenses(
  dependencies: string[],
  nodeModulesDir: string,
): DependencyFinding[] {
  const findings: DependencyFinding[] = [];

  for (const dep of dependencies) {
    const license = readPackageLicense(nodeModulesDir, dep);
    const { severity, normalized } = classifyLicense(license);

    // Only report non-info findings
    if (severity !== 'info') {
      findings.push({
        category: 'license',
        severity,
        package: dep,
        license: normalized,
        message: !license
          ? `${dep} has no license specified`
          : `${dep} uses ${normalized} license`,
        suggestion: severity === 'high'
          ? `Review GPL/AGPL license compatibility with your project`
          : severity === 'medium'
            ? `Review LGPL license requirements`
            : undefined,
      });
    }
  }

  return findings;
}

/**
 * Run the license scanner.
 */
export async function runLicenseScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: DependencyFinding[] = [];

  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return {
        scanner: 'license-scanner',
        findings,
        durationMs: Date.now() - start,
        error: 'package.json not found',
      };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const allDeps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];

    const nodeModulesDir = path.join(projectRoot, 'node_modules');
    findings.push(...analyzeLicenses(allDeps, nodeModulesDir));

    return {
      scanner: 'license-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'license-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}
