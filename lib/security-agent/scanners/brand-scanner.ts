/**
 * Brand Scanner
 *
 * Ensures Winefeed and Vinkoll brands are never mixed:
 * - Files under /access/ must NOT reference @winefeed.se
 * - Files outside /access/ must NOT reference @vinkoll.se
 *
 * Ignores comments (single-line and multi-line).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecurityFinding, ScannerResult } from '../types';

const WINEFEED_EMAIL_REGEX = /@winefeed\.se/g;
const VINKOLL_EMAIL_REGEX = /@vinkoll\.se/g;

/**
 * Strip single-line and multi-line comments from source code.
 */
export function stripComments(content: string): string {
  // Remove single-line comments
  let result = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

/**
 * Check if a file path is in the Vinkoll Access domain.
 */
export function isAccessPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('/access/') || normalized.includes('/access-');
}

/**
 * Analyze file content for brand leakage.
 */
export function analyzeBrandLeakage(
  content: string,
  filePath: string,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const stripped = stripComments(content);
  const lines = stripped.split('\n');
  const isVinkollPath = isAccessPath(filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isVinkollPath) {
      // Vinkoll files should NOT reference @winefeed.se
      if (WINEFEED_EMAIL_REGEX.test(line)) {
        findings.push({
          category: 'brand_leak',
          severity: 'medium',
          file: filePath,
          line: i + 1,
          message: `Vinkoll file references @winefeed.se — brands must not be mixed`,
          suggestion: 'Replace with @vinkoll.se or hej@vinkoll.se',
        });
      }
      WINEFEED_EMAIL_REGEX.lastIndex = 0;
    } else {
      // Non-Vinkoll files should NOT reference @vinkoll.se
      if (VINKOLL_EMAIL_REGEX.test(line)) {
        findings.push({
          category: 'brand_leak',
          severity: 'medium',
          file: filePath,
          line: i + 1,
          message: `Winefeed file references @vinkoll.se — brands must not be mixed`,
          suggestion: 'Replace with @winefeed.se or hej@winefeed.se',
        });
      }
      VINKOLL_EMAIL_REGEX.lastIndex = 0;
    }
  }

  return findings;
}

/**
 * Run the brand scanner against real files.
 */
export async function runBrandScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: SecurityFinding[] = [];

  try {
    const dirs = [
      path.join(projectRoot, 'app'),
      path.join(projectRoot, 'lib'),
      path.join(projectRoot, 'components'),
    ];

    for (const dir of dirs) {
      const tsFiles = findSourceFiles(dir);
      for (const file of tsFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const relPath = path.relative(projectRoot, file);
        findings.push(...analyzeBrandLeakage(content, relPath));
      }
    }

    return {
      scanner: 'brand-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'brand-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Recursively find all .ts/.tsx files under a directory.
 */
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findSourceFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}
