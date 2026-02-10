#!/usr/bin/env npx tsx
/**
 * Dependency Agent — CLI Runner
 *
 * Usage:
 *   npx tsx scripts/run-dependency-agent.ts           # Full scan, pretty output
 *   npx tsx scripts/run-dependency-agent.ts --json     # JSON output
 *   npx tsx scripts/run-dependency-agent.ts --no-unused --no-license  # Skip scanners
 *
 * Exit code 1 if critical findings are found (useful in CI).
 */

import * as path from 'path';
import { runDependencyScan } from '../lib/dependency-agent/pipeline';
import { DependencyAgentOptions } from '../lib/dependency-agent/types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '\x1b[31m',  // red
  high: '\x1b[33m',      // yellow
  medium: '\x1b[36m',    // cyan
  low: '\x1b[37m',       // white
  info: '\x1b[90m',      // gray
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const options: DependencyAgentOptions = {
    enableVulnerabilityScanner: !args.includes('--no-vuln'),
    enableOutdatedScanner: !args.includes('--no-outdated'),
    enableUnusedScanner: !args.includes('--no-unused'),
    enableLicenseScanner: !args.includes('--no-license'),
    projectRoot: path.resolve(__dirname, '..'),
  };

  console.log(`${BOLD}Dependency Agent${RESET} — scanning...`);
  console.log();

  const result = await runDependencyScan(options);
  const { report } = result;

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Pretty output
    console.log();
    console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}  DEPENDENCY SCAN REPORT${RESET}`);
    console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
    console.log();

    // Score
    const scoreColor = report.score >= 80 ? '\x1b[32m' : report.score >= 60 ? '\x1b[33m' : '\x1b[31m';
    console.log(`  Score: ${scoreColor}${BOLD}${report.score}/100${RESET}`);
    console.log(`  Total findings: ${report.totalFindings}`);
    console.log(`  Duration: ${report.durationMs}ms`);
    console.log();

    // Severity breakdown
    console.log(`${BOLD}  By Severity:${RESET}`);
    for (const sev of ['critical', 'high', 'medium', 'low', 'info'] as const) {
      const count = report.bySeverity[sev];
      if (count > 0) {
        console.log(`    ${SEVERITY_COLORS[sev]}${sev.toUpperCase().padEnd(10)}${RESET} ${count}`);
      }
    }
    console.log();

    // Category breakdown
    console.log(`${BOLD}  By Category:${RESET}`);
    for (const [cat, count] of Object.entries(report.byCategory)) {
      if (count > 0) {
        console.log(`    ${cat.padEnd(20)} ${count}`);
      }
    }
    console.log();

    // Findings (grouped by category)
    if (report.findings.length > 0) {
      for (const cat of ['vulnerability', 'outdated', 'unused', 'license'] as const) {
        const catFindings = report.findings.filter(f => f.category === cat);
        if (catFindings.length === 0) continue;

        console.log(`${BOLD}  ── ${cat.toUpperCase()} (${catFindings.length}) ──${RESET}`);
        for (const f of catFindings) {
          const sevColor = SEVERITY_COLORS[f.severity];
          const version = f.currentVersion && f.latestVersion
            ? ` (${f.currentVersion} → ${f.latestVersion})`
            : f.currentVersion
              ? ` (${f.currentVersion})`
              : '';
          console.log(`    ${sevColor}[${f.severity}]${RESET} ${f.package}${version}`);
          console.log(`          ${f.message}`);
          if (f.cveId) {
            console.log(`          CVE: ${f.cveId}`);
          }
          if (f.license) {
            console.log(`          License: ${f.license}`);
          }
          if (f.suggestion) {
            console.log(`          → ${f.suggestion}`);
          }
        }
        console.log();
      }
    }

    // Scanner status
    console.log(`${BOLD}  Scanners:${RESET}`);
    for (const s of report.scanners) {
      const status = s.error ? `\x1b[31mERROR${RESET}` : `\x1b[32mOK${RESET}`;
      console.log(`    ${s.scanner.padEnd(25)} ${status}  ${s.findings.length} findings  ${s.durationMs}ms`);
    }
    console.log();
    console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
  }

  // Exit code 1 if critical findings
  if (report.bySeverity.critical > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Dependency Agent failed:', err);
  process.exit(2);
});
