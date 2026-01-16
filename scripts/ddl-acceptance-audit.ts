/**
 * DDL Acceptance Test - Audit Trail Completeness
 *
 * Run: npx tsx scripts/ddl-acceptance-audit.ts
 *
 * Tests:
 *   - Every status change creates exactly one audit event
 *   - Audit events are immutable (append-only)
 *   - All required fields captured (who, what, when, why)
 *   - Event ordering is correct
 *   - No orphaned events
 */

import { createClient } from '@supabase/supabase-js';

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
const TEST_TENANT_ID = 'audit-tenant-' + Date.now();
const TEST_RESTAURANT_ID = 'audit-restaurant-' + Date.now();
const TEST_IMPORTER_ID = 'audit-importer-' + Date.now();
const TEST_USER_ID = 'audit-user-' + Date.now();
const TEST_ADMIN_ID = 'audit-admin-' + Date.now();

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

async function getAuditEvents(ddlId: string): Promise<any[]> {
  const { data } = await supabase
    .from('ddl_status_events')
    .select('*')
    .eq('ddl_id', ddlId)
    .order('created_at', { ascending: true });

  return data || [];
}

// ============================================================================
// Test Suite 1: 1:1 Event-to-Status-Change Mapping
// ============================================================================

async function testEventStatusMapping(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 TEST SUITE 1: 1:1 Event-to-Status-Change Mapping');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL
  console.log('Setup: Create DDL (no event expected - initial creation)');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Audit Test Restaurant AB',
      delivery_address: {
        line1: 'Audit Street 1',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Audit Test Manager',
        email: 'audit@test.se',
        phone: '070-111 11 11',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  // Generate document (no status change, no event expected)
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);

  // Check events after creation and document generation
  let events = await getAuditEvents(ddlId);
  assertEquals(
    events.length,
    0,
    '🚨 CRITICAL: No events before first status transition (still NOT_REGISTERED)'
  );

  // Test 1: Submit creates exactly ONE event
  console.log('\nTest 1: Submit Creates Exactly One Event');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'Test submission',
  });

  events = await getAuditEvents(ddlId);
  assertEquals(events.length, 1, '🚨 CRITICAL: Submit creates exactly 1 event');

  if (events[0]) {
    assertEquals(events[0].from_status, 'NOT_REGISTERED', 'Event from_status is NOT_REGISTERED');
    assertEquals(events[0].to_status, 'SUBMITTED', 'Event to_status is SUBMITTED');
    assertEquals(events[0].changed_by_user_id, TEST_USER_ID, 'Event has correct user_id');
    assert(!!events[0].created_at, 'Event has timestamp');
    assertEquals(events[0].ddl_id, ddlId, 'Event linked to DDL');
    assertEquals(events[0].tenant_id, TEST_TENANT_ID, 'Event has tenant_id');
  }

  // Test 2: Approve creates exactly ONE MORE event (total 2)
  console.log('\nTest 2: Approve Creates Exactly One More Event (Total 2)');
  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/approve`,
    { note: 'Approved for testing' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  events = await getAuditEvents(ddlId);
  assertEquals(events.length, 2, '🚨 CRITICAL: Approve creates exactly 1 more event (total 2)');

  if (events[1]) {
    assertEquals(events[1].from_status, 'SUBMITTED', 'Event from_status is SUBMITTED');
    assertEquals(events[1].to_status, 'APPROVED', 'Event to_status is APPROVED');
    assertEquals(events[1].changed_by_user_id, TEST_ADMIN_ID, 'Event has admin user_id');
    assert(!!events[1].note, 'Event has note');
  }

  console.log('\n✅ Event-Status Mapping Tests Complete');
}

// ============================================================================
// Test Suite 2: Complete Workflow Audit Trail
// ============================================================================

async function testCompleteWorkflowAudit(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 TEST SUITE 2: Complete Workflow Audit Trail');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL
  console.log('Workflow Step 1: Create DDL');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Workflow Test AB',
      delivery_address: {
        line1: 'Workflow Street 1',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Workflow Manager',
        email: 'workflow@test.se',
        phone: '070-222 22 22',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;

  // Generate document
  console.log('Workflow Step 2: Generate Document');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);

  // Submit
  console.log('Workflow Step 3: Submit');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'Ready for compliance review',
  });

  // Reject
  console.log('Workflow Step 4: Reject');
  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/reject`,
    { note: 'Org number verification needed' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  // Reset to NOT_REGISTERED
  console.log('Workflow Step 5: Reset to NOT_REGISTERED');
  await supabase
    .from('direct_delivery_locations')
    .update({ status: 'NOT_REGISTERED' })
    .eq('id', ddlId);

  // Create status event for reset (simulate API behavior)
  await supabase.from('ddl_status_events').insert({
    tenant_id: TEST_TENANT_ID,
    ddl_id: ddlId,
    from_status: 'REJECTED',
    to_status: 'NOT_REGISTERED',
    note: 'Reset for resubmission',
    changed_by_user_id: TEST_USER_ID,
  });

  // Regenerate document
  console.log('Workflow Step 6: Regenerate Document (v2)');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);

  // Resubmit
  console.log('Workflow Step 7: Resubmit');
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'Resubmission with corrections',
  });

  // Approve
  console.log('Workflow Step 8: Approve');
  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/approve`,
    { note: 'Verified and approved' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  // Verify complete audit trail
  console.log('\nVerifying Complete Audit Trail');
  const events = await getAuditEvents(ddlId);

  assertEquals(
    events.length,
    5,
    '🚨 CRITICAL: Complete workflow creates exactly 5 events'
  );

  const expectedTransitions = [
    { from: 'NOT_REGISTERED', to: 'SUBMITTED' },
    { from: 'SUBMITTED', to: 'REJECTED' },
    { from: 'REJECTED', to: 'NOT_REGISTERED' },
    { from: 'NOT_REGISTERED', to: 'SUBMITTED' },
    { from: 'SUBMITTED', to: 'APPROVED' },
  ];

  console.log('\nVerifying Transition Sequence:');
  expectedTransitions.forEach((expected, index) => {
    if (events[index]) {
      assertEquals(
        events[index].from_status,
        expected.from,
        `Event ${index + 1}: from_status = ${expected.from}`
      );
      assertEquals(
        events[index].to_status,
        expected.to,
        `Event ${index + 1}: to_status = ${expected.to}`
      );
    }
  });

  console.log('\n✅ Complete Workflow Audit Tests Complete');
}

// ============================================================================
// Test Suite 3: Event Field Completeness
// ============================================================================

async function testEventFieldCompleteness(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 TEST SUITE 3: Event Field Completeness');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create and transition DDL
  console.log('Setup: Create and submit DDL');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Field Test AB',
      delivery_address: {
        line1: 'Field Test Street',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Field Test Manager',
        email: 'field@test.se',
        phone: '070-333 33 33',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);

  const testNote = 'This is a test submission note with special chars: åäö';
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: testNote,
  });

  const events = await getAuditEvents(ddlId);
  const event = events[0];

  console.log('Verifying Required Fields:');

  // Test required fields
  assert(!!event.id, 'Event has UUID id');
  assert(!!event.tenant_id, 'Event has tenant_id');
  assertEquals(event.tenant_id, TEST_TENANT_ID, 'Event tenant_id matches');
  assert(!!event.ddl_id, 'Event has ddl_id');
  assertEquals(event.ddl_id, ddlId, 'Event ddl_id matches');
  assert(!!event.from_status, 'Event has from_status');
  assert(!!event.to_status, 'Event has to_status');
  assert(!!event.changed_by_user_id, 'Event has changed_by_user_id');
  assertEquals(event.changed_by_user_id, TEST_USER_ID, 'Event user_id matches');
  assert(!!event.created_at, 'Event has created_at timestamp');

  // Test optional note field
  assert(!!event.note, 'Event has note when provided');
  assertEquals(event.note, testNote, 'Event note matches including special characters');

  // Test timestamp is valid
  const timestamp = new Date(event.created_at);
  const now = new Date();
  const timeDiff = now.getTime() - timestamp.getTime();
  assert(
    timeDiff >= 0 && timeDiff < 60000,
    'Event timestamp is recent (within last 60 seconds)'
  );

  console.log('\n✅ Event Field Completeness Tests Complete');
}

// ============================================================================
// Test Suite 4: Event Immutability
// ============================================================================

async function testEventImmutability(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔒 TEST SUITE 4: Event Immutability (Append-Only)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL and generate event
  console.log('Setup: Create DDL and submit to generate event');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Immutability Test AB',
      delivery_address: {
        line1: 'Immutability Street',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Immutability Manager',
        email: 'immutable@test.se',
        phone: '070-444 44 44',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'Original note',
  });

  const events = await getAuditEvents(ddlId);
  const eventId = events[0].id;
  const originalNote = events[0].note;

  // Test 1: Cannot UPDATE event
  console.log('\nTest 1: Cannot Update Event');
  const { error: updateError } = await supabase
    .from('ddl_status_events')
    .update({ note: 'Tampered note' })
    .eq('id', eventId);

  assert(
    !!updateError,
    '🚨 CRITICAL: Cannot update event (RLS blocks)',
    { error: updateError?.message }
  );

  // Verify note unchanged
  const { data: unchangedEvent } = await supabase
    .from('ddl_status_events')
    .select('note')
    .eq('id', eventId)
    .single();

  assertEquals(unchangedEvent?.note, originalNote, 'Event note unchanged after failed update');

  // Test 2: Cannot DELETE event
  console.log('\nTest 2: Cannot Delete Event');
  const { error: deleteError } = await supabase
    .from('ddl_status_events')
    .delete()
    .eq('id', eventId);

  assert(
    !!deleteError,
    '🚨 CRITICAL: Cannot delete event (RLS blocks)',
    { error: deleteError?.message }
  );

  // Verify event still exists
  const { data: stillExists } = await supabase
    .from('ddl_status_events')
    .select('id')
    .eq('id', eventId)
    .single();

  assert(!!stillExists, 'Event still exists after failed delete');

  // Test 3: Cannot modify from_status
  console.log('\nTest 3: Cannot Modify from_status');
  const { error: modifyFromError } = await supabase
    .from('ddl_status_events')
    .update({ from_status: 'APPROVED' })
    .eq('id', eventId);

  assert(
    !!modifyFromError,
    '🚨 CRITICAL: Cannot modify from_status',
    { error: modifyFromError?.message }
  );

  // Test 4: Cannot modify to_status
  console.log('\nTest 4: Cannot Modify to_status');
  const { error: modifyToError } = await supabase
    .from('ddl_status_events')
    .update({ to_status: 'REJECTED' })
    .eq('id', eventId);

  assert(
    !!modifyToError,
    '🚨 CRITICAL: Cannot modify to_status',
    { error: modifyToError?.message }
  );

  console.log('\n✅ Event Immutability Tests Complete');
}

// ============================================================================
// Test Suite 5: Event Ordering & Consistency
// ============================================================================

async function testEventOrdering(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 TEST SUITE 5: Event Ordering & Consistency');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create DDL and perform multiple transitions
  console.log('Setup: Create DDL and perform transitions');
  const createResponse = await apiCall(
    'POST',
    `/api/restaurants/${TEST_RESTAURANT_ID}/direct-delivery-locations`,
    {
      importer_id: TEST_IMPORTER_ID,
      org_number: '556789-1234',
      legal_name: 'Ordering Test AB',
      delivery_address: {
        line1: 'Ordering Street',
        postal_code: '11143',
        city: 'Stockholm',
        country_code: 'SE',
      },
      contact: {
        name: 'Ordering Manager',
        email: 'ordering@test.se',
        phone: '070-555 55 55',
      },
      consent_given: true,
    }
  );

  const ddlId = createResponse.data.ddl_id;
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/generate-document`);

  // Perform transitions with delays to ensure ordering
  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'First submission',
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  await apiCall(
    'POST',
    `/api/direct-delivery-locations/${ddlId}/reject`,
    { note: 'First rejection' },
    { 'x-user-id': TEST_ADMIN_ID, 'x-user-role': 'compliance_admin' }
  );

  await new Promise((resolve) => setTimeout(resolve, 100));

  // Reset and resubmit
  await supabase
    .from('direct_delivery_locations')
    .update({ status: 'NOT_REGISTERED' })
    .eq('id', ddlId);

  await supabase.from('ddl_status_events').insert({
    tenant_id: TEST_TENANT_ID,
    ddl_id: ddlId,
    from_status: 'REJECTED',
    to_status: 'NOT_REGISTERED',
    note: 'Reset',
    changed_by_user_id: TEST_USER_ID,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  await apiCall('POST', `/api/direct-delivery-locations/${ddlId}/submit`, {
    note: 'Second submission',
  });

  // Verify ordering
  console.log('\nVerifying Event Order:');
  const events = await getAuditEvents(ddlId);

  // Test 1: Events ordered by created_at
  for (let i = 1; i < events.length; i++) {
    const prevTimestamp = new Date(events[i - 1].created_at);
    const currTimestamp = new Date(events[i].created_at);

    assert(
      currTimestamp >= prevTimestamp,
      `Event ${i + 1} timestamp >= Event ${i} timestamp (chronological order)`
    );
  }

  // Test 2: Status transition chain is valid
  console.log('\nVerifying Status Transition Chain:');
  for (let i = 1; i < events.length; i++) {
    assertEquals(
      events[i].from_status,
      events[i - 1].to_status,
      `Event ${i + 1} from_status matches Event ${i} to_status (valid chain)`
    );
  }

  // Test 3: First event from_status matches initial DDL status
  const { data: ddl } = await supabase
    .from('direct_delivery_locations')
    .select('created_at')
    .eq('id', ddlId)
    .single();

  assertEquals(
    events[0].from_status,
    'NOT_REGISTERED',
    'First event from_status matches initial DDL status'
  );

  console.log('\n✅ Event Ordering Tests Complete');
}

// ============================================================================
// Test Suite 6: No Orphaned Events
// ============================================================================

async function testNoOrphanedEvents(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 TEST SUITE 6: No Orphaned Events');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Query all events
  console.log('Checking for orphaned events in database...');
  const { data: orphanedEvents } = await supabase.rpc('check_orphaned_ddl_events');

  // If RPC doesn't exist, do manual check
  const { data: allEvents } = await supabase
    .from('ddl_status_events')
    .select('id, ddl_id')
    .eq('tenant_id', TEST_TENANT_ID);

  if (!allEvents) {
    console.log('  ⚠ No events found for this tenant');
    return;
  }

  let orphanCount = 0;
  for (const event of allEvents) {
    const { data: ddl } = await supabase
      .from('direct_delivery_locations')
      .select('id')
      .eq('id', event.ddl_id)
      .single();

    if (!ddl) {
      orphanCount++;
      console.error(`  ✗ Orphaned event found: ${event.id} (ddl_id: ${event.ddl_id})`);
    }
  }

  assertEquals(
    orphanCount,
    0,
    '🚨 CRITICAL: No orphaned events (all events linked to existing DDLs)'
  );

  console.log(`  Checked ${allEvents.length} event(s) - all properly linked`);
  console.log('\n✅ No Orphaned Events Tests Complete');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DDL ACCEPTANCE TEST - Audit Trail Completeness              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  console.log(`\n📋 Configuration:`);
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Test Tenant ID: ${TEST_TENANT_ID}`);

  try {
    await testEventStatusMapping();
    await testCompleteWorkflowAudit();
    await testEventFieldCompleteness();
    await testEventImmutability();
    await testEventOrdering();
    await testNoOrphanedEvents();

    // Print summary
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 AUDIT TRAIL TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✓ Passed: ${passedTests}`);
    console.log(`✗ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failedTests === 0) {
      console.log('✅ ALL AUDIT TRAIL TESTS PASSED - Complete event tracking\n');
      console.log('🚨 CRITICAL GATES PASSED:');
      console.log('   ✓ 1:1 mapping between status changes and events');
      console.log('   ✓ Events are immutable (append-only)');
      console.log('   ✓ All required fields captured');
      console.log('   ✓ Event ordering is correct');
      console.log('   ✓ No orphaned events\n');
      process.exit(0);
    } else {
      console.error('❌ AUDIT TRAIL TESTS FAILED - Compliance risk\n');
      console.error('🚨 DO NOT DEPLOY - Fix audit trail issues immediately\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
  }
}

main();
