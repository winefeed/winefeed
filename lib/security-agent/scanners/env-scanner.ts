/**
 * Env Scanner
 *
 * Checks for environment variable security issues:
 * 1. NEXT_PUBLIC_ vars that contain secrets (SECRET, TOKEN, PASSWORD in name)
 * 2. .gitignore includes .env*.local
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecurityFinding, ScannerResult } from '../types';

// Sensitive keywords that should never be in NEXT_PUBLIC_ vars
const SENSITIVE_KEYWORDS = ['SECRET', 'TOKEN', 'PASSWORD', 'KEY', 'PRIVATE'];

// Exceptions — public keys are OK
const SAFE_PUBLIC_VARS = new Set([
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
]);

/**
 * Analyze environment variable names for exposure risks.
 */
export function analyzeEnvVars(envContent: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = envContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const varName = line.slice(0, eqIndex).trim();

    if (!varName.startsWith('NEXT_PUBLIC_')) continue;
    if (SAFE_PUBLIC_VARS.has(varName)) continue;

    const hasSensitiveKeyword = SENSITIVE_KEYWORDS.some(kw =>
      varName.toUpperCase().includes(kw)
    );

    if (hasSensitiveKeyword) {
      findings.push({
        category: 'env_exposure',
        severity: 'critical',
        file: filePath,
        line: i + 1,
        message: `NEXT_PUBLIC_ variable '${varName}' may expose a secret to the client`,
        suggestion: 'Remove NEXT_PUBLIC_ prefix or move to server-only env var',
      });
    }
  }

  return findings;
}

/**
 * Check that .gitignore properly excludes env files.
 */
export function analyzeGitignore(gitignoreContent: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  const hasEnvLocal = /\.env\*\.local/.test(gitignoreContent) ||
    /\.env\.local/.test(gitignoreContent);
  const hasEnv = /^\.env$/m.test(gitignoreContent) ||
    /^\.env\s/m.test(gitignoreContent);

  if (!hasEnvLocal && !hasEnv) {
    findings.push({
      category: 'env_gitignore',
      severity: 'high',
      file: '.gitignore',
      message: '.gitignore does not exclude .env files — secrets may be committed',
      suggestion: 'Add .env*.local and .env to .gitignore',
    });
  }

  return findings;
}

/**
 * Run the env scanner against real files.
 */
export async function runEnvScanner(projectRoot: string): Promise<ScannerResult> {
  const start = Date.now();
  const findings: SecurityFinding[] = [];

  try {
    // Check all .env* files
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];
    for (const envFile of envFiles) {
      const envPath = path.join(projectRoot, envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        findings.push(...analyzeEnvVars(content, envFile));
      }
    }

    // Check .gitignore
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      findings.push(...analyzeGitignore(gitignoreContent));
    } else {
      findings.push({
        category: 'env_gitignore',
        severity: 'high',
        file: '.gitignore',
        message: 'No .gitignore file found — secrets may be committed',
        suggestion: 'Create .gitignore with .env*.local exclusion',
      });
    }

    return {
      scanner: 'env-scanner',
      findings,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      scanner: 'env-scanner',
      findings,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}
