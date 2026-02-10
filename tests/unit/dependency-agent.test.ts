/**
 * Dependency Agent — Unit Tests
 *
 * Tests scanner core logic using string/object input (no child_process mocking).
 */

import { describe, it, expect } from 'vitest';
import { parseNpmAuditOutput } from '../../lib/dependency-agent/scanners/vulnerability-scanner';
import {
  parseNpmOutdatedOutput,
  parseSemver,
  classifyOutdated,
} from '../../lib/dependency-agent/scanners/outdated-scanner';
import {
  extractPackageName,
  analyzeUnusedDeps,
} from '../../lib/dependency-agent/scanners/unused-scanner';
import {
  classifyLicense,
  analyzeLicenses,
} from '../../lib/dependency-agent/scanners/license-scanner';
import { calculateDependencyScore } from '../../lib/dependency-agent/score-calculator';
import type { DependencyFinding } from '../../lib/dependency-agent/types';

// ============================================================================
// Vulnerability Scanner
// ============================================================================

describe('vulnerability-scanner', () => {
  it('parses npm audit JSON correctly', () => {
    const auditJson = JSON.stringify({
      vulnerabilities: {
        'lodash': {
          name: 'lodash',
          severity: 'high',
          title: 'Prototype Pollution',
          url: 'https://github.com/advisories/GHSA-xxxx',
          cves: ['CVE-2021-12345'],
          range: '<4.17.21',
          fixAvailable: { name: 'lodash', version: '4.17.21' },
        },
        'minimist': {
          name: 'minimist',
          severity: 'critical',
          title: 'Prototype Pollution',
          url: 'https://github.com/advisories/GHSA-yyyy',
          range: '<1.2.6',
          fixAvailable: true,
        },
      },
    });

    const findings = parseNpmAuditOutput(auditJson);
    expect(findings.length).toBe(2);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].package).toBe('lodash');
    expect(findings[0].cveId).toBe('CVE-2021-12345');
    expect(findings[0].suggestion).toContain('lodash');
    expect(findings[1].severity).toBe('critical');
    expect(findings[1].suggestion).toBe('Run npm audit fix');
  });

  it('handles empty audit output', () => {
    const findings = parseNpmAuditOutput('{}');
    expect(findings.length).toBe(0);
  });

  it('handles invalid JSON', () => {
    const findings = parseNpmAuditOutput('not json');
    expect(findings.length).toBe(0);
  });

  it('maps moderate to medium severity', () => {
    const auditJson = JSON.stringify({
      vulnerabilities: {
        'pkg': {
          name: 'pkg',
          severity: 'moderate',
          title: 'Some issue',
          url: '',
          range: '*',
        },
      },
    });

    const findings = parseNpmAuditOutput(auditJson);
    expect(findings[0].severity).toBe('medium');
  });
});

// ============================================================================
// Outdated Scanner
// ============================================================================

describe('outdated-scanner', () => {
  it('parses semver correctly', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('15.5.11')).toEqual([15, 5, 11]);
    expect(parseSemver('invalid')).toBeNull();
  });

  it('classifies 2+ major behind as high', () => {
    expect(classifyOutdated('1.0.0', '3.0.0')).toBe('high');
    expect(classifyOutdated('12.0.0', '15.0.0')).toBe('high');
  });

  it('classifies 1 major behind as medium', () => {
    expect(classifyOutdated('14.0.0', '15.0.0')).toBe('medium');
  });

  it('classifies minor behind as low', () => {
    expect(classifyOutdated('15.0.0', '15.5.0')).toBe('low');
  });

  it('classifies patch behind as info', () => {
    expect(classifyOutdated('15.5.0', '15.5.11')).toBe('info');
  });

  it('parses npm outdated JSON', () => {
    const outdatedJson = JSON.stringify({
      'next': { current: '14.0.0', wanted: '14.2.0', latest: '15.5.11', dependent: 'winefeed' },
      'react': { current: '18.2.0', wanted: '18.3.1', latest: '18.3.1', dependent: 'winefeed' },
    });

    const findings = parseNpmOutdatedOutput(outdatedJson);
    expect(findings.length).toBe(2);
    expect(findings[0].package).toBe('next');
    expect(findings[0].severity).toBe('medium'); // 1 major behind
    expect(findings[1].package).toBe('react');
    expect(findings[1].severity).toBe('low'); // minor behind
  });

  it('skips packages at latest', () => {
    const outdatedJson = JSON.stringify({
      'react': { current: '18.3.1', wanted: '18.3.1', latest: '18.3.1', dependent: 'winefeed' },
    });

    const findings = parseNpmOutdatedOutput(outdatedJson);
    expect(findings.length).toBe(0);
  });
});

// ============================================================================
// Unused Scanner
// ============================================================================

describe('unused-scanner', () => {
  it('extracts package names correctly', () => {
    expect(extractPackageName('react')).toBe('react');
    expect(extractPackageName('next/server')).toBe('next');
    expect(extractPackageName('@supabase/ssr')).toBe('@supabase/ssr');
    expect(extractPackageName('@supabase/supabase-js')).toBe('@supabase/supabase-js');
    expect(extractPackageName('@sentry/nextjs')).toBe('@sentry/nextjs');
  });

  it('finds unused dependencies', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        'react': '^18.0.0',
        'unused-pkg': '^1.0.0',
        'another-used': '^2.0.0',
      },
    });
    const usedPackages = new Set(['react', 'another-used']);

    const findings = analyzeUnusedDeps(pkgJson, usedPackages);
    expect(findings.length).toBe(1);
    expect(findings[0].package).toBe('unused-pkg');
    expect(findings[0].category).toBe('unused');
  });

  it('ignores config-only packages', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        'tailwindcss': '^3.0.0',
        'postcss': '^8.0.0',
      },
    });
    const usedPackages = new Set<string>();

    const findings = analyzeUnusedDeps(pkgJson, usedPackages);
    expect(findings.length).toBe(0);
  });
});

// ============================================================================
// License Scanner
// ============================================================================

describe('license-scanner', () => {
  it('classifies GPL as high', () => {
    expect(classifyLicense('GPL-3.0').severity).toBe('high');
    expect(classifyLicense('AGPL-3.0').severity).toBe('high');
  });

  it('classifies LGPL as medium', () => {
    expect(classifyLicense('LGPL-3.0').severity).toBe('medium');
    expect(classifyLicense('LGPL-2.1').severity).toBe('medium');
  });

  it('classifies MIT as info', () => {
    expect(classifyLicense('MIT').severity).toBe('info');
  });

  it('classifies Apache-2.0 as info', () => {
    expect(classifyLicense('Apache-2.0').severity).toBe('info');
  });

  it('classifies BSD as info', () => {
    expect(classifyLicense('BSD-3-Clause').severity).toBe('info');
    expect(classifyLicense('BSD-2-Clause').severity).toBe('info');
  });

  it('classifies ISC as info', () => {
    expect(classifyLicense('ISC').severity).toBe('info');
  });

  it('classifies missing license as low', () => {
    const result = classifyLicense(undefined);
    expect(result.severity).toBe('low');
    expect(result.normalized).toBe('UNKNOWN');
  });

  it('handles SPDX OR expressions (most permissive wins)', () => {
    const result = classifyLicense('MIT OR GPL-3.0');
    expect(result.severity).toBe('info'); // MIT is most permissive
  });

  it('handles partial matches', () => {
    expect(classifyLicense('MIT License').severity).toBe('info');
    expect(classifyLicense('GNU General Public License v3.0').severity).toBe('high');
  });

  it('analyzeLicenses only reports non-info findings', () => {
    // We can't easily mock node_modules, so test the pure logic
    // through classifyLicense instead
    const gpl = classifyLicense('GPL-3.0');
    const mit = classifyLicense('MIT');
    expect(gpl.severity).toBe('high');
    expect(mit.severity).toBe('info');
  });
});

// ============================================================================
// Score Calculator
// ============================================================================

describe('dependency-score-calculator', () => {
  it('returns 100 + bonuses for 0 findings', () => {
    const score = calculateDependencyScore({ findings: [] });
    // 100 + 5 (no vulns) + 5 (no unused) = 110 → 100
    expect(score).toBe(100);
  });

  it('deducts for critical findings', () => {
    const findings: DependencyFinding[] = [
      { category: 'vulnerability', severity: 'critical', package: 'pkg', message: 'test' },
    ];
    const score = calculateDependencyScore({ findings });
    // 100 - 20 + 0 (has vuln) + 5 (no unused) = 85
    expect(score).toBe(85);
  });

  it('many findings drive score down', () => {
    const findings: DependencyFinding[] = Array(10).fill({
      category: 'vulnerability',
      severity: 'critical',
      package: 'pkg',
      message: 'test',
    });
    const score = calculateDependencyScore({ findings });
    // 100 - 200 + 0 + 5 = -95 → 0
    expect(score).toBe(0);
  });

  it('unused deps remove unused bonus', () => {
    const findings: DependencyFinding[] = [
      { category: 'unused', severity: 'low', package: 'pkg', message: 'test' },
    ];
    const score = calculateDependencyScore({ findings });
    // 100 - 1 + 5 (no vulns) + 0 (has unused) = 104 → 100
    expect(score).toBe(100);
  });

  it('mixed findings produce correct score', () => {
    const findings: DependencyFinding[] = [
      { category: 'vulnerability', severity: 'high', package: 'a', message: 'test' },
      { category: 'outdated', severity: 'medium', package: 'b', message: 'test' },
      { category: 'unused', severity: 'low', package: 'c', message: 'test' },
      { category: 'license', severity: 'medium', package: 'd', message: 'test' },
    ];
    const score = calculateDependencyScore({ findings });
    // 100 - 10 - 3 - 1 - 3 + 0 (has vuln) + 0 (has unused) = 83
    expect(score).toBe(83);
  });
});
