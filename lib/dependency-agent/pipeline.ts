/**
 * Dependency Agent — Pipeline Orchestrator
 *
 * Runs all dependency scanners in sequence, each wrapped in try/catch.
 * Produces a final DependencyAgentResult with score and findings.
 */

import {
  DependencyAgentOptions,
  DependencyAgentResult,
  ScannerResult,
  DEFAULT_OPTIONS,
} from './types';
import { runVulnerabilityScanner } from './scanners/vulnerability-scanner';
import { runOutdatedScanner } from './scanners/outdated-scanner';
import { runUnusedScanner } from './scanners/unused-scanner';
import { runLicenseScanner } from './scanners/license-scanner';
import { buildDependencyReport } from './report-builder';

/**
 * Run the full dependency scan pipeline.
 */
export async function runDependencyScan(
  options: DependencyAgentOptions = DEFAULT_OPTIONS,
): Promise<DependencyAgentResult> {
  const start = Date.now();
  const projectRoot = options.projectRoot || process.cwd();
  const scannerResults: ScannerResult[] = [];

  // Step 1: Vulnerability Scanner
  if (options.enableVulnerabilityScanner !== false) {
    try {
      const result = await runVulnerabilityScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [vulnerability-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [vulnerability-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'vulnerability-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 2: Outdated Scanner
  if (options.enableOutdatedScanner !== false) {
    try {
      const result = await runOutdatedScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [outdated-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [outdated-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'outdated-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 3: Unused Scanner
  if (options.enableUnusedScanner !== false) {
    try {
      const result = await runUnusedScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [unused-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [unused-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'unused-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 4: License Scanner
  if (options.enableLicenseScanner !== false) {
    try {
      const result = await runLicenseScanner(projectRoot);
      scannerResults.push(result);
      console.log(`  [license-scanner] ${result.findings.length} findings (${result.durationMs}ms)`);
    } catch (error: any) {
      console.warn('  [license-scanner] Failed:', error.message);
      scannerResults.push({ scanner: 'license-scanner', findings: [], durationMs: 0, error: error.message });
    }
  }

  // Step 5: Build report + score
  const report = buildDependencyReport(scannerResults, Date.now() - start);

  return { report, options };
}
