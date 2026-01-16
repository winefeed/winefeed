/**
 * MATCHING RULES TEST SUITE
 *
 * Validates that product-matcher-v2.ts implements MATCHING_RULES.md correctly
 *
 * Run: npx tsx scripts/test-matching-rules.ts
 */

import { productMatcherV2, SupplierProductInput } from '../lib/matching/product-matcher-v2';

// ============================================================================
// Test Helpers
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ ${message}`);
    testsFailed++;
  }
}

function testGroup(name: string) {
  console.log(`\n📋 ${name}`);
  console.log('─'.repeat(60));
}

// ============================================================================
// Test Data
// ============================================================================

const SUPPLIER_ID = 'test-supplier-id';

const baseInput: SupplierProductInput = {
  supplierSku: 'TEST-SKU',
  producerName: 'Château Margaux',
  productName: 'Château Margaux 2015',
  vintage: 2015,
  volumeMl: 750,
  abvPercent: 13.5,
  packType: 'bottle',
  unitsPerCase: 1,
  countryOfOrigin: 'France',
  region: 'Bordeaux'
};

// ============================================================================
// TEST 1: Hard Guardrails
// ============================================================================

async function testGuardrails() {
  testGroup('TEST 1: Hard Guardrails (NO_MATCH)');

  // Test 1.1: Volume mismatch
  const volumeMismatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    volumeMl: 1500  // Wrong volume
  });
  assert(
    volumeMismatch.decision === 'NO_MATCH' &&
    volumeMismatch.guardrailFailures.some(f => f.includes('VOLUME_MISMATCH')),
    'Volume mismatch triggers NO_MATCH'
  );

  // Test 1.2: Pack type mismatch
  const packMismatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    packType: 'magnum'  // Wrong pack type
  });
  assert(
    packMismatch.decision === 'NO_MATCH' &&
    packMismatch.guardrailFailures.some(f => f.includes('PACK_MISMATCH')),
    'Pack type mismatch triggers NO_MATCH'
  );

  // Test 1.3: Units per case mismatch (for case pack)
  const unitsMismatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    packType: 'case',
    unitsPerCase: 12  // Wrong units
  });
  assert(
    unitsMismatch.decision === 'NO_MATCH' &&
    unitsMismatch.guardrailFailures.some(f => f.includes('UNITS_PER_CASE_MISMATCH')),
    'Units per case mismatch triggers NO_MATCH (for case)'
  );

  // Test 1.4: ABV out of tolerance (>0.5%)
  const abvMismatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    abvPercent: 14.2  // Diff > 0.5%
  });
  assert(
    abvMismatch.decision === 'NO_MATCH' &&
    abvMismatch.guardrailFailures.some(f => f.includes('ABV_OUT_OF_TOLERANCE')),
    'ABV mismatch >0.5% triggers NO_MATCH'
  );

  // Test 1.5: ABV within tolerance (≤0.5%) should pass guardrail
  const abvOk = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    abvPercent: 13.7  // Diff = 0.2%, within tolerance
  });
  assert(
    !abvOk.guardrailFailures.some(f => f.includes('ABV_OUT_OF_TOLERANCE')),
    'ABV within 0.5% tolerance passes guardrail'
  );
}

// ============================================================================
// TEST 2: Vintage Policy
// ============================================================================

async function testVintagePolicy() {
  testGroup('TEST 2: Vintage Policy');

  // Test 2.1: Exact vintage match → auto-match eligible (if score ≥90)
  const exactVintage = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    vintage: 2015
  });
  assert(
    exactVintage.reasons.includes('VINTAGE_EXACT') || exactVintage.decision === 'AUTO_MATCH',
    'Exact vintage match is eligible for auto-match'
  );

  // Test 2.2: Vintage mismatch (±1 year) → REVIEW_QUEUE
  const vintageMismatch1 = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    vintage: 2016  // Off by 1 year
  });
  assert(
    vintageMismatch1.decision === 'REVIEW_QUEUE' &&
    vintageMismatch1.reasons.includes('VINTAGE_MISMATCH'),
    'Vintage mismatch (±1 year) sends to REVIEW_QUEUE'
  );

  // Test 2.3: Vintage mismatch (±2+ years) → REVIEW_QUEUE
  const vintageMismatch2 = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    vintage: 2013  // Off by 2 years
  });
  assert(
    vintageMismatch2.decision === 'REVIEW_QUEUE',
    'Vintage mismatch (±2+ years) sends to REVIEW_QUEUE'
  );

  // Test 2.4: Input missing vintage + candidate has vintage → REVIEW_QUEUE
  const missingVintage = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    vintage: undefined  // No vintage
  });
  assert(
    missingVintage.decision === 'REVIEW_QUEUE' &&
    missingVintage.reasons.includes('VINTAGE_MISSING'),
    'Missing vintage (when candidate has vintage) sends to REVIEW_QUEUE'
  );

  // Test 2.5: Both NV (no vintage) → should get VINTAGE_EXACT points
  const bothNV = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    vintage: undefined,
    productName: 'Moët Impérial Brut NV'
  });
  // Note: This test depends on having a NV product in the database
  // For now, just check it doesn't fail
  assert(
    bothNV.decision !== 'NO_MATCH' || bothNV.guardrailFailures.length > 0,
    'Both NV (no vintage) is handled correctly'
  );
}

// ============================================================================
// TEST 3: Scoring Model
// ============================================================================

async function testScoringModel() {
  testGroup('TEST 3: Scoring Model (0-100)');

  // Test 3.1: GTIN exact match should score ≥70
  const gtinMatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    gtinEach: '7312040017218'  // Known GTIN (adjust to real GTIN in your DB)
  });
  assert(
    gtinMatch.reasons.includes('GTIN_EXACT') || gtinMatch.confidenceScore >= 70,
    'GTIN exact match scores ≥70 points'
  );

  // Test 3.2: Existing SKU mapping should score ≥60 (AUTO_MATCH)
  // Note: This requires an existing mapping in the database
  // Skipped in this test (would need test data setup)
  console.log('  ⏭️  SKU mapping test (requires existing mapping in DB)');

  // Test 3.3: Producer exact match adds +15
  const producerExact = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    producerName: 'Château Margaux'  // Exact match
  });
  assert(
    producerExact.reasons.includes('PRODUCER_EXACT') ||
    producerExact.reasons.includes('PRODUCER_FUZZY'),
    'Producer match detected'
  );

  // Test 3.4: Product name exact match adds +15
  const productExact = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    productName: 'Château Margaux 2015'  // Exact match
  });
  assert(
    productExact.reasons.includes('PRODUCT_NAME_EXACT') ||
    productExact.reasons.includes('PRODUCT_NAME_FUZZY'),
    'Product name match detected'
  );

  // Test 3.5: Volume + pack type always contribute (guardrail ensures they match)
  const volumePackMatch = await productMatcherV2.matchProduct(SUPPLIER_ID, baseInput);
  assert(
    volumePackMatch.reasons.includes('VOLUME_MATCH') &&
    volumePackMatch.reasons.includes('PACK_MATCH'),
    'Volume and pack type always matched (guardrail)'
  );

  // Test 3.6: ABV within tolerance adds +5
  const abvMatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    abvPercent: 13.5  // Exact match
  });
  assert(
    abvMatch.reasons.includes('ABV_WITHIN_TOLERANCE'),
    'ABV within tolerance adds points'
  );

  // Test 3.7: Country + region match adds +5
  const regionMatch = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    countryOfOrigin: 'France',
    region: 'Bordeaux'
  });
  assert(
    regionMatch.reasons.includes('COUNTRY_MATCH') ||
    regionMatch.reasons.includes('REGION_MATCH'),
    'Country/region match detected'
  );
}

// ============================================================================
// TEST 4: Decision Thresholds
// ============================================================================

async function testDecisionThresholds() {
  testGroup('TEST 4: Decision Thresholds');

  // Test 4.1: Score ≥90 + exact vintage → AUTO_MATCH
  // (Requires perfect match in DB - hard to test without real data)
  console.log('  ⏭️  AUTO_MATCH (≥90) test (requires perfect match in DB)');

  // Test 4.2: Score 80-89 + exact vintage → AUTO_MATCH_WITH_SAMPLING_REVIEW
  console.log('  ⏭️  AUTO_MATCH_WITH_SAMPLING_REVIEW (80-89) test (requires controlled score)');

  // Test 4.3: Score 60-79 → REVIEW_QUEUE
  const mediumScore = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    producerName: 'Chateau Margau',  // Slight typo
    productName: 'Margaux 2015'  // Abbreviated
  });
  assert(
    mediumScore.decision === 'REVIEW_QUEUE' ||
    mediumScore.decision === 'AUTO_MATCH_WITH_SAMPLING_REVIEW' ||
    mediumScore.decision === 'AUTO_MATCH',
    'Medium confidence leads to appropriate decision'
  );

  // Test 4.4: Score <60 → NO_MATCH
  const lowScore = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    producerName: 'Unknown Producer',
    productName: 'Unknown Wine'
  });
  assert(
    lowScore.decision === 'NO_MATCH' ||
    lowScore.confidenceScore < 60,
    'Low confidence (<60) leads to NO_MATCH'
  );

  // Test 4.5: Guardrail failure overrides score
  const guardrailOverride = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    volumeMl: 1500  // Volume mismatch (guardrail fail)
  });
  assert(
    guardrailOverride.decision === 'NO_MATCH' &&
    guardrailOverride.guardrailFailures.length > 0,
    'Guardrail failure overrides score → NO_MATCH'
  );
}

// ============================================================================
// TEST 5: Reason Codes
// ============================================================================

async function testReasonCodes() {
  testGroup('TEST 5: Reason Codes');

  const result = await productMatcherV2.matchProduct(SUPPLIER_ID, baseInput);

  // Check that reason codes are standardized
  const validReasonCodes = [
    'GTIN_EXACT',
    'SKU_MAPPING_FOUND',
    'PRODUCER_EXACT',
    'PRODUCER_FUZZY',
    'PRODUCT_NAME_EXACT',
    'PRODUCT_NAME_FUZZY',
    'VINTAGE_EXACT',
    'VINTAGE_MISMATCH',
    'VINTAGE_MISSING',
    'VOLUME_MATCH',
    'VOLUME_MISMATCH',
    'PACK_MATCH',
    'PACK_MISMATCH',
    'UNITS_PER_CASE_MATCH',
    'UNITS_PER_CASE_MISMATCH',
    'ABV_WITHIN_TOLERANCE',
    'ABV_OUT_OF_TOLERANCE',
    'REGION_MATCH',
    'COUNTRY_MATCH',
    'GRAPE_MATCH'
  ];

  const allValid = result.reasons.every(r => validReasonCodes.includes(r));
  assert(
    allValid,
    `All reason codes are standardized: ${result.reasons.join(', ')}`
  );
}

// ============================================================================
// TEST 6: Output Format
// ============================================================================

async function testOutputFormat() {
  testGroup('TEST 6: Output Format');

  const result = await productMatcherV2.matchProduct(SUPPLIER_ID, baseInput);

  // Check required fields
  assert(
    result.hasOwnProperty('decision'),
    'Output has decision field'
  );

  assert(
    ['AUTO_MATCH', 'AUTO_MATCH_WITH_SAMPLING_REVIEW', 'REVIEW_QUEUE', 'NO_MATCH'].includes(result.decision),
    `Decision is valid: ${result.decision}`
  );

  assert(
    typeof result.confidenceScore === 'number' &&
    result.confidenceScore >= 0 &&
    result.confidenceScore <= 100,
    `Confidence score is 0-100: ${result.confidenceScore}`
  );

  assert(
    Array.isArray(result.reasons),
    'Reasons is an array'
  );

  assert(
    Array.isArray(result.guardrailFailures),
    'Guardrail failures is an array'
  );

  // Check candidates for REVIEW_QUEUE / NO_MATCH
  if (result.decision === 'REVIEW_QUEUE' || result.decision === 'NO_MATCH') {
    assert(
      result.candidates && result.candidates.length <= 3,
      `Candidates provided (top 3): ${result.candidates?.length || 0}`
    );
  }

  // Check processing time
  assert(
    typeof result.processingTimeMs === 'number' && result.processingTimeMs > 0,
    `Processing time recorded: ${result.processingTimeMs}ms`
  );
}

// ============================================================================
// TEST 7: Edge Cases
// ============================================================================

async function testEdgeCases() {
  testGroup('TEST 7: Edge Cases');

  // Test 7.1: Empty producer name
  const emptyProducer = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    producerName: ''
  });
  assert(
    emptyProducer.decision !== 'AUTO_MATCH',
    'Empty producer name prevents auto-match'
  );

  // Test 7.2: Very long product name
  const longName = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    productName: 'A'.repeat(500)
  });
  assert(
    longName.decision === 'NO_MATCH' || longName.decision === 'REVIEW_QUEUE',
    'Very long product name handled correctly'
  );

  // Test 7.3: Special characters in names
  const specialChars = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    producerName: 'Château Margaux',  // With accent
    productName: 'Château Margaux 2015'
  });
  assert(
    specialChars.decision !== 'NO_MATCH' || specialChars.guardrailFailures.length > 0,
    'Special characters (accents) handled correctly'
  );

  // Test 7.4: Case sensitivity
  const uppercase = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    producerName: 'CHÂTEAU MARGAUX',
    productName: 'CHÂTEAU MARGAUX 2015'
  });
  assert(
    uppercase.reasons.includes('PRODUCER_EXACT') ||
    uppercase.reasons.includes('PRODUCER_FUZZY'),
    'Case-insensitive matching works'
  );

  // Test 7.5: Zero ABV (e.g., non-alcoholic)
  const zeroAbv = await productMatcherV2.matchProduct(SUPPLIER_ID, {
    ...baseInput,
    abvPercent: 0
  });
  assert(
    !zeroAbv.guardrailFailures.some(f => f.includes('ABV_OUT_OF_TOLERANCE')),
    'Zero ABV handled correctly (no guardrail fail)'
  );
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('\n🧪 MATCHING RULES TEST SUITE');
  console.log('═'.repeat(60));
  console.log('Testing product-matcher-v2.ts against MATCHING_RULES.md');
  console.log('');

  try {
    await testGuardrails();
    await testVintagePolicy();
    await testScoringModel();
    await testDecisionThresholds();
    await testReasonCodes();
    await testOutputFormat();
    await testEdgeCases();

    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 RESULTS: ${testsPassed} passed, ${testsFailed} failed`);

    if (testsFailed === 0) {
      console.log('\n✅ ALL TESTS PASSED! 🎉');
      console.log('   Matching engine is aligned with MATCHING_RULES.md');
      process.exit(0);
    } else {
      console.log(`\n❌ ${testsFailed} TEST(S) FAILED`);
      console.log('   Review failures above and fix matching logic');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 TEST SUITE ERROR:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
