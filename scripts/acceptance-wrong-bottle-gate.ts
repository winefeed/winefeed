/**
 * WRONG-BOTTLE SAFETY GATE
 *
 * Hard-fails if ANY auto-match violates guardrails (wrong bottle risk)
 *
 * Checks:
 * - Volume mismatch
 * - Pack mismatch
 * - Units per case mismatch (when pack_type=case)
 * - Vintage mismatch (auto-match requires exact)
 * - ABV mismatch >0.5% (when present on both)
 *
 * Also flags RISK scenarios (warnings, not failures):
 * - Missing vintage matched to vintage-specific product
 * - Fuzzy match ≥90 without GTIN/SKU mapping
 *
 * Usage:
 *   npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>
 *   npx tsx scripts/acceptance-wrong-bottle-gate.ts --all  (check all imports)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// Types
// ============================================================================

interface GuardrailViolation {
  lineNumber: number;
  supplierSku: string;
  violationType: string;
  inputValue: any;
  candidateValue: any;
  matchStatus: string;
  confidenceScore: number;
  reasons: string[];
}

interface RiskFlag {
  lineNumber: number;
  supplierSku: string;
  riskType: string;
  description: string;
  confidenceScore: number;
}

interface SafetyGateResult {
  importId: string;
  totalLines: number;
  autoMatchedLines: number;

  // Hard failures (MUST be 0)
  volumeViolations: GuardrailViolation[];
  packViolations: GuardrailViolation[];
  unitsPerCaseViolations: GuardrailViolation[];
  vintageViolations: GuardrailViolation[];
  abvViolations: GuardrailViolation[];

  // Risk flags (warnings)
  riskFlags: RiskFlag[];

  // Pass/fail
  passed: boolean;
  violations: number;
}

// ============================================================================
// Safety Gate Logic
// ============================================================================

async function checkImportSafetyGate(importId: string): Promise<SafetyGateResult> {
  // Fetch import lines with matching results
  const { data: lines, error } = await supabase
    .from('supplier_import_lines')
    .select(`
      *,
      matched_product:master_products(
        id,
        vintage,
        volume_ml,
        pack_type,
        units_per_case,
        abv_percent
      )
    `)
    .eq('import_id', importId);

  if (error || !lines) {
    throw new Error(`Failed to fetch import lines: ${error?.message}`);
  }

  const result: SafetyGateResult = {
    importId,
    totalLines: lines.length,
    autoMatchedLines: lines.filter(l =>
      l.match_status === 'AUTO_MATCHED' || l.match_status === 'SAMPLING_REVIEW'
    ).length,
    volumeViolations: [],
    packViolations: [],
    unitsPerCaseViolations: [],
    vintageViolations: [],
    abvViolations: [],
    riskFlags: [],
    passed: true,
    violations: 0
  };

  // Check each AUTO_MATCHED or SAMPLING_REVIEW line
  for (const line of lines) {
    if (line.match_status !== 'AUTO_MATCHED' && line.match_status !== 'SAMPLING_REVIEW') {
      continue;
    }

    const candidate = line.matched_product;
    if (!candidate) {
      // Auto-matched but no product linked? Risk flag
      result.riskFlags.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        riskType: 'MISSING_PRODUCT_LINK',
        description: 'Auto-matched line has no matched_product_id',
        confidenceScore: line.confidence_score
      });
      continue;
    }

    // GUARDRAIL 1: Volume mismatch
    if (line.volume_ml !== candidate.volume_ml) {
      result.volumeViolations.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        violationType: 'VOLUME_MISMATCH',
        inputValue: line.volume_ml,
        candidateValue: candidate.volume_ml,
        matchStatus: line.match_status,
        confidenceScore: line.confidence_score,
        reasons: line.match_reasons || []
      });
      result.violations++;
    }

    // GUARDRAIL 2: Pack mismatch
    if (line.pack_type !== candidate.pack_type) {
      result.packViolations.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        violationType: 'PACK_MISMATCH',
        inputValue: line.pack_type,
        candidateValue: candidate.pack_type,
        matchStatus: line.match_status,
        confidenceScore: line.confidence_score,
        reasons: line.match_reasons || []
      });
      result.violations++;
    }

    // GUARDRAIL 3: Units per case mismatch (for case pack types)
    if (
      line.pack_type === 'case' &&
      line.units_per_case &&
      candidate.units_per_case &&
      line.units_per_case !== candidate.units_per_case
    ) {
      result.unitsPerCaseViolations.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        violationType: 'UNITS_PER_CASE_MISMATCH',
        inputValue: line.units_per_case,
        candidateValue: candidate.units_per_case,
        matchStatus: line.match_status,
        confidenceScore: line.confidence_score,
        reasons: line.match_reasons || []
      });
      result.violations++;
    }

    // GUARDRAIL 4: Vintage mismatch (auto-match requires exact)
    if (line.vintage && candidate.vintage && line.vintage !== candidate.vintage) {
      result.vintageViolations.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        violationType: 'VINTAGE_MISMATCH',
        inputValue: line.vintage,
        candidateValue: candidate.vintage,
        matchStatus: line.match_status,
        confidenceScore: line.confidence_score,
        reasons: line.match_reasons || []
      });
      result.violations++;
    }

    // GUARDRAIL 5: ABV mismatch >0.5%
    if (
      line.abv_percent &&
      candidate.abv_percent &&
      Math.abs(line.abv_percent - candidate.abv_percent) > 0.5
    ) {
      result.abvViolations.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        violationType: 'ABV_OUT_OF_TOLERANCE',
        inputValue: line.abv_percent,
        candidateValue: candidate.abv_percent,
        matchStatus: line.match_status,
        confidenceScore: line.confidence_score,
        reasons: line.match_reasons || []
      });
      result.violations++;
    }

    // RISK FLAG 1: Missing vintage → vintage-specific product
    if (!line.vintage && candidate.vintage) {
      result.riskFlags.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        riskType: 'MISSING_VINTAGE_TO_SPECIFIC',
        description: `Missing vintage matched to ${candidate.vintage} (should use family)`,
        confidenceScore: line.confidence_score
      });
    }

    // RISK FLAG 2: Fuzzy match ≥90 without GTIN/SKU
    if (
      line.confidence_score >= 90 &&
      !line.match_reasons?.includes('GTIN_EXACT') &&
      !line.match_reasons?.includes('SKU_MAPPING_EXISTS')
    ) {
      result.riskFlags.push({
        lineNumber: line.line_number,
        supplierSku: line.supplier_sku,
        riskType: 'FUZZY_HIGH_CONFIDENCE',
        description: 'Fuzzy match ≥90 without GTIN or existing SKU mapping (rare)',
        confidenceScore: line.confidence_score
      });
    }
  }

  result.passed = result.violations === 0;

  return result;
}

// ============================================================================
// Display
// ============================================================================

function displaySafetyGateResult(result: SafetyGateResult): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log('🛡️  WRONG-BOTTLE SAFETY GATE');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Import ID: ${result.importId}`);
  console.log(`Total Lines: ${result.totalLines}`);
  console.log(`Auto-Matched Lines: ${result.autoMatchedLines}`);
  console.log('');

  // Hard failures
  console.log('GUARDRAIL VIOLATIONS (MUST BE 0):');
  console.log('─'.repeat(70));

  displayViolations('Volume mismatches', result.volumeViolations);
  displayViolations('Pack mismatches', result.packViolations);
  displayViolations('Units per case mismatches', result.unitsPerCaseViolations);
  displayViolations('Vintage mismatches in AUTO_MATCH', result.vintageViolations);
  displayViolations('ABV mismatches >0.5%', result.abvViolations);

  console.log('');

  // Risk flags
  if (result.riskFlags.length > 0) {
    console.log('⚠️  RISK FLAGS (warnings, not failures):');
    console.log('─'.repeat(70));
    result.riskFlags.forEach((flag, index) => {
      console.log(`${index + 1}. Line ${flag.lineNumber} (${flag.supplierSku})`);
      console.log(`   Type: ${flag.riskType}`);
      console.log(`   Description: ${flag.description}`);
      console.log(`   Confidence: ${flag.confidenceScore}`);
      console.log('');
    });
  } else {
    console.log('⚠️  RISK FLAGS: 0');
  }

  console.log('');
  console.log('═'.repeat(70));

  if (result.passed) {
    console.log('✅ SAFETY GATE PASSED - No wrong-bottle matches detected');
    console.log('═'.repeat(70));
    console.log('');
    console.log('🎉 This import is SAFE for production');
  } else {
    console.log('❌ SAFETY GATE FAILED');
    console.log('═'.repeat(70));
    console.log('');
    console.log(`💥 ${result.violations} GUARDRAIL VIOLATIONS DETECTED`);
    console.log('');
    console.log('🚨 DO NOT DEPLOY TO PRODUCTION');
    console.log('   Review matching logic and fix guardrails before proceeding');
  }

  console.log('');
}

function displayViolations(title: string, violations: GuardrailViolation[]): void {
  const status = violations.length === 0 ? '✅' : '❌';
  console.log(`${status} ${title}: ${violations.length}`);

  if (violations.length > 0) {
    violations.forEach((v, index) => {
      console.log('');
      console.log(`  Violation ${index + 1}:`);
      console.log(`    Line: ${v.lineNumber}`);
      console.log(`    SKU: ${v.supplierSku}`);
      console.log(`    Status: ${v.matchStatus}`);
      console.log(`    Confidence: ${v.confidenceScore}`);
      console.log(`    Input value: ${v.inputValue}`);
      console.log(`    Candidate value: ${v.candidateValue}`);
      console.log(`    Reasons: ${v.reasons.join(', ')}`);
    });
    console.log('');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>');
    console.error('       npx tsx scripts/acceptance-wrong-bottle-gate.ts --all');
    process.exit(1);
  }

  const importId = args[0];

  if (importId === '--all') {
    // Check all imports
    console.log('Checking all imports...');

    const { data: imports, error } = await supabase
      .from('supplier_imports')
      .select('id, status, created_at')
      .eq('status', 'MATCHED')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !imports || imports.length === 0) {
      console.error('No matched imports found');
      process.exit(1);
    }

    console.log(`Found ${imports.length} imports to check`);
    console.log('');

    let totalViolations = 0;

    for (const importRecord of imports) {
      const result = await checkImportSafetyGate(importRecord.id);
      console.log(`Import ${importRecord.id}: ${result.violations} violations`);
      totalViolations += result.violations;
    }

    console.log('');
    console.log('═'.repeat(70));
    if (totalViolations === 0) {
      console.log('✅ ALL IMPORTS PASSED - No violations detected');
    } else {
      console.log(`❌ FAILURES DETECTED - ${totalViolations} total violations`);
      process.exit(1);
    }
  } else {
    // Check single import
    const result = await checkImportSafetyGate(importId);
    displaySafetyGateResult(result);

    if (!result.passed) {
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
