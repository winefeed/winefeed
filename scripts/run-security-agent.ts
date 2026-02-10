#!/usr/bin/env npx tsx
/**
 * Security Agent — CLI Runner
 *
 * Usage:
 *   npx tsx scripts/run-security-agent.ts           # Full scan, pretty output
 *   npx tsx scripts/run-security-agent.ts --json     # JSON output
 *   npx tsx scripts/run-security-agent.ts --no-brand --no-env  # Skip scanners
 *
 * Exit code 1 if critical findings are found (useful in CI).
 */

import * as path from 'path';
import { runSecurityScan } from '../lib/security-agent/pipeline';
import { SecurityAgentOptions } from '../lib/security-agent/types';

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

  const options: SecurityAgentOptions = {
    enableAuthScanner: !args.includes('--no-auth'),
    enableTenantScanner: !args.includes('--no-tenant'),
    enableBrandScanner: !args.includes('--no-brand'),
    enableInputScanner: !args.includes('--no-input'),
    enableEnvScanner: !args.includes('--no-env'),
    projectRoot: path.resolve(__dirname, '..'),
  };

  console.log(`${BOLD}Security Agent${RESET} — scanning...`);
  console.log();

  const result = await runSecurityScan(options);
  const { report } = result;

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Pretty output
    console.log();
    console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}  SECURITY SCAN REPORT${RESET}`);
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

    // Findings (grouped by severity)
    if (report.findings.length > 0) {
      console.log(`${BOLD}  Findings:${RESET}`);
      console.log();

      for (const sev of ['critical', 'high', 'medium', 'low'] as const) {
        const sevFindings = report.findings.filter(f => f.severity === sev);
        if (sevFindings.length === 0) continue;

        console.log(`  ${SEVERITY_COLORS[sev]}${BOLD}── ${sev.toUpperCase()} ──${RESET}`);
        for (const f of sevFindings) {
          const loc = f.line ? `${f.file}:${f.line}` : f.file;
          console.log(`    ${SEVERITY_COLORS[sev]}[${sev}]${RESET} ${loc}`);
          console.log(`          ${f.message}`);
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
      console.log(`    ${s.scanner.padEnd(20)} ${status}  ${s.findings.length} findings  ${s.durationMs}ms`);
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
  console.error('Security Agent failed:', err);
  process.exit(2);
});
