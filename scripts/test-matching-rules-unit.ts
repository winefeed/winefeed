/**
 * MATCHING RULES UNIT TEST SUITE (No Database Required)
 *
 * Tests the matching logic without database dependencies using mocks
 *
 * Run: npx tsx scripts/test-matching-rules-unit.ts
 */

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
// Mock Matching Logic (Pure Functions)
// ============================================================================

type GuardrailResult = {
  pass: boolean;
  failures: string[];
};

type MatchDecision = 'AUTO_MATCH' | 'AUTO_MATCH_WITH_SAMPLING_REVIEW' | 'REVIEW_QUEUE' | 'NO_MATCH';

function checkGuardrails(
  inputVolume: number,
  candidateVolume: number,
  inputPack: string,
  candidatePack: string,
  inputUnits: number | undefined,
  candidateUnits: number,
  inputAbv: number | undefined,
  candidateAbv: number | undefined
): GuardrailResult {
  const failures: string[] = [];

  // Volume mismatch
  if (inputVolume !== candidateVolume) {
    failures.push(`VOLUME_MISMATCH: ${inputVolume} ≠ ${candidateVolume}`);
  }

  // Pack type mismatch
  if (inputPack !== candidatePack) {
    failures.push(`PACK_MISMATCH: ${inputPack} ≠ ${candidatePack}`);
  }

  // Units per case (if case)
  if (inputPack === 'case' && inputUnits && inputUnits !== candidateUnits) {
    failures.push(`UNITS_MISMATCH: ${inputUnits} ≠ ${candidateUnits}`);
  }

  // ABV tolerance
  if (inputAbv !== undefined && candidateAbv !== undefined) {
    const abvDiff = Math.abs(inputAbv - candidateAbv);
    if (abvDiff > 0.5) {
      failures.push(`ABV_OUT_OF_TOLERANCE: ${inputAbv} vs ${candidateAbv} (diff ${abvDiff.toFixed(1)}%)`);
    }
  }

  return {
    pass: failures.length === 0,
    failures
  };
}

function checkVintagePolicy(
  inputVintage: number | undefined,
  candidateVintage: number | undefined
): { pass: boolean; reason?: string } {
  // Both missing → OK
  if (!inputVintage && !candidateVintage) {
    return { pass: true };
  }

  // Input missing, candidate has vintage → REVIEW_QUEUE
  if (!inputVintage && candidateVintage) {
    return { pass: false, reason: 'VINTAGE_MISSING' };
  }

  // Input has vintage, candidate missing → REVIEW_QUEUE
  if (inputVintage && !candidateVintage) {
    return { pass: false, reason: 'VINTAGE_MISSING' };
  }

  // Both have vintage → must match exactly
  if (inputVintage !== candidateVintage) {
    return { pass: false, reason: 'VINTAGE_MISMATCH' };
  }

  return { pass: true };
}

function calculateScore(signals: {
  gtinMatch?: boolean;
  skuMapping?: boolean;
  producerExact?: boolean;
  producerFuzzy?: boolean;
  productExact?: boolean;
  productFuzzy?: boolean;
  vintageExact?: boolean;
  volumeMatch?: boolean;
  abvWithinTolerance?: boolean;
  countryMatch?: boolean;
  regionMatch?: boolean;
  grapeMatch?: boolean;
}): number {
  let score = 0;

  if (signals.gtinMatch) score += 70;
  if (signals.skuMapping) score += 60;
  if (signals.producerExact) score += 15;
  else if (signals.producerFuzzy) score += 10;
  if (signals.productExact) score += 15;
  else if (signals.productFuzzy) score += 10;
  if (signals.vintageExact) score += 10;
  if (signals.volumeMatch) score += 10;
  if (signals.abvWithinTolerance) score += 5;
  if (signals.countryMatch) score += 3;
  if (signals.regionMatch) score += 2;
  if (signals.grapeMatch) score += 3;

  return Math.min(score, 100);
}

function getDecision(
  score: number,
  guardrailPass: boolean,
  vintagePass: boolean
): MatchDecision {
  if (!guardrailPass) return 'NO_MATCH';
  if (!vintagePass) return 'REVIEW_QUEUE';

  if (score >= 90) return 'AUTO_MATCH';
  if (score >= 80) return 'AUTO_MATCH_WITH_SAMPLING_REVIEW';
  if (score >= 60) return 'REVIEW_QUEUE';
  return 'NO_MATCH';
}

// ============================================================================
// TEST 1: Guardrails
// ============================================================================

function testGuardrails() {
  testGroup('TEST 1: Hard Guardrails');

  // Test 1.1: Volume mismatch
  const volumeTest = checkGuardrails(750, 1500, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  assert(
    !volumeTest.pass && volumeTest.failures.some(f => f.includes('VOLUME_MISMATCH')),
    'Volume mismatch triggers guardrail failure'
  );

  // Test 1.2: Pack type mismatch
  const packTest = checkGuardrails(750, 750, 'bottle', 'case', 1, 6, 13.5, 13.5);
  assert(
    !packTest.pass && packTest.failures.some(f => f.includes('PACK_MISMATCH')),
    'Pack type mismatch triggers guardrail failure'
  );

  // Test 1.3: Units per case mismatch
  const unitsTest = checkGuardrails(750, 750, 'case', 'case', 6, 12, 13.5, 13.5);
  assert(
    !unitsTest.pass && unitsTest.failures.some(f => f.includes('UNITS_MISMATCH')),
    'Units per case mismatch triggers guardrail failure'
  );

  // Test 1.4: ABV out of tolerance (>0.5%)
  const abvFailTest = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 14.2);
  assert(
    !abvFailTest.pass && abvFailTest.failures.some(f => f.includes('ABV_OUT_OF_TOLERANCE')),
    'ABV difference >0.5% triggers guardrail failure'
  );

  // Test 1.5: ABV within tolerance (≤0.5%)
  const abvPassTest = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 13.7);
  assert(
    abvPassTest.pass,
    'ABV within 0.5% tolerance passes guardrail'
  );

  // Test 1.6: All guardrails pass
  const allPassTest = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  assert(
    allPassTest.pass && allPassTest.failures.length === 0,
    'All guardrails pass when attributes match'
  );
}

// ============================================================================
// TEST 2: Vintage Policy
// ============================================================================

function testVintagePolicy() {
  testGroup('TEST 2: Vintage Policy');

  // Test 2.1: Exact vintage match
  const exactMatch = checkVintagePolicy(2015, 2015);
  assert(
    exactMatch.pass,
    'Exact vintage match passes policy'
  );

  // Test 2.2: Vintage mismatch (±1 year)
  const mismatch1 = checkVintagePolicy(2015, 2016);
  assert(
    !mismatch1.pass && mismatch1.reason === 'VINTAGE_MISMATCH',
    'Vintage mismatch (±1 year) fails policy'
  );

  // Test 2.3: Vintage mismatch (±2 years)
  const mismatch2 = checkVintagePolicy(2015, 2013);
  assert(
    !mismatch2.pass && mismatch2.reason === 'VINTAGE_MISMATCH',
    'Vintage mismatch (±2 years) fails policy'
  );

  // Test 2.4: Input missing vintage
  const missingInput = checkVintagePolicy(undefined, 2015);
  assert(
    !missingInput.pass && missingInput.reason === 'VINTAGE_MISSING',
    'Missing input vintage fails policy (when candidate has vintage)'
  );

  // Test 2.5: Candidate missing vintage
  const missingCandidate = checkVintagePolicy(2015, undefined);
  assert(
    !missingCandidate.pass && missingCandidate.reason === 'VINTAGE_MISSING',
    'Missing candidate vintage fails policy (when input has vintage)'
  );

  // Test 2.6: Both missing vintage (NV)
  const bothMissing = checkVintagePolicy(undefined, undefined);
  assert(
    bothMissing.pass,
    'Both missing vintage (NV) passes policy'
  );
}

// ============================================================================
// TEST 3: Scoring Model
// ============================================================================

function testScoringModel() {
  testGroup('TEST 3: Scoring Model (0-100)');

  // Test 3.1: GTIN exact match scores 70
  const gtinScore = calculateScore({ gtinMatch: true });
  assert(
    gtinScore === 70,
    `GTIN exact match scores 70 points (got ${gtinScore})`
  );

  // Test 3.2: Existing SKU mapping scores 60
  const skuScore = calculateScore({ skuMapping: true });
  assert(
    skuScore === 60,
    `Existing SKU mapping scores 60 points (got ${skuScore})`
  );

  // Test 3.3: Producer exact match scores 15
  const producerExactScore = calculateScore({ producerExact: true });
  assert(
    producerExactScore === 15,
    `Producer exact match scores 15 points (got ${producerExactScore})`
  );

  // Test 3.4: Producer fuzzy match scores 10
  const producerFuzzyScore = calculateScore({ producerFuzzy: true });
  assert(
    producerFuzzyScore === 10,
    `Producer fuzzy match scores 10 points (got ${producerFuzzyScore})`
  );

  // Test 3.5: Product name exact match scores 15
  const productExactScore = calculateScore({ productExact: true });
  assert(
    productExactScore === 15,
    `Product name exact match scores 15 points (got ${productExactScore})`
  );

  // Test 3.6: Product name fuzzy match scores 10
  const productFuzzyScore = calculateScore({ productFuzzy: true });
  assert(
    productFuzzyScore === 10,
    `Product name fuzzy match scores 10 points (got ${productFuzzyScore})`
  );

  // Test 3.7: Vintage exact match scores 10
  const vintageScore = calculateScore({ vintageExact: true });
  assert(
    vintageScore === 10,
    `Vintage exact match scores 10 points (got ${vintageScore})`
  );

  // Test 3.8: Volume match scores 10
  const volumeScore = calculateScore({ volumeMatch: true });
  assert(
    volumeScore === 10,
    `Volume match scores 10 points (got ${volumeScore})`
  );

  // Test 3.9: ABV within tolerance scores 5
  const abvScore = calculateScore({ abvWithinTolerance: true });
  assert(
    abvScore === 5,
    `ABV within tolerance scores 5 points (got ${abvScore})`
  );

  // Test 3.10: Country match scores 3
  const countryScore = calculateScore({ countryMatch: true });
  assert(
    countryScore === 3,
    `Country match scores 3 points (got ${countryScore})`
  );

  // Test 3.11: Region match scores 2
  const regionScore = calculateScore({ regionMatch: true });
  assert(
    regionScore === 2,
    `Region match scores 2 points (got ${regionScore})`
  );

  // Test 3.12: Grape match scores 3
  const grapeScore = calculateScore({ grapeMatch: true });
  assert(
    grapeScore === 3,
    `Grape match scores 3 points (got ${grapeScore})`
  );

  // Test 3.13: Perfect match (GTIN + all attributes)
  const perfectScore = calculateScore({
    gtinMatch: true,
    producerExact: true,
    productExact: true,
    vintageExact: true,
    volumeMatch: true,
    abvWithinTolerance: true,
    countryMatch: true,
    regionMatch: true,
    grapeMatch: true
  });
  assert(
    perfectScore === 100,
    `Perfect match scores 100 points (capped) (got ${perfectScore})`
  );

  // Test 3.14: Good fuzzy match (no GTIN)
  const fuzzyScore = calculateScore({
    producerExact: true,
    productExact: true,
    vintageExact: true,
    volumeMatch: true,
    abvWithinTolerance: true,
    countryMatch: true,
    regionMatch: true
  });
  assert(
    fuzzyScore === 60,
    `Good fuzzy match (no GTIN) scores 60 points (got ${fuzzyScore})`
  );
}

// ============================================================================
// TEST 4: Decision Thresholds
// ============================================================================

function testDecisionThresholds() {
  testGroup('TEST 4: Decision Thresholds');

  // Test 4.1: Score ≥90, guardrails pass, vintage pass → AUTO_MATCH
  const autoMatch = getDecision(95, true, true);
  assert(
    autoMatch === 'AUTO_MATCH',
    `Score ≥90 + guardrails pass + vintage pass → AUTO_MATCH (got ${autoMatch})`
  );

  // Test 4.2: Score 80-89, guardrails pass, vintage pass → SAMPLING_REVIEW
  const samplingReview = getDecision(85, true, true);
  assert(
    samplingReview === 'AUTO_MATCH_WITH_SAMPLING_REVIEW',
    `Score 80-89 + guardrails pass + vintage pass → SAMPLING_REVIEW (got ${samplingReview})`
  );

  // Test 4.3: Score 60-79, guardrails pass, vintage pass → REVIEW_QUEUE
  const reviewQueue = getDecision(70, true, true);
  assert(
    reviewQueue === 'REVIEW_QUEUE',
    `Score 60-79 + guardrails pass + vintage pass → REVIEW_QUEUE (got ${reviewQueue})`
  );

  // Test 4.4: Score <60, guardrails pass, vintage pass → NO_MATCH
  const noMatch = getDecision(50, true, true);
  assert(
    noMatch === 'NO_MATCH',
    `Score <60 + guardrails pass + vintage pass → NO_MATCH (got ${noMatch})`
  );

  // Test 4.5: High score but guardrail fail → NO_MATCH
  const guardrailFail = getDecision(95, false, true);
  assert(
    guardrailFail === 'NO_MATCH',
    `High score + guardrail fail → NO_MATCH (got ${guardrailFail})`
  );

  // Test 4.6: High score but vintage fail → REVIEW_QUEUE
  const vintageFail = getDecision(95, true, false);
  assert(
    vintageFail === 'REVIEW_QUEUE',
    `High score + vintage fail → REVIEW_QUEUE (got ${vintageFail})`
  );

  // Test 4.7: Threshold boundaries (exactly 90)
  const boundary90 = getDecision(90, true, true);
  assert(
    boundary90 === 'AUTO_MATCH',
    `Score exactly 90 → AUTO_MATCH (got ${boundary90})`
  );

  // Test 4.8: Threshold boundaries (exactly 80)
  const boundary80 = getDecision(80, true, true);
  assert(
    boundary80 === 'AUTO_MATCH_WITH_SAMPLING_REVIEW',
    `Score exactly 80 → SAMPLING_REVIEW (got ${boundary80})`
  );

  // Test 4.9: Threshold boundaries (exactly 60)
  const boundary60 = getDecision(60, true, true);
  assert(
    boundary60 === 'REVIEW_QUEUE',
    `Score exactly 60 → REVIEW_QUEUE (got ${boundary60})`
  );

  // Test 4.10: Just below threshold (59)
  const below60 = getDecision(59, true, true);
  assert(
    below60 === 'NO_MATCH',
    `Score 59 → NO_MATCH (got ${below60})`
  );
}

// ============================================================================
// TEST 5: Integration Scenarios
// ============================================================================

function testIntegrationScenarios() {
  testGroup('TEST 5: Integration Scenarios');

  // Scenario 1: Perfect GTIN match
  const scenario1Guardrails = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  const scenario1Vintage = checkVintagePolicy(2015, 2015);
  const scenario1Score = calculateScore({
    gtinMatch: true,
    producerExact: true,
    productExact: true,
    vintageExact: true,
    volumeMatch: true
  });
  const scenario1Decision = getDecision(
    scenario1Score,
    scenario1Guardrails.pass,
    scenario1Vintage.pass
  );
  assert(
    scenario1Decision === 'AUTO_MATCH' && scenario1Score === 100,
    `Perfect GTIN match → AUTO_MATCH with score 100 (got ${scenario1Decision}, score ${scenario1Score})`
  );

  // Scenario 2: Good fuzzy match (no GTIN, exact names)
  const scenario2Guardrails = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  const scenario2Vintage = checkVintagePolicy(2015, 2015);
  const scenario2Score = calculateScore({
    producerExact: true,
    productExact: true,
    vintageExact: true,
    volumeMatch: true,
    abvWithinTolerance: true,
    countryMatch: true,
    regionMatch: true
  });
  const scenario2Decision = getDecision(
    scenario2Score,
    scenario2Guardrails.pass,
    scenario2Vintage.pass
  );
  assert(
    scenario2Decision === 'REVIEW_QUEUE' && scenario2Score === 60,
    `Good fuzzy match (no GTIN) → REVIEW_QUEUE with score 60 (got ${scenario2Decision}, score ${scenario2Score})`
  );

  // Scenario 3: GTIN match but vintage mismatch
  const scenario3Guardrails = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  const scenario3Vintage = checkVintagePolicy(2015, 2016);
  const scenario3Score = calculateScore({
    gtinMatch: true,
    producerExact: true,
    productExact: true,
    volumeMatch: true
  });
  const scenario3Decision = getDecision(
    scenario3Score,
    scenario3Guardrails.pass,
    scenario3Vintage.pass
  );
  assert(
    scenario3Decision === 'REVIEW_QUEUE',
    `GTIN match + vintage mismatch → REVIEW_QUEUE (got ${scenario3Decision})`
  );

  // Scenario 4: High score but volume mismatch
  const scenario4Guardrails = checkGuardrails(750, 1500, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  const scenario4Vintage = checkVintagePolicy(2015, 2015);
  const scenario4Score = calculateScore({
    gtinMatch: true,
    producerExact: true,
    productExact: true,
    vintageExact: true
  });
  const scenario4Decision = getDecision(
    scenario4Score,
    scenario4Guardrails.pass,
    scenario4Vintage.pass
  );
  assert(
    scenario4Decision === 'NO_MATCH',
    `High score + volume mismatch → NO_MATCH (got ${scenario4Decision})`
  );

  // Scenario 5: Missing input vintage
  const scenario5Guardrails = checkGuardrails(750, 750, 'bottle', 'bottle', 1, 1, 13.5, 13.5);
  const scenario5Vintage = checkVintagePolicy(undefined, 2015);
  const scenario5Score = calculateScore({
    producerExact: true,
    productExact: true,
    volumeMatch: true
  });
  const scenario5Decision = getDecision(
    scenario5Score,
    scenario5Guardrails.pass,
    scenario5Vintage.pass
  );
  assert(
    scenario5Decision === 'REVIEW_QUEUE',
    `Missing input vintage → REVIEW_QUEUE (got ${scenario5Decision})`
  );
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

function runAllTests() {
  console.log('\n🧪 MATCHING RULES UNIT TEST SUITE');
  console.log('═'.repeat(60));
  console.log('Testing matching logic against MATCHING_RULES.md');
  console.log('(Unit tests - no database required)');
  console.log('');

  testGuardrails();
  testVintagePolicy();
  testScoringModel();
  testDecisionThresholds();
  testIntegrationScenarios();

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RESULTS: ${testsPassed} passed, ${testsFailed} failed`);

  if (testsFailed === 0) {
    console.log('\n✅ ALL TESTS PASSED! 🎉');
    console.log('   Matching logic is aligned with MATCHING_RULES.md');
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} TEST(S) FAILED`);
    console.log('   Review failures above');
    process.exit(1);
  }
}

// Run tests
runAllTests();
