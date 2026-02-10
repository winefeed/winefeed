/**
 * Outdated Scanner
 *
 * Runs `npm outdated --json` and classifies packages by how far behind they are:
 * - 2+ major versions behind = high
 * - 1 major behind = medium
 * - Minor behind = low
 * - Patch behind = info
 */

import { execSync } from 'child_process';
import { DependencyFinding, ScannerResult, DependencySeverity } from '../types';

interface NpmOutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
  dependent: string;
  location: string;
}

/**
 * Parse a semver string into [major, minor, patch].
 */
export function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

/**
 * Classify how outdated a package is.
 */
export function classifyOutdated(
  current: string,
  latest: string,
): DependencySeverity {
  const currentSemver = parseSemver(current);
  const latestSemver = parseSemver(latest);

  if (!currentSemver || !latestSemver) return 'info';

  const majorDiff = latestSemver[0] - currentSemver[0];
  const minorDiff = latestSemver[1] - currentSemver[1];

  if (majorDiff >= 2) return 'high';
  if (majorDiff >= 1) return 'medium';
  if (minorDiff >= 1) return 'low';
  return 'info';
}

/**
 * Parse npm outdated JSON output into findings.
 */
export function parseNpmOutdatedOutput(jsonStr: string): DependencyFinding[] {
  const findings: DependencyFinding[] = [];

  try {
    const outdated: Record<string, NpmOutdatedEntry> = JSON.parse(jsonStr);

    for (const [pkgName, entry] of Object.entries(outdated)) {
      if (!entry.current || !entry.latest) continue;
      if (entry.current === entry.latest) continue;

      const severity = classifyOutdated(entry.current, entry.latest);
      const currentSemver = parseSemver(entry.current);
      const latestSemver = parseSemver(entry.latest);
      const majorDiff = currentSemver && latestSemver
        ? latestSemver[0] - currentSemver[0]
        : 0;

      findings.push({
        category: 'outdated',
        severity,
        package: pkgName,
        currentVersion: entry.current,
        latestVersion: entry.latest,
        message: majorDiff >= 1
          ? `${pkgName} is ${majorDiff} major version(s) behind (${entry.current} → ${entry.latest})`
          : `${pkgName} has updates available (${entry.current} → ${entry.latest})`,
        suggestion: `Run: npm install ${pkgName}@${entry.latest}`,
      });
    }
  } catch {
    // JSON parse error — return empty
  }

  return findings;
}

/**
 * Run the outdated scanner.
 */
export async function runOutdatedScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: DependencyFinding[] = [];

  try {
    let outdatedOutput: string;
    try {
      // npm outdated returns non-zero when outdated packages exist
      outdatedOutput = execSync('npm outdated --json 2>/dev/null', {
        cwd: projectRoot,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });
    } catch (error: any) {
      outdatedOutput = error.stdout || '{}';
    }

    findings.push(...parseNpmOutdatedOutput(outdatedOutput));

    return {
      scanner: 'outdated-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'outdated-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}
