/**
 * SMOKE TEST: Real Supplier Data
 *
 * Tests matching engine with real supplier price lists
 *
 * Usage:
 *   npx tsx scripts/smoke-realdata.ts ./data/suppliers/supplier-a/price-list.csv
 *
 * Gate: No "wrong bottle" matches (guardrails prevent volume/pack/vintage mistakes)
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { productMatcherV2, SupplierProductInput } from '../lib/matching/product-matcher-v2';

// ============================================================================
// Types
// ============================================================================

interface SmokeTestResult {
  lineNumber: number;
  supplierSku: string;
  decision: string;
  confidenceScore: number;
  reasons: string[];
  guardrailFailures: string[];
  candidates?: any[];
  processingTimeMs: number;
}

interface SmokeTestSummary {
  totalLines: number;
  autoMatched: number;
  samplingReview: number;
  reviewQueue: number;
  noMatch: number;
  errors: number;

  // Percentages
  autoMatchedPercent: number;
  samplingReviewPercent: number;
  reviewQueuePercent: number;
  noMatchPercent: number;

  // Analytics
  topReasonCodes: { code: string; count: number }[];
  topGuardrailFailures: { reason: string; count: number }[];

  // Safety checks
  wrongBottleMatches: number;
  volumeMismatches: number;
  packMismatches: number;
  vintageMismatches: number;

  // Performance
  avgProcessingTimeMs: number;
  totalProcessingTimeMs: number;
}

// ============================================================================
// CSV Parser
// ============================================================================

function parseSupplierCSV(filePath: string): SupplierProductInput[] {
  const csvContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any, index: number) => {
    try {
      return {
        supplierSku: row.supplier_sku || `LINE_${index + 1}`,
        gtinEach: row.gtin_each || undefined,
        gtinCase: row.gtin_case || undefined,
        producerName: row.producer_name,
        productName: row.product_name,
        vintage: row.vintage ? parseInt(row.vintage, 10) : undefined,
        volumeMl: parseInt(row.volume_ml, 10),
        abvPercent: row.abv_percent ? parseFloat(row.abv_percent) : undefined,
        packType: row.pack_type as any,
        unitsPerCase: row.units_per_case ? parseInt(row.units_per_case, 10) : undefined,
        countryOfOrigin: row.country_of_origin || undefined,
        region: row.region || undefined,
        grapeVariety: row.grape_variety || undefined
      };
    } catch (error) {
      throw new Error(`Failed to parse line ${index + 1}: ${error}`);
    }
  });
}

// ============================================================================
// Smoke Test Runner
// ============================================================================

async function runSmokeTest(csvFilePath: string, supplierId: string): Promise<void> {
  console.log('\n🔬 SMOKE TEST: Real Supplier Data');
  console.log('═'.repeat(70));
  console.log(`File: ${csvFilePath}`);
  console.log(`Supplier ID: ${supplierId}`);
  console.log('');

  // Parse CSV
  console.log('📂 Parsing CSV...');
  let inputs: SupplierProductInput[];
  try {
    inputs = parseSupplierCSV(csvFilePath);
    console.log(`✅ Parsed ${inputs.length} lines`);
  } catch (error) {
    console.error(`❌ Failed to parse CSV: ${error}`);
    process.exit(1);
  }

  // Run matching on all lines
  console.log('\n🔍 Running matching engine...');
  const results: SmokeTestResult[] = [];
  let processed = 0;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    try {
      const matchResult = await productMatcherV2.matchProduct(supplierId, input);

      results.push({
        lineNumber: i + 1,
        supplierSku: input.supplierSku,
        decision: matchResult.decision,
        confidenceScore: matchResult.confidenceScore,
        reasons: matchResult.reasons,
        guardrailFailures: matchResult.guardrailFailures,
        candidates: matchResult.candidates,
        processingTimeMs: matchResult.processingTimeMs || 0
      });

      processed++;

      if (processed % 10 === 0) {
        process.stdout.write(`\r  Progress: ${processed}/${inputs.length}`);
      }
    } catch (error) {
      console.error(`\n❌ Error processing line ${i + 1}: ${error}`);
      results.push({
        lineNumber: i + 1,
        supplierSku: input.supplierSku,
        decision: 'ERROR',
        confidenceScore: 0,
        reasons: [],
        guardrailFailures: [`ERROR: ${error}`],
        processingTimeMs: 0
      });
    }
  }

  console.log(`\r  Progress: ${processed}/${inputs.length} ✅`);

  // Analyze results
  console.log('\n📊 Analyzing results...');
  const summary = analyzeSmokeTestResults(results);

  // Display summary
  displaySummary(summary);

  // Safety gate: Check for wrong bottle matches
  if (summary.wrongBottleMatches > 0) {
    console.log('\n❌ GATE FAILURE: Wrong bottle matches detected!');
    console.log(`   ${summary.wrongBottleMatches} matches have guardrail violations`);
    console.log('   Review guardrail logic before deploying to production');
    process.exit(1);
  }

  // Write results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const supplierName = path.basename(path.dirname(csvFilePath));
  const outputFile = `./tmp/smoke_${supplierName}_${timestamp}.json`;

  fs.mkdirSync('./tmp', { recursive: true });
  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        metadata: {
          csvFile: csvFilePath,
          supplierId,
          timestamp: new Date().toISOString(),
          totalLines: inputs.length
        },
        summary,
        results
      },
      null,
      2
    )
  );

  console.log(`\n💾 Results saved to: ${outputFile}`);
  console.log('\n✅ SMOKE TEST PASSED! 🎉');
  console.log('   No wrong bottle matches detected');
  console.log('   Safe to proceed to production');
}

// ============================================================================
// Analysis
// ============================================================================

function analyzeSmokeTestResults(results: SmokeTestResult[]): SmokeTestSummary {
  const totalLines = results.length;

  // Count decisions
  const autoMatched = results.filter(r => r.decision === 'AUTO_MATCH').length;
  const samplingReview = results.filter(r => r.decision === 'AUTO_MATCH_WITH_SAMPLING_REVIEW').length;
  const reviewQueue = results.filter(r => r.decision === 'REVIEW_QUEUE').length;
  const noMatch = results.filter(r => r.decision === 'NO_MATCH').length;
  const errors = results.filter(r => r.decision === 'ERROR').length;

  // Count reason codes
  const reasonCodeCounts: Record<string, number> = {};
  results.forEach(r => {
    r.reasons.forEach(reason => {
      reasonCodeCounts[reason] = (reasonCodeCounts[reason] || 0) + 1;
    });
  });

  const topReasonCodes = Object.entries(reasonCodeCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Count guardrail failures
  const guardrailCounts: Record<string, number> = {};
  results.forEach(r => {
    r.guardrailFailures.forEach(failure => {
      const reason = failure.split(':')[0];  // Extract failure type
      guardrailCounts[reason] = (guardrailCounts[reason] || 0) + 1;
    });
  });

  const topGuardrailFailures = Object.entries(guardrailCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Safety checks (wrong bottle detection)
  const volumeMismatches = results.filter(r =>
    r.guardrailFailures.some(f => f.includes('VOLUME_MISMATCH'))
  ).length;

  const packMismatches = results.filter(r =>
    r.guardrailFailures.some(f => f.includes('PACK_MISMATCH'))
  ).length;

  const vintageMismatches = results.filter(r =>
    r.reasons.includes('VINTAGE_MISMATCH') &&
    (r.decision === 'AUTO_MATCH' || r.decision === 'AUTO_MATCH_WITH_SAMPLING_REVIEW')
  ).length;

  const wrongBottleMatches = vintageMismatches;  // Auto-matched with vintage mismatch = wrong bottle

  // Performance
  const totalProcessingTimeMs = results.reduce((sum, r) => sum + r.processingTimeMs, 0);
  const avgProcessingTimeMs = totalProcessingTimeMs / totalLines;

  return {
    totalLines,
    autoMatched,
    samplingReview,
    reviewQueue,
    noMatch,
    errors,

    autoMatchedPercent: (autoMatched / totalLines) * 100,
    samplingReviewPercent: (samplingReview / totalLines) * 100,
    reviewQueuePercent: (reviewQueue / totalLines) * 100,
    noMatchPercent: (noMatch / totalLines) * 100,

    topReasonCodes,
    topGuardrailFailures,

    wrongBottleMatches,
    volumeMismatches,
    packMismatches,
    vintageMismatches,

    avgProcessingTimeMs,
    totalProcessingTimeMs
  };
}

// ============================================================================
// Display
// ============================================================================

function displaySummary(summary: SmokeTestSummary): void {
  console.log('\n═'.repeat(70));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n🎯 Decision Distribution:');
  console.log(`  AUTO_MATCH:         ${summary.autoMatched.toString().padStart(4)} (${summary.autoMatchedPercent.toFixed(1)}%)`);
  console.log(`  SAMPLING_REVIEW:    ${summary.samplingReview.toString().padStart(4)} (${summary.samplingReviewPercent.toFixed(1)}%)`);
  console.log(`  REVIEW_QUEUE:       ${summary.reviewQueue.toString().padStart(4)} (${summary.reviewQueuePercent.toFixed(1)}%)`);
  console.log(`  NO_MATCH:           ${summary.noMatch.toString().padStart(4)} (${summary.noMatchPercent.toFixed(1)}%)`);
  console.log(`  ERRORS:             ${summary.errors.toString().padStart(4)}`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  TOTAL:              ${summary.totalLines.toString().padStart(4)}`);

  console.log('\n🏆 Top 10 Reason Codes:');
  summary.topReasonCodes.forEach((item, index) => {
    console.log(`  ${(index + 1).toString().padStart(2)}. ${item.code.padEnd(25)} ${item.count.toString().padStart(4)}x`);
  });

  if (summary.topGuardrailFailures.length > 0) {
    console.log('\n⚠️  Top 10 Guardrail Failures:');
    summary.topGuardrailFailures.forEach((item, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${item.reason.padEnd(25)} ${item.count.toString().padStart(4)}x`);
    });
  }

  console.log('\n🛡️  Safety Checks:');
  console.log(`  Wrong bottle matches:    ${summary.wrongBottleMatches === 0 ? '✅' : '❌'} ${summary.wrongBottleMatches}`);
  console.log(`  Volume mismatches:       ${summary.volumeMismatches === 0 ? '✅' : '⚠️ '} ${summary.volumeMismatches}`);
  console.log(`  Pack mismatches:         ${summary.packMismatches === 0 ? '✅' : '⚠️ '} ${summary.packMismatches}`);
  console.log(`  Vintage mismatches:      ${summary.vintageMismatches === 0 ? '✅' : '⚠️ '} ${summary.vintageMismatches}`);

  console.log('\n⚡ Performance:');
  console.log(`  Avg processing time:     ${summary.avgProcessingTimeMs.toFixed(1)}ms per line`);
  console.log(`  Total processing time:   ${(summary.totalProcessingTimeMs / 1000).toFixed(1)}s`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const csvFilePath = process.argv[2];
  const supplierId = process.argv[3] || 'test-supplier-id';

  if (!csvFilePath) {
    console.error('Usage: npx tsx scripts/smoke-realdata.ts <csv-file> [supplier-id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx scripts/smoke-realdata.ts ./data/suppliers/supplier-a/price-list.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ File not found: ${csvFilePath}`);
    process.exit(1);
  }

  await runSmokeTest(csvFilePath, supplierId);
}

main().catch(error => {
  console.error('\n💥 SMOKE TEST FAILED:', error);
  process.exit(1);
});
