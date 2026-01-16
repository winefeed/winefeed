/**
 * ACCEPTANCE RUN - End-to-End Test
 *
 * Tests complete Phase 1 vertical slice:
 * Upload CSV → Match → Review Queue → Approve Decision
 *
 * Validates idempotency, data integrity, and correct flow
 *
 * Usage:
 *   npx tsx scripts/acceptance-run.ts
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_SUPPLIER_ID = process.env.TEST_SUPPLIER_ID || 'test-supplier-acceptance';
const TEST_USER_ID = process.env.TEST_USER_ID || 'acceptance-test-user';

// Test CSV content (minimal sample)
const TEST_CSV_CONTENT = `supplier_sku,gtin_each,gtin_case,producer_name,product_name,vintage,volume_ml,abv_percent,pack_type,units_per_case,country_of_origin,region,grape_variety,price_net,currency
TEST-001,7350001234567,,Château Test,Test Rouge Premier Cru,2020,750,13.5,bottle,,France,Bordeaux,Cabernet Sauvignon,450.00,SEK
TEST-002,7350001234568,,Château Test,Test Blanc,2021,750,12.5,bottle,,France,Bordeaux,Sauvignon Blanc,350.00,SEK
TEST-003,,,Domaine Test,Test Pinot Noir,2019,750,13.0,bottle,,France,Bourgogne,Pinot Noir,650.00,SEK
TEST-004,,,Producer Test,Test Product No Vintage,,750,14.0,bottle,,Italy,Tuscany,Sangiovese,280.00,SEK
TEST-005,7350001234569,,Test Producer,Test Case Pack,2022,750,13.5,case,6,Spain,Rioja,Tempranillo,120.00,SEK`;

// ============================================================================
// HTTP Client
// ============================================================================

async function apiRequest(
  method: string,
  path: string,
  body?: any,
  contentType: string = 'application/json'
): Promise<any> {
  const url = `${API_BASE_URL}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      ...(contentType === 'application/json' && { 'Content-Type': 'application/json' })
    }
  };

  if (body) {
    if (contentType === 'application/json') {
      options.body = JSON.stringify(body);
    } else if (contentType === 'multipart/form-data') {
      // For multipart, body should be FormData
      options.body = body;
      // Remove content-type header (browser will set it with boundary)
      delete (options.headers as any)['Content-Type'];
    }
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// Test Utilities
// ============================================================================

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

function logStep(step: string, title: string): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log(`${step}: ${title}`);
  console.log('═'.repeat(70));
}

// ============================================================================
// Test Functions
// ============================================================================

async function step1_uploadCSV(): Promise<string> {
  logStep('STEP 1', 'Upload CSV Import');

  // Create form data with CSV
  const formData = new FormData();
  const blob = new Blob([TEST_CSV_CONTENT], { type: 'text/csv' });
  const file = new File([blob], 'acceptance-test.csv', { type: 'text/csv' });
  formData.append('file', file);

  const response = await apiRequest(
    'POST',
    `/api/suppliers/${TEST_SUPPLIER_ID}/imports`,
    formData,
    'multipart/form-data'
  );

  console.log('Response:', JSON.stringify(response, null, 2));

  assert(response.importId, 'importId returned');
  assert(response.status === 'PARSED', 'status is PARSED');
  assert(response.totalLines === 5, 'totalLines is 5');

  console.log('');
  console.log(`✅ GATE 1 PASSED: CSV uploaded, importId = ${response.importId}`);

  return response.importId;
}

async function step2_runMatching(importId: string): Promise<any> {
  logStep('STEP 2', 'Run Matching');

  const response = await apiRequest(
    'POST',
    `/api/imports/${importId}/match`
  );

  console.log('Response:', JSON.stringify(response, null, 2));

  assert(response.status === 'MATCHED', 'status is MATCHED');
  assert(response.summary, 'summary returned');
  assert(response.summary.totalLines === 5, 'totalLines matches upload');
  assert(response.summary.errors === 0, 'no matching errors');

  const { autoMatched, samplingReview, needsReview, noMatch } = response.summary;
  const total = autoMatched + samplingReview + needsReview + noMatch;
  assert(total === 5, `decision counts sum to totalLines (${total} = 5)`);

  console.log('');
  console.log('Match Summary:');
  console.log(`  AUTO_MATCHED:      ${autoMatched}`);
  console.log(`  SAMPLING_REVIEW:   ${samplingReview}`);
  console.log(`  NEEDS_REVIEW:      ${needsReview}`);
  console.log(`  NO_MATCH:          ${noMatch}`);

  console.log('');
  console.log('✅ GATE 2 PASSED: Matching completed successfully');

  return response.summary;
}

async function step3_fetchReviewQueue(importId: string): Promise<any[]> {
  logStep('STEP 3', 'Fetch Review Queue');

  const response = await apiRequest(
    'GET',
    `/api/admin/review-queue?importId=${importId}&status=pending&limit=50`
  );

  console.log('Response summary:');
  console.log(`  Total items: ${response.pagination.total}`);
  console.log(`  Items in page: ${response.items.length}`);

  assert(Array.isArray(response.items), 'items is array');
  assert(response.pagination, 'pagination returned');

  if (response.items.length > 0) {
    const firstItem = response.items[0];
    console.log('');
    console.log('First queue item:');
    console.log(`  Queue ID: ${firstItem.queueItemId}`);
    console.log(`  Supplier SKU: ${firstItem.line.supplierSku}`);
    console.log(`  Status: ${firstItem.status}`);
    console.log(`  Candidates: ${firstItem.candidates.length}`);

    assert(firstItem.queueItemId, 'queueItemId present');
    assert(firstItem.status === 'pending', 'status is pending');
    assert(firstItem.line, 'line data present');
    assert(Array.isArray(firstItem.candidates), 'candidates is array');
  }

  console.log('');
  console.log('✅ GATE 3 PASSED: Review queue fetched successfully');

  return response.items;
}

async function step4_approveMatch(queueItemId: string, selectedId: string): Promise<any> {
  logStep('STEP 4', 'Approve Match (Human Decision)');

  const response = await apiRequest(
    'POST',
    `/api/admin/review-queue/${queueItemId}/decision`,
    {
      action: 'approve_match',
      selectedId,
      comment: 'Acceptance test - verified match',
      reviewedBy: TEST_USER_ID
    }
  );

  console.log('Response:', JSON.stringify(response, null, 2));

  assert(response.status === 'resolved', 'status is resolved');
  assert(response.action === 'approve_match', 'action is approve_match');
  assert(response.mapping, 'mapping returned');
  assert(response.mapping.masterProductId === selectedId, 'masterProductId matches selectedId');
  assert(response.mapping.matchConfidence === 1.0, 'matchConfidence is 1.0 (human-approved)');
  assert(response.mapping.matchMethod === 'human_review', 'matchMethod is human_review');
  assert(response.auditEventId, 'auditEventId returned');

  console.log('');
  console.log(`Mapping created: ${response.mapping.mappingId}`);
  console.log(`Audit event: ${response.auditEventId}`);

  console.log('');
  console.log('✅ GATE 4 PASSED: Decision approved with mapping + audit');

  return response;
}

async function step5_idempotency_rerunMatching(importId: string, expectedSummary: any): Promise<void> {
  logStep('STEP 5', 'Idempotency Check - Re-run Matching');

  const response = await apiRequest(
    'POST',
    `/api/imports/${importId}/match`
  );

  console.log('Response:', JSON.stringify(response, null, 2));

  assert(response.status === 'MATCHED', 'status still MATCHED');
  assert(response.message && response.message.includes('idempotent'), 'idempotent message present');

  // Summary should match original
  assert(
    response.summary.autoMatched === expectedSummary.autoMatched,
    `autoMatched unchanged (${response.summary.autoMatched} = ${expectedSummary.autoMatched})`
  );
  assert(
    response.summary.needsReview === expectedSummary.needsReview,
    `needsReview unchanged (${response.summary.needsReview} = ${expectedSummary.needsReview})`
  );

  console.log('');
  console.log('✅ GATE 5 PASSED: Re-run matching is idempotent');
}

async function step6_idempotency_reapprove(queueItemId: string, expectedMappingId: string): Promise<void> {
  logStep('STEP 6', 'Idempotency Check - Re-approve Decision');

  const response = await apiRequest(
    'POST',
    `/api/admin/review-queue/${queueItemId}/decision`,
    {
      action: 'approve_match',
      selectedId: 'wf-prod-123',  // Same product as before
      comment: 'Duplicate approval attempt',
      reviewedBy: TEST_USER_ID
    }
  );

  console.log('Response:', JSON.stringify(response, null, 2));

  assert(response.status === 'resolved', 'status is resolved');
  assert(
    response.message && response.message.includes('idempotent'),
    'idempotent message present'
  );
  assert(response.existingMapping, 'existingMapping returned');

  console.log('');
  console.log('✅ GATE 6 PASSED: Re-approve decision is idempotent');
}

async function step7_metricsEndpoint(importId: string): Promise<void> {
  logStep('STEP 7', 'Metrics Endpoint (Optional)');

  try {
    const response = await apiRequest(
      'GET',
      `/api/imports/${importId}/metrics`
    );

    console.log('Response:', JSON.stringify(response, null, 2));

    assert(response.metrics, 'metrics returned');
    assert(typeof response.metrics.autoMatchRate === 'number', 'autoMatchRate is number');
    assert(Array.isArray(response.metrics.topReasons), 'topReasons is array');

    console.log('');
    console.log('✅ GATE 7 PASSED: Metrics endpoint working');
  } catch (error: any) {
    if (error.message.includes('404')) {
      console.log('');
      console.log('⚠️  Metrics endpoint not implemented (optional)');
    } else {
      throw error;
    }
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAcceptanceTest() {
  console.log('');
  console.log('═'.repeat(70));
  console.log('🧪 PHASE 1 ACCEPTANCE RUN - END-TO-END TEST');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Supplier ID: ${TEST_SUPPLIER_ID}`);
  console.log(`Test User ID: ${TEST_USER_ID}`);
  console.log('');

  try {
    // Step 1: Upload CSV
    const importId = await step1_uploadCSV();

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Run Matching
    const summary = await step2_runMatching(importId);

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Fetch Review Queue
    const queueItems = await step3_fetchReviewQueue(importId);

    // Step 4: Approve Match (if any items in queue)
    let approvalResponse: any = null;
    if (queueItems.length > 0) {
      const firstItem = queueItems[0];
      const selectedId = firstItem.candidates[0]?.id || 'wf-prod-123';
      approvalResponse = await step4_approveMatch(firstItem.queueItemId, selectedId);
    } else {
      console.log('');
      console.log('⚠️  No items in review queue, skipping approval test');
    }

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Idempotency - Re-run Matching
    await step5_idempotency_rerunMatching(importId, summary);

    // Step 6: Idempotency - Re-approve (if we approved in step 4)
    if (approvalResponse) {
      await step6_idempotency_reapprove(
        queueItems[0].queueItemId,
        approvalResponse.mapping.mappingId
      );
    }

    // Step 7: Metrics (optional)
    await step7_metricsEndpoint(importId);

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================

    console.log('');
    console.log('═'.repeat(70));
    console.log('📊 ACCEPTANCE RUN SUMMARY');
    console.log('═'.repeat(70));
    console.log('');
    console.log('✅ GATE 1: CSV upload successful');
    console.log('✅ GATE 2: Matching completed');
    console.log('✅ GATE 3: Review queue fetched');
    if (approvalResponse) {
      console.log('✅ GATE 4: Decision approved');
    }
    console.log('✅ GATE 5: Re-run matching idempotent');
    if (approvalResponse) {
      console.log('✅ GATE 6: Re-approve idempotent');
    }
    console.log('');
    console.log('═'.repeat(70));
    console.log('✅ ACCEPTANCE RUN PASSED');
    console.log('═'.repeat(70));
    console.log('');
    console.log('Next steps:');
    console.log('1. Run wrong-bottle safety gate: npx tsx scripts/acceptance-wrong-bottle-gate.ts');
    console.log('2. Run family logic test: npx tsx scripts/acceptance-family-logic.ts');
    console.log('3. Run audit log verification: npx tsx scripts/acceptance-audit-log.ts');
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('═'.repeat(70));
    console.error('❌ ACCEPTANCE RUN FAILED');
    console.error('═'.repeat(70));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

runAcceptanceTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
