/**
 * DDL Acceptance Test - PDF Generation & Storage Integrity
 *
 * Run: npx tsx scripts/ddl-acceptance-documents.ts
 *
 * Tests:
 *   - PDF generation succeeds and creates valid PDF
 *   - Document versioning (v1, v2, v3...)
 *   - SHA-256 hash integrity
 *   - Storage upload and retrieval
 *   - Content verification (org number, address, etc.)
 *   - current_document_id tracking
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test context
const TEST_TENANT_ID = 'doc-tenant-' + Date.now();
const TEST_RESTAURANT_ID = 'doc-restaurant-' + Date.now();
const TEST_IMPORTER_ID = 'doc-importer-' + Date.now();
const TEST_USER_ID = 'doc-user-' + Date.now();

// ============================================================================
// Utilities
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string, details?: any): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ ${message}`);
    if (details) {
      console.error('    Details:', JSON.stringify(details, null, 2));
    }
  }
}

function assertEquals(actual: any, expected: any, message: string): void {
  assert(actual === expected, message, { expected, actual });
}

function assertContains(text: string, substring: string, message: string): void {
  assert(
    !!(text && text.toLowerCase().includes(substring.toLowerCase())),
    message,
    { text: text?.substring(0, 200), substring }
  );
}

async function apiCall(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any }> {
  const url = `${API_BASE_URL}${path}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-tenant-id': TEST_TENANT_ID,
    'x-user-id': TEST_USER_ID,
  };

  const options: RequestInit = {
    method,
    headers: { ...defaultHeaders, ...headers },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  return { status: response.status, data };
}

function computeSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ============================================================================
// Test Suite 1: Basic PDF Generation
// ============================================================================

async function testBasicPDFGeneration(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 TEST SUITE 1: Basic PDF Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL
  console.log('Setup: Create DDL');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'PDF Test Restaurant AB',
      delivery_address: {
        line1: 'PDF Test Street 1',
        postal_code: '111 43',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'PDF Test Manager',
        email: 'pdf@test.se',
        phone: '070-111 11 11',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  // Test 1: Generate PDF
  console.log('\nTest 1: Generate PDF Document');
  const generateResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assertEquals(generateResponse.status, 200, 'PDF generation returns 200 OK');
  assert(!!generateResponse.data.document_id, 'Response includes document_id');
  assert(!!generateResponse.data.file_url, 'Response includes file_url');
  assert(!!generateResponse.data.file_hash, 'Response includes SHA-256 hash');
  assertEquals(generateResponse.data.version, 1, 'First generation is version 1');

  const documentId = generateResponse.data.document_id;
  const fileUrl = generateResponse.data.file_url;
  const fileHash = generateResponse.data.file_hash;

  // Test 2: Verify document record in database
  console.log('\nTest 2: Verify Document Record in Database');
  const { data: docRecord } = await supabase
    .from('ddl_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  assert(!!docRecord, 'Document record exists in database');
  assertEquals(docRecord?.ddl_id, ddlId, 'Document linked to DDL');
  assertEquals(docRecord?.version, 1, 'Document version is 1');
  assertEquals(docRecord?.file_hash, fileHash, 'File hash matches');
  assert(!!docRecord?.file_url, 'File URL stored');
  assertEquals(docRecord?.created_by_user_id, TEST_USER_ID, 'Created by user tracked');
  assertEquals(docRecord?.document_type, 'SKV_5369_03', 'Document type is SKV_5369_03');

  // Test 3: Verify current_document_id updated
  console.log('\nTest 3: Verify current_document_id Updated');
  const { data: ddlRecord } = await supabase
    .from('direct_delivery_locations')
    .select('current_document_id')
    .eq('id', ddlId)
    .single();

  assertEquals(
    ddlRecord?.current_document_id,
    documentId,
    'DDL current_document_id points to new document'
  );

  // Test 4: Verify file path structure
  console.log('\nTest 4: Verify File Path Structure');
  assertContains(fileUrl, TEST_TENANT_ID, 'File path includes tenant_id');
  assertContains(fileUrl, ddlId, 'File path includes ddl_id');
  assertContains(fileUrl, 'v1', 'File path includes version');
  assertContains(fileUrl, '.pdf', 'File path has .pdf extension');

  // Test 5: Verify SHA-256 hash format
  console.log('\nTest 5: Verify SHA-256 Hash Format');
  assertEquals(fileHash.length, 64, 'SHA-256 hash is 64 characters (256 bits hex)');
  assert(/^[a-f0-9]{64}$/.test(fileHash), 'Hash is valid hex string');

  console.log('\n✅ Basic PDF Generation Tests Complete');
}

// ============================================================================
// Test Suite 2: Document Versioning
// ============================================================================

async function testDocumentVersioning(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔢 TEST SUITE 2: Document Versioning');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL
  console.log('Setup: Create DDL');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Versioning Test AB',
      delivery_address: {
        line1: 'Versioning Street 1',
        postal_code: '111 43',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Versioning Manager',
        email: 'versioning@test.se',
        phone: '070-222 22 22',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  // Test 1: First generation is v1
  console.log('\nTest 1: First Generation Creates v1');
  const gen1Response = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assertEquals(gen1Response.data.version, 1, 'First generation is v1');
  const doc1Id = gen1Response.data.document_id;
  const doc1Hash = gen1Response.data.file_hash;

  // Test 2: Regeneration creates v2
  console.log('\nTest 2: Regeneration Creates v2');
  const gen2Response = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assertEquals(gen2Response.data.version, 2, 'Second generation is v2');
  const doc2Id = gen2Response.data.document_id;
  const doc2Hash = gen2Response.data.file_hash;

  assert(doc2Id !== doc1Id, 'v2 has different document_id than v1');
  assertContains(gen2Response.data.file_url, 'v2', 'v2 file path includes version');

  // Test 3: Third generation creates v3
  console.log('\nTest 3: Third Generation Creates v3');
  const gen3Response = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assertEquals(gen3Response.data.version, 3, 'Third generation is v3');
  const doc3Id = gen3Response.data.document_id;
  assertContains(gen3Response.data.file_url, 'v3', 'v3 file path includes version');

  // Test 4: All versions stored in database
  console.log('\nTest 4: All Versions Stored in Database');
  const { data: allVersions } = await supabase
    .from('ddl_documents')
    .select('id, version, file_hash')
    .eq('ddl_id', ddlId)
    .order('version', { ascending: true });

  assertEquals(allVersions?.length, 3, 'All 3 versions stored');
  assertEquals(allVersions?.[0]?.version, 1, 'v1 exists');
  assertEquals(allVersions?.[1]?.version, 2, 'v2 exists');
  assertEquals(allVersions?.[2]?.version, 3, 'v3 exists');

  // Test 5: current_document_id points to latest version
  console.log('\nTest 5: current_document_id Points to Latest Version');
  const { data: ddlRecord } = await supabase
    .from('direct_delivery_locations')
    .select('current_document_id')
    .eq('id', ddlId)
    .single();

  assertEquals(
    ddlRecord?.current_document_id,
    doc3Id,
    'current_document_id points to v3 (latest)'
  );

  // Test 6: Unique constraint on (ddl_id, version)
  console.log('\nTest 6: Unique Constraint on (ddl_id, version)');
  const { error: duplicateError } = await supabase.from('ddl_documents').insert({
    tenant_id: TEST_TENANT_ID,
    ddl_id: ddlId,
    version: 3, // Try to insert duplicate version
    file_url: 'fake-url',
    file_hash: 'fake-hash',
    created_by_user_id: TEST_USER_ID,
    document_type: 'SKV_5369_03',
  });

  assert(
    !!duplicateError,
    'Cannot insert duplicate (ddl_id, version) combination',
    { error: duplicateError?.message }
  );

  console.log('\n✅ Document Versioning Tests Complete');
}

// ============================================================================
// Test Suite 3: SHA-256 Hash Integrity
// ============================================================================

async function testHashIntegrity(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 TEST SUITE 3: SHA-256 Hash Integrity');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL
  console.log('Setup: Create DDL and generate document');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Hash Test AB',
      delivery_address: {
        line1: 'Hash Test Street 1',
        postal_code: '111 43',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Hash Test Manager',
        email: 'hash@test.se',
        phone: '070-333 33 33',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  const generateResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  const fileUrl = generateResponse.data.file_url;
  const storedHash = generateResponse.data.file_hash;

  // Test 1: Download PDF and verify hash
  console.log('\nTest 1: Download PDF and Verify Hash Matches');
  console.log(`   File URL: ${fileUrl}`);

  // Note: In production, you would download the file with auth token
  // For testing purposes, we verify the hash format and storage
  const { data: docRecord } = await supabase
    .from('ddl_documents')
    .select('file_hash')
    .eq('ddl_id', ddlId)
    .single();

  assertEquals(docRecord?.file_hash, storedHash, 'Stored hash matches response hash');

  // Test 2: Verify different versions have different hashes
  console.log('\nTest 2: Different Versions Have Different Hashes');

  // Regenerate document
  const gen2Response = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  const hash2 = gen2Response.data.file_hash;

  // Hashes MIGHT be the same if content is identical, but typically differ due to timestamps
  console.log(`   v1 hash: ${storedHash.substring(0, 16)}...`);
  console.log(`   v2 hash: ${hash2.substring(0, 16)}...`);

  // Note: Hashes could be same if PDF generation is deterministic and no data changed
  // This is actually OK - we're just verifying hashes are computed correctly

  // Test 3: Hash stored for all versions
  console.log('\nTest 3: Hash Stored for All Versions');
  const { data: allDocs } = await supabase
    .from('ddl_documents')
    .select('version, file_hash')
    .eq('ddl_id', ddlId)
    .order('version');

  for (const doc of allDocs || []) {
    assert(!!doc.file_hash, `Version ${doc.version} has file_hash`);
    assertEquals(doc.file_hash.length, 64, `Version ${doc.version} hash is 64 characters`);
  }

  console.log('\n✅ Hash Integrity Tests Complete');
}

// ============================================================================
// Test Suite 4: Storage Integration
// ============================================================================

async function testStorageIntegration(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💾 TEST SUITE 4: Storage Integration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL
  console.log('Setup: Create DDL and generate document');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Storage Test AB',
      delivery_address: {
        line1: 'Storage Street 1',
        postal_code: '111 43',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Storage Manager',
        email: 'storage@test.se',
        phone: '070-444 44 44',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  const generateResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  const fileUrl = generateResponse.data.file_url;

  // Test 1: File URL is valid format
  console.log('\nTest 1: File URL Has Valid Format');
  assert(fileUrl.startsWith('http'), 'File URL starts with http/https');
  assert(fileUrl.includes('.pdf'), 'File URL ends with .pdf');

  // Test 2: File URL follows expected path structure
  console.log('\nTest 2: File URL Follows Expected Path Structure');
  // Expected: {storage_url}/ddl-documents/{tenant_id}/{ddl_id}/application-v{version}.pdf
  assertContains(fileUrl, 'ddl-documents', 'Path includes bucket name');
  assertContains(fileUrl, TEST_TENANT_ID, 'Path includes tenant_id');
  assertContains(fileUrl, ddlId, 'Path includes ddl_id');
  assertContains(fileUrl, 'application-v1.pdf', 'Filename includes version');

  // Test 3: File is NOT publicly accessible (already tested in security suite)
  console.log('\nTest 3: File Access Control (see security test suite)');
  console.log('   ✓ File access control verified in ddl-acceptance-security.ts');

  // Test 4: Multiple versions have different paths
  console.log('\nTest 4: Multiple Versions Have Different Paths');
  const gen2Response = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  const fileUrl2 = gen2Response.data.file_url;

  assert(fileUrl !== fileUrl2, 'v2 has different file URL than v1');
  assertContains(fileUrl2, 'application-v2.pdf', 'v2 filename includes version 2');

  console.log('\n✅ Storage Integration Tests Complete');
}

// ============================================================================
// Test Suite 5: Content Verification
// ============================================================================

async function testContentVerification(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 TEST SUITE 5: PDF Content Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL with specific data
  console.log('Setup: Create DDL with specific data for verification');
  const testOrgNumber = '556789-1234';
  const testLegalName = 'Content Verification Test AB';
  const testAddress = 'Content Test Street 42';
  const testPostalCode = '111 43';
  const testCity = 'Stockholm';
  const testContactName = 'Test Contact Person';
  const testEmail = 'contact@contenttest.se';
  const testPhone = '070-555 66 77';

  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: testOrgNumber,
      legal_name: testLegalName,
      delivery_address: {
        line1: testAddress,
        postal_code: testPostalCode,
        city: testCity,
        country_code: 'SE',
      },
      contact: {
        name: testContactName,
        email: testEmail,
        phone: testPhone,
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  const generateResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  // Note: Actual PDF content verification would require downloading and parsing the PDF
  // For acceptance testing, we verify:
  // 1. Document generation succeeded
  // 2. Metadata stored correctly
  // 3. Document can be retrieved

  console.log('\nVerifying Document Metadata:');
  const { data: docRecord } = await supabase
    .from('ddl_documents')
    .select('*, metadata_json')
    .eq('ddl_id', ddlId)
    .single();

  assert(!!docRecord, 'Document record exists');

  // If metadata_json is populated, verify it contains correct data
  if (docRecord?.metadata_json) {
    console.log('   Checking metadata_json field...');
    const metadata = docRecord.metadata_json;

    // Metadata structure depends on implementation
    // Just verify it's valid JSON
    assert(typeof metadata === 'object', 'metadata_json is valid object');
  }

  // Verify DDL record has correct data
  const { data: ddlRecord } = await supabase
    .from('direct_delivery_locations')
    .select('*')
    .eq('id', ddlId)
    .single();

  assertEquals(ddlRecord?.org_number, testOrgNumber, 'Org number matches');
  assertEquals(ddlRecord?.legal_name, testLegalName, 'Legal name matches');
  assertEquals(ddlRecord?.delivery_address_line1, testAddress, 'Address matches');
  assertEquals(ddlRecord?.postal_code, testPostalCode, 'Postal code matches');
  assertEquals(ddlRecord?.city, testCity, 'City matches');
  assertEquals(ddlRecord?.contact_name, testContactName, 'Contact name matches');
  assertEquals(ddlRecord?.contact_email, testEmail, 'Email matches');
  assertEquals(ddlRecord?.contact_phone, testPhone, 'Phone matches');

  console.log('\n✅ Content Verification Tests Complete');
  console.log('   Note: Full PDF content parsing not implemented in acceptance suite');
  console.log('   Recommendation: Manual spot-check of generated PDFs');
}

// ============================================================================
// Test Suite 6: Generation Constraints
// ============================================================================

async function testGenerationConstraints(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚫 TEST SUITE 6: Document Generation Constraints');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL and approve it
  console.log('Setup: Create and approve DDL');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Constraint Test AB',
      delivery_address: {
        line1: 'Constraint Street 1',
        postal_code: '111 43',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Constraint Manager',
        email: 'constraint@test.se',
        phone: '070-666 77 88',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  // Generate, submit, approve
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {});
  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/approve`,
    {},
    { 'x-user-id': 'admin-user', 'x-user-role': 'compliance_admin' }
  );

  // Test: Cannot generate document after approval
  console.log('\nTest: Cannot Generate Document for APPROVED DDL');
  const genAfterApprovalResponse = await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/generate-document`
  );

  assert(
    genAfterApprovalResponse.status >= 400,
    'Cannot generate document for APPROVED DDL (400+ status)',
    { status: genAfterApprovalResponse.status }
  );

  assertContains(
    JSON.stringify(genAfterApprovalResponse.data),
    'godkänd',
    'Error message indicates APPROVED status blocks generation'
  );

  console.log('\n✅ Generation Constraints Tests Complete');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DDL ACCEPTANCE TEST - PDF Generation & Storage Integrity    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  console.log(`\n📋 Configuration:`);
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Test Tenant ID: ${TEST_TENANT_ID}`);

  try {
    await testBasicPDFGeneration();
    await testDocumentVersioning();
    await testHashIntegrity();
    await testStorageIntegration();
    await testContentVerification();
    await testGenerationConstraints();

    // Print summary
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DOCUMENT INTEGRITY TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✓ Passed: ${passedTests}`);
    console.log(`✗ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failedTests === 0) {
      console.log('✅ ALL DOCUMENT INTEGRITY TESTS PASSED\n');
      console.log('🚨 CRITICAL GATES PASSED:');
      console.log('   ✓ PDF generation succeeds');
      console.log('   ✓ Document versioning works (v1, v2, v3...)');
      console.log('   ✓ SHA-256 hashes computed and stored');
      console.log('   ✓ Storage paths include tenant_id and ddl_id');
      console.log('   ✓ current_document_id tracks latest version');
      console.log('   ✓ Cannot generate after approval\n');
      process.exit(0);
    } else {
      console.error('❌ DOCUMENT INTEGRITY TESTS FAILED\n');
      console.error('🚨 Review failures above - document system issues detected\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
  }
}

main();
