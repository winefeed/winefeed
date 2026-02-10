/**
 * Input Scanner
 *
 * Finds API routes that parse request body (request.json()) without validation
 * (zod .parse/.safeParse, validate, etc.).
 * POST/PUT/PATCH without validation = medium, GET = low.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecurityFinding, ScannerResult } from '../types';

// Pattern to detect request body parsing
const REQUEST_JSON_REGEX = /request\.json\(\)/;
const REQUEST_FORM_REGEX = /request\.formData\(\)/;

// Patterns that indicate validation
const VALIDATION_PATTERNS = [
  /\.parse\(/,
  /\.safeParse\(/,
  /\.parseAsync\(/,
  /\.safeParseAsync\(/,
  /validate\(/i,
  /schema\./,
  /Schema\./,
  /z\.\w+/,      // zod usage like z.object, z.string
];

// HTTP methods that typically send a body
const BODY_METHODS = ['POST', 'PUT', 'PATCH'];

/**
 * Analyze route content for unvalidated input.
 */
export function analyzeInputValidation(
  content: string,
  filePath: string,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  const hasRequestJson = REQUEST_JSON_REGEX.test(content);
  const hasRequestForm = REQUEST_FORM_REGEX.test(content);

  if (!hasRequestJson && !hasRequestForm) return findings;

  const hasValidation = VALIDATION_PATTERNS.some(p => p.test(content));
  if (hasValidation) return findings;

  // Determine which methods are exported
  const hasBodyMethod = BODY_METHODS.some(method => {
    const regex = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    return regex.test(content);
  });

  const hasGetOnly = /export\s+(async\s+)?function\s+GET\b/.test(content) && !hasBodyMethod;

  if (hasBodyMethod) {
    findings.push({
      category: 'input_unvalidated',
      severity: 'medium',
      file: filePath,
      message: `Route parses request body without validation (no zod schema detected)`,
      suggestion: 'Add zod schema validation: const body = schema.parse(await request.json())',
    });
  } else if (hasGetOnly) {
    findings.push({
      category: 'input_unvalidated',
      severity: 'low',
      file: filePath,
      message: `Route parses request data without validation`,
      suggestion: 'Consider adding input validation',
    });
  }

  return findings;
}

/**
 * Run the input scanner against real files.
 */
export async function runInputScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: SecurityFinding[] = [];

  try {
    const apiDir = path.join(projectRoot, 'app', 'api');
    const routeFiles = findRouteFiles(apiDir);

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(projectRoot, file);
      findings.push(...analyzeInputValidation(content, relPath));
    }

    return {
      scanner: 'input-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'input-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Recursively find all route.ts files.
 */
function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}
