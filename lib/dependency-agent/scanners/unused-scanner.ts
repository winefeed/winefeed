/**
 * Unused Scanner
 *
 * Finds dependencies listed in package.json that are never imported in source code.
 * Checks both `import ... from 'dep'` and `require('dep')` patterns.
 * Has an ignore list for config-only packages (tailwindcss, postcss, eslint, etc.).
 */

import * as fs from 'fs';
import * as path from 'path';
import { DependencyFinding, ScannerResult } from '../types';

// Config-only packages that are used by tools, not imported in source
const IGNORE_DEPS = new Set([
  'tailwindcss',
  'postcss',
  'autoprefixer',
  'eslint',
  'eslint-config-next',
  'typescript',
  'vitest',
  '@vitest/coverage-v8',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  '@types/web-push',
  'dotenv',
]);

/**
 * Extract the base package name from an import specifier.
 * e.g. '@supabase/ssr' → '@supabase/ssr'
 * e.g. 'next/server' → 'next'
 * e.g. 'react' → 'react'
 */
export function extractPackageName(importPath: string): string {
  if (importPath.startsWith('@')) {
    // Scoped package: @scope/name
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  return importPath.split('/')[0];
}

/**
 * Find all package imports in source files.
 */
export function findUsedPackages(sourceFiles: string[]): Set<string> {
  const used = new Set<string>();

  // Patterns: import ... from 'pkg', require('pkg'), import('pkg')
  const importRegex = /(?:from\s+['"]|require\s*\(\s*['"]|import\s*\(\s*['"])([^'"./][^'"]*)['"]/g;

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;

    while ((match = importRegex.exec(content)) !== null) {
      const pkgName = extractPackageName(match[1]);
      used.add(pkgName);
    }
  }

  return used;
}

/**
 * Analyze package.json for unused dependencies.
 */
export function analyzeUnusedDeps(
  packageJsonContent: string,
  usedPackages: Set<string>,
): DependencyFinding[] {
  const findings: DependencyFinding[] = [];

  try {
    const pkg = JSON.parse(packageJsonContent);
    const deps = Object.keys(pkg.dependencies || {});

    for (const dep of deps) {
      if (IGNORE_DEPS.has(dep)) continue;
      if (usedPackages.has(dep)) continue;

      findings.push({
        category: 'unused',
        severity: 'low',
        package: dep,
        currentVersion: pkg.dependencies[dep],
        message: `${dep} is listed in dependencies but never imported in source code`,
        suggestion: `Verify usage or remove: npm uninstall ${dep}`,
      });
    }
  } catch {
    // JSON parse error
  }

  return findings;
}

/**
 * Run the unused scanner.
 */
export async function runUnusedScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: DependencyFinding[] = [];

  try {
    // Read package.json
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return {
        scanner: 'unused-scanner',
        findings,
        durationMs: Date.now() - start,
        error: 'package.json not found',
      };
    }

    const pkgContent = fs.readFileSync(pkgPath, 'utf-8');

    // Find all source files
    const sourceDirs = [
      path.join(projectRoot, 'app'),
      path.join(projectRoot, 'lib'),
      path.join(projectRoot, 'components'),
      path.join(projectRoot, 'scripts'),
    ];

    const sourceFiles: string[] = [];
    for (const dir of sourceDirs) {
      sourceFiles.push(...findSourceFiles(dir));
    }

    const usedPackages = findUsedPackages(sourceFiles);
    findings.push(...analyzeUnusedDeps(pkgContent, usedPackages));

    return {
      scanner: 'unused-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'unused-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Recursively find all .ts/.tsx files.
 */
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}
