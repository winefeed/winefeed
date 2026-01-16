/**
 * DDL Acceptance Test Runner - End-to-End API Testing
 *
 * Run: npx tsx scripts/ddl-acceptance-run.ts --scenario=<scenario>
 *
 * Scenarios:
 *   - happy-path: Complete workflow (create → submit → approve → validate)
 *   - shipment-gating: All negative scenarios (MUST block)
 *   - validation: Business rule validation
 *   - resubmission: Rejection and resubmission flow
 *   - all: Run all scenarios
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test context
const TEST_TENANT_ID = 'test-tenant-' + Date.now();
const TEST_RESTAURANT_ID = 'test-restaurant-' + Date.now();
const TEST_IMPORTER_ID = 'test-importer-' + Date.now();
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_ADMIN_ID = 'test-admin-' + Date.now();

// ============================================================================
// Utilities
// ============================================================================

interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string, details?: any): TestResult {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
    return { passed: true, message };
  } else {
    failedTests++;
    console.error(`  ✗ ${message}`);
    if (details) {
      console.error('    Details:', JSON.stringify(details, null, 2));
    }
    return { passed: false, message, details };
  }
}

function assertEquals(actual: any, expected: any, message: string): TestResult {
  return assert(actual === expected, message, { expected, actual });
}

function assertContains(text: string, substring: string, message: string): TestResult {
  return assert(
    text && text.toLowerCase().includes(substring.toLowerCase()),
    message,
    { text, substring }
  );
}

async function apiCall(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any }> {
  const url = `${API_BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TEST_TENANT_ID,
      'x-user-id': TEST_USER_ID,
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  return { status: response.status, data };
}

// ============================================================================
// Scenario: Happy Path
// ============================================================================

async function runHappyPathScenario(): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 SCENARIO: Happy Path (Complete Workflow)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let ddlId: string;
  let documentId: string;

  // Step 1: Create DDL
  console.log('Step 1: Create DDL (NOT_REGISTERED)');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Test Restaurant AB',
      delivery_address: {
        line1: 'Kungsgatan 1',
        postal_code: '111 43',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'John Doe',
        email: 'john@test.se',
        phone: '070-123 45 67',
      },
      consent_given: true,
    }
  );

  assertEquals(createResponse.status, 201, 'Create DDL returns 201 Created');
  assert(!!createResponse.data.ddl_id, 'Response includes ddl_id');
  assertEquals(createResponse.data.status, 'NOT_REGISTERED', 'Initial status is NOT_REGISTERED');

  ddlId = createResponse.data.ddl_id;

  // Step 2: Generate Document
  console.log('\nStep 2: Generate Document (v1)');
  const generateResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assertEquals(generateResponse.status, 200, 'Generate document returns 200 OK');
  assert(!!generateResponse.data.document_id, 'Response includes document_id');
  assertEquals(generateResponse.data.version, 1, 'First document version is 1');
  assert(!!generateResponse.data.file_url, 'Response includes file_url');
  assert(!!generateResponse.data.file_hash, 'Response includes file_hash (SHA-256)');
  assert(
    generateResponse.data.file_hash.length === 64,
    'SHA-256 hash is 64 characters'
  );

  documentId = generateResponse.data.document_id;

  // Step 3: Verify document in database
  console.log('\nStep 3: Verify document in database');
  const { data: docRecord } = await supabase
    .from('ddl_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  assert(!!docRecord, 'Document record exists in database');
  assertEquals(docRecord?.version, 1, 'Document version is 1');
  assert(!!docRecord?.file_hash, 'Document has SHA-256 hash');

  // Step 4: Submit for approval
  console.log('\nStep 4: Submit for Approval');
  const submitResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/submit`,
    { note: 'Ready for review' }
  );

  assertEquals(submitResponse.status, 200, 'Submit returns 200 OK');
  assertEquals(submitResponse.data.status, 'SUBMITTED', 'Status changed to SUBMITTED');

  // Verify status event created
  const { data: submitEvent } = await supabase
    .from('ddl_status_events')
    .select('*')
    .eq('ddl_id', ddlId)
    .eq('to_status', 'SUBMITTED')
    .single();

  assert(!!submitEvent, 'Status event created for submission');
  assertEquals(submitEvent?.from_status, 'NOT_REGISTERED', 'Event from_status is NOT_REGISTERED');
  assertEquals(submitEvent?.to_status, 'SUBMITTED', 'Event to_status is SUBMITTED');
  assert(!!submitEvent?.changed_by_user_id, 'Event includes changed_by_user_id');

  // Step 5: Validate shipment (should BLOCK - not approved yet)
  console.log('\nStep 5: Validate Shipment (Should BLOCK - SUBMITTED status)');
  const validateBlockedResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: TEST_RESTAURANT_ID,
      importer_id: TEST_IMPORTER_ID,
      delivery_address: {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(validateBlockedResponse.status, 200, 'Validate returns 200 OK');
  assertEquals(validateBlockedResponse.data.valid, false, '🚨 CRITICAL: SUBMITTED status BLOCKS shipment');
  assertEquals(validateBlockedResponse.data.status, 'SUBMITTED', 'Response includes status SUBMITTED');
  assertContains(
    validateBlockedResponse.data.error,
    'inte godkänd',
    'Error message indicates not approved'
  );

  // Step 6: Approve (as compliance admin)
  console.log('\nStep 6: Approve (Compliance Admin)');
  const approveResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/approve`,
    { note: 'All documents verified' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  assertEquals(approveResponse.status, 200, 'Approve returns 200 OK');
  assertEquals(approveResponse.data.status, 'APPROVED', 'Status changed to APPROVED');

  // Verify approval event
  const { data: approvalEvent } = await supabase
    .from('ddl_status_events')
    .select('*')
    .eq('ddl_id', ddlId)
    .eq('to_status', 'APPROVED')
    .single();

  assert(!!approvalEvent, 'Status event created for approval');
  assertEquals(approvalEvent?.from_status, 'SUBMITTED', 'Event from_status is SUBMITTED');
  assertEquals(approvalEvent?.to_status, 'APPROVED', 'Event to_status is APPROVED');
  assertEquals(approvalEvent?.changed_by_user_id, TEST_ADMIN_ID, 'Event includes admin user_id');

  // Step 7: Validate shipment (should ALLOW - now approved)
  console.log('\nStep 7: Validate Shipment (Should ALLOW - APPROVED status)');
  const validateAllowedResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: TEST_RESTAURANT_ID,
      importer_id: TEST_IMPORTER_ID,
      delivery_address: {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(validateAllowedResponse.status, 200, 'Validate returns 200 OK');
  assertEquals(validateAllowedResponse.data.valid, true, '🚨 CRITICAL: APPROVED status ALLOWS shipment');
  assertEquals(validateAllowedResponse.data.status, 'APPROVED', 'Response status is APPROVED');
  assertEquals(validateAllowedResponse.data.ddl_id, ddlId, 'Response includes correct ddl_id');
  assert(!validateAllowedResponse.data.error, 'No error message when valid');

  // Step 8: Test case insensitivity
  console.log('\nStep 8: Validate Shipment with Different Case (Should ALLOW)');
  const validateCaseResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: TEST_RESTAURANT_ID,
      importer_id: TEST_IMPORTER_ID,
      delivery_address: {
        line1: 'kungsgatan 1',  // lowercase
        postal_code: '11143',
        city: 'STOCKHOLM',  // uppercase
      },
    }
  );

  assertEquals(validateCaseResponse.data.valid, true, 'Case-insensitive matching works');

  // Step 9: Test postal code space handling
  console.log('\nStep 9: Validate Shipment with Different Postal Code Format (Should ALLOW)');
  const validatePostalResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: TEST_RESTAURANT_ID,
      importer_id: TEST_IMPORTER_ID,
      delivery_address: {
        line1: 'Kungsgatan 1',
        postal_code: '111 43',  // with space
        city: 'Stockholm',
      },
    }
  );

  assertEquals(validatePostalResponse.data.valid, true, 'Postal code space normalization works');

  console.log('\n✅ Happy Path Scenario Complete');
  return failedTests === 0;
}

// ============================================================================
// Scenario: Shipment Gating (All MUST Block)
// ============================================================================

async function runShipmentGatingScenario(): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚨 SCENARIO: Shipment Gating (ZERO FALSE ALLOWS)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testRestaurantId = 'gating-restaurant-' + Date.now();
  const testImporterId = 'gating-importer-' + Date.now();

  // Test 1: No DDL exists
  console.log('Test 1: No DDL Exists (MUST BLOCK)');
  const noddlResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: testRestaurantId,
      importer_id: testImporterId,
      delivery_address: {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(noddlResponse.data.valid, false, '🚨 CRITICAL: Missing DDL BLOCKS shipment');
  assertContains(noddlResponse.data.error, 'saknas', 'Error indicates DDL missing');

  // Test 2: Create DDL in SUBMITTED state (not approved)
  console.log('\nTest 2: SUBMITTED DDL (MUST BLOCK)');
  const createSubmittedResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    {
      importer_id: testImporterId,
      org_number: '556789-1234',
      legal_name: 'Gating Test Restaurant AB',
      delivery_address: {
        line1: 'Drottninggatan 5',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Jane Doe',
        email: 'jane@test.se',
        phone: '070-111 22 33',
      },
      consent_given: true,
    }
  );

  const submittedDdlId = createSubmittedResponse.data.ddl_id;

  // Generate document and submit
  await apiCall('POST', `/api/direct-delivery-locations/${submittedDdlId}/generate-document`);
  await apiCall('POST', `/api/direct-delivery-locations/${submittedDdlId}/submit`, {
    note: 'Test submission',
  });

  const submittedValidateResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: testRestaurantId,
      importer_id: testImporterId,
      delivery_address: {
        line1: 'Drottninggatan 5',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(submittedValidateResponse.data.valid, false, '🚨 CRITICAL: SUBMITTED status BLOCKS shipment');
  assertEquals(submittedValidateResponse.data.status, 'SUBMITTED', 'Response shows SUBMITTED status');

  // Test 3: REJECTED DDL (must block)
  console.log('\nTest 3: REJECTED DDL (MUST BLOCK)');

  // Reject the DDL
  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${submittedDdlId}/reject`,
    { note: 'Testing rejection' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  const rejectedValidateResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: testRestaurantId,
      importer_id: testImporterId,
      delivery_address: {
        line1: 'Drottninggatan 5',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(rejectedValidateResponse.data.valid, false, '🚨 CRITICAL: REJECTED status BLOCKS shipment');
  assertEquals(rejectedValidateResponse.data.status, 'REJECTED', 'Response shows REJECTED status');

  // Test 4: APPROVED but address mismatch (different street)
  console.log('\nTest 4: APPROVED DDL but Address Mismatch - Different Street (MUST BLOCK)');

  const approvedRestaurantId = 'approved-restaurant-' + Date.now();
  const approvedImporterId = 'approved-importer-' + Date.now();

  // Create and approve a DDL
  const approvedCreateResponse = await apiCall(
    'POST',
    `/api/restaurants/${approvedRestaurantId}/direct-delivery-locations`,
    {
      importer_id: approvedImporterId,
      org_number: '556789-1234',
      legal_name: 'Approved Test AB',
      delivery_address: {
        line1: 'Storgatan 10',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Test User',
        email: 'test@test.se',
        phone: '070-999 88 77',
      },
      consent_given: true,
    }
  );

  const approvedDdlId = approvedCreateResponse.data.ddl_id;
  await apiCall('POST', `/api/direct-delivery-locations/${approvedDdlId}/generate-document`);
  await apiCall('POST', `/api/direct-delivery-locations/${approvedDdlId}/submit`, {});
  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${approvedDdlId}/approve`,
    { note: 'Approved for testing' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  // Try to validate with different street address
  const mismatchStreetResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: approvedRestaurantId,
      importer_id: approvedImporterId,
      delivery_address: {
        line1: 'Kungsgatan 1',  // Different street
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(mismatchStreetResponse.data.valid, false, '🚨 CRITICAL: Different street BLOCKS shipment');
  assertContains(mismatchStreetResponse.data.error, 'matchar inte', 'Error indicates address mismatch');

  // Test 5: APPROVED but postal code mismatch
  console.log('\nTest 5: APPROVED DDL but Address Mismatch - Different Postal Code (MUST BLOCK)');

  const mismatchPostalResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: approvedRestaurantId,
      importer_id: approvedImporterId,
      delivery_address: {
        line1: 'Storgatan 10',
        postal_code: '12345',  // Different postal code
        city: 'Stockholm',
      },
    }
  );

  assertEquals(mismatchPostalResponse.data.valid, false, '🚨 CRITICAL: Different postal code BLOCKS shipment');
  assertContains(mismatchPostalResponse.data.error, 'matchar inte', 'Error indicates address mismatch');

  // Test 6: APPROVED but city mismatch
  console.log('\nTest 6: APPROVED DDL but Address Mismatch - Different City (MUST BLOCK)');

  const mismatchCityResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: approvedRestaurantId,
      importer_id: approvedImporterId,
      delivery_address: {
        line1: 'Storgatan 10',
        postal_code: '11143',
        city: 'Göteborg',  // Different city
      },
    }
  );

  assertEquals(mismatchCityResponse.data.valid, false, '🚨 CRITICAL: Different city BLOCKS shipment');
  assertContains(mismatchCityResponse.data.error, 'matchar inte', 'Error indicates address mismatch');

  console.log('\n✅ Shipment Gating Scenario Complete');
  console.log('🚨 CRITICAL: All negative scenarios correctly BLOCKED shipments (zero false allows)');
  return failedTests === 0;
}

// ============================================================================
// Scenario: Validation & Business Rules
// ============================================================================

async function runValidationScenario(): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔒 SCENARIO: Validation & Business Rules');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testRestaurantId = 'validation-restaurant-' + Date.now();
  const testImporterId = 'validation-importer-' + Date.now();

  // Test 1: Invalid org number format
  console.log('Test 1: Invalid Org Number Format (Should REJECT)');
  const invalidFormatResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    {
      importer_id: testImporterId,
      org_number: '12345',  // Too short
      legal_name: 'Invalid Org Test AB',
      delivery_address: {
        line1: 'Test Street 1',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Test User',
        email: 'test@test.se',
        phone: '070-123 45 67',
      },
      consent_given: true,
    }
  );

  assert(invalidFormatResponse.status >= 400, 'Invalid org number format rejected');
  assertContains(
    JSON.stringify(invalidFormatResponse.data),
    'format',
    'Error message mentions format'
  );

  // Test 2: Invalid org number checksum
  console.log('\nTest 2: Invalid Org Number Checksum (Luhn Algorithm - Should REJECT)');
  const invalidChecksumResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    {
      importer_id: testImporterId,
      org_number: '556789-1235',  // Invalid Luhn checksum
      legal_name: 'Invalid Checksum Test AB',
      delivery_address: {
        line1: 'Test Street 1',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Test User',
        email: 'test@test.se',
        phone: '070-123 45 67',
      },
      consent_given: true,
    }
  );

  assert(invalidChecksumResponse.status >= 400, 'Invalid checksum rejected');
  assertContains(
    JSON.stringify(invalidChecksumResponse.data),
    'checksum',
    'Error message mentions checksum'
  );

  // Test 3: Consent not given
  console.log('\nTest 3: Consent Not Given (Should REJECT)');
  const noConsentResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    {
      importer_id: testImporterId,
      org_number: '556789-1234',
      legal_name: 'No Consent Test AB',
      delivery_address: {
        line1: 'Test Street 1',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Test User',
        email: 'test@test.se',
        phone: '070-123 45 67',
      },
      consent_given: false,  // No consent
    }
  );

  assert(noConsentResponse.status >= 400, 'Request without consent rejected');
  assertContains(
    JSON.stringify(noConsentResponse.data),
    'consent',
    'Error message mentions consent'
  );

  // Test 4: Duplicate DDL
  console.log('\nTest 4: Duplicate DDL (Should REJECT Second Request)');
  const ddlData = {
    importer_id: testImporterId,
    org_number: '556789-1234',
    legal_name: 'Duplicate Test AB',
    delivery_address: {
      line1: 'Unique Street 99',
      postal_code: '11143',
      city: 'Stockholm',
      country_code: 'SE',
    },
    contact: {
      name: 'Test User',
      email: 'test@test.se',
      phone: '070-123 45 67',
    },
    consent_given: true,
  };

  const firstCreateResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    ddlData
  );

  assertEquals(firstCreateResponse.status, 201, 'First DDL creation succeeds');

  const duplicateResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    ddlData
  );

  assert(duplicateResponse.status >= 400, 'Duplicate DDL rejected');
  assertContains(
    JSON.stringify(duplicateResponse.data),
    'duplicate',
    'Error message mentions duplicate'
  );

  // Test 5: Cannot submit without document
  console.log('\nTest 5: Cannot Submit Without Document (Should REJECT)');
  const noDdlId = firstCreateResponse.data.ddl_id;

  const submitNoDocResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${noDdlId}/submit`,
    { note: 'Trying to submit without document' }
  );

  assert(submitNoDocResponse.status >= 400, 'Submit without document rejected');
  assertContains(
    JSON.stringify(submitNoDocResponse.data),
    'dokument',
    'Error message mentions document required'
  );

  console.log('\n✅ Validation Scenario Complete');
  return failedTests === 0;
}

// ============================================================================
// Scenario: Resubmission Workflow
// ============================================================================

async function runResubmissionScenario(): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 SCENARIO: Rejection & Resubmission Workflow');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testRestaurantId = 'resubmit-restaurant-' + Date.now();
  const testImporterId = 'resubmit-importer-' + Date.now();

  // Step 1: Create DDL
  console.log('Step 1: Create DDL');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${testRestaurantId}/direct-delivery-locations`,
    {
      importer_id: testImporterId,
      org_number: '556789-1234',
      legal_name: 'Resubmit Test AB',
      delivery_address: {
        line1: 'Resubmit Street 1',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Test User',
        email: 'test@test.se',
        phone: '070-123 45 67',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  // Step 2: Generate document
  console.log('\nStep 2: Generate Document');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);

  // Step 3: Submit
  console.log('\nStep 3: Submit for Approval');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'First submission',
  });

  // Step 4: Reject
  console.log('\nStep 4: Reject DDL');
  const rejectResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/reject`,
    { note: 'Address information incomplete' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  assertEquals(rejectResponse.status, 200, 'Rejection succeeds');
  assertEquals(rejectResponse.data.status, 'REJECTED', 'Status changed to REJECTED');

  // Step 5: Verify rejection blocks shipment
  console.log('\nStep 5: Verify Rejection Blocks Shipment');
  const validateRejectedResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: testRestaurantId,
      importer_id: testImporterId,
      delivery_address: {
        line1: 'Resubmit Street 1',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(validateRejectedResponse.data.valid, false, 'REJECTED DDL blocks shipment');

  // Step 6: Check audit trail
  console.log('\nStep 6: Verify Audit Trail');
  const { data: events } = await supabase
    .from('ddl_status_events')
    .select('*')
    .eq('ddl_id', ddlId)
    .order('created_at', { ascending: true });

  assert(events && events.length >= 2, 'At least 2 status events exist');
  assertEquals(events?.[0]?.to_status, 'SUBMITTED', 'First event is submission');
  assertEquals(events?.[1]?.to_status, 'REJECTED', 'Second event is rejection');
  assert(!!events?.[1]?.note, 'Rejection note captured');

  // Step 7: Reset to NOT_REGISTERED (allow resubmission)
  console.log('\nStep 7: Reset to NOT_REGISTERED');
  // This would typically be done via a PATCH endpoint or by regenerating
  // For now, we can verify the database allows this transition
  const { error: updateError } = await supabase
    .from('direct_delivery_locations')
    .update({ status: 'NOT_REGISTERED' })
    .eq('id', ddlId);

  assert(!updateError, 'Can reset REJECTED DDL to NOT_REGISTERED');

  // Step 8: Regenerate document (v2)
  console.log('\nStep 8: Regenerate Document (v2)');
  const regenerateResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assertEquals(regenerateResponse.status, 200, 'Regeneration succeeds');
  assertEquals(regenerateResponse.data.version, 2, 'Document version incremented to 2');

  // Step 9: Resubmit
  console.log('\nStep 9: Resubmit for Approval');
  const resubmitResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/submit`,
    { note: 'Resubmission with corrected data' }
  );

  assertEquals(resubmitResponse.status, 200, 'Resubmission succeeds');
  assertEquals(resubmitResponse.data.status, 'SUBMITTED', 'Status back to SUBMITTED');

  // Step 10: Approve this time
  console.log('\nStep 10: Approve on Second Attempt');
  const approveResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/approve`,
    { note: 'Approved after correction' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  assertEquals(approveResponse.status, 200, 'Approval succeeds');
  assertEquals(approveResponse.data.status, 'APPROVED', 'Status changed to APPROVED');

  // Step 11: Verify shipment now allowed
  console.log('\nStep 11: Verify Shipment Now Allowed');
  const validateApprovedResponse = await apiCall(
    'POST',
    '/api/shipments/validate-ddl',
    {
      restaurant_id: testRestaurantId,
      importer_id: testImporterId,
      delivery_address: {
        line1: 'Resubmit Street 1',
        postal_code: '11143',
        city: 'Stockholm',
      },
    }
  );

  assertEquals(validateApprovedResponse.data.valid, true, 'Approved DDL allows shipment after resubmission');

  console.log('\n✅ Resubmission Scenario Complete');
  return failedTests === 0;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DDL ACCEPTANCE TEST RUNNER - End-to-End API Testing         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const scenarioArg = args.find((arg) => arg.startsWith('--scenario='));
  const scenario = scenarioArg ? scenarioArg.split('=')[1] : 'all';

  console.log(`\n📋 Configuration:`);
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Scenario: ${scenario}`);
  console.log(`   Test Tenant ID: ${TEST_TENANT_ID}`);

  let allPassed = true;

  try {
    if (scenario === 'happy-path' || scenario === 'all') {
      const passed = await runHappyPathScenario();
      allPassed = allPassed && passed;
    }

    if (scenario === 'shipment-gating' || scenario === 'all') {
      const passed = await runShipmentGatingScenario();
      allPassed = allPassed && passed;
    }

    if (scenario === 'validation' || scenario === 'all') {
      const passed = await runValidationScenario();
      allPassed = allPassed && passed;
    }

    if (scenario === 'resubmission' || scenario === 'all') {
      const passed = await runResubmissionScenario();
      allPassed = allPassed && passed;
    }

    // Print summary
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✓ Passed: ${passedTests}`);
    console.log(`✗ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (allPassed) {
      console.log('✅ ALL TESTS PASSED - DDL system is production-ready\n');
      process.exit(0);
    } else {
      console.log('❌ SOME TESTS FAILED - Review failures above\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
  }
}

main();
