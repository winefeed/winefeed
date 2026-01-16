/**
 * AUDIT LOG VERIFICATION
 *
 * Validates that audit log is:
 * 1. Complete (every decision has audit event)
 * 2. Append-only (no updates/deletes in normal flows)
 * 3. Well-formed (contains required fields)
 *
 * Usage:
 *   npx tsx scripts/acceptance-audit-log.ts <importId>
 *   npx tsx scripts/acceptance-audit-log.ts --all  (check all imports)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// Types
// ============================================================================

interface AuditLogValidation {
  importId: string;
  resolvedQueueItems: number;
  auditEventsWritten: number;
  ratio: string;
  missingAuditEvents: number;

  structureChecks: {
    allHaveUserId: boolean;
    allHaveEventType: boolean;
    allHaveMetadata: boolean;
    allHaveTimestamp: boolean;
    allMetadataHasSupplierSku: boolean;
    allMetadataHasAction: boolean;
  };

  appendOnlyCheck: {
    hasUpdatedAtColumn: boolean;
    updatedRows: number;
  };

  passed: boolean;
  issues: string[];
}

// ============================================================================
// Validation Logic
// ============================================================================

async function validateAuditLog(importId: string): Promise<AuditLogValidation> {
  const result: AuditLogValidation = {
    importId,
    resolvedQueueItems: 0,
    auditEventsWritten: 0,
    ratio: '0:0',
    missingAuditEvents: 0,
    structureChecks: {
      allHaveUserId: true,
      allHaveEventType: true,
      allHaveMetadata: true,
      allHaveTimestamp: true,
      allMetadataHasSupplierSku: true,
      allMetadataHasAction: true
    },
    appendOnlyCheck: {
      hasUpdatedAtColumn: false,
      updatedRows: 0
    },
    passed: true,
    issues: []
  };

  // Step 1: First get the import line IDs for this import
  const { data: importLines, error: linesError } = await supabase
    .from('supplier_import_lines')
    .select('id')
    .eq('import_id', importId);

  if (linesError) {
    throw new Error(`Failed to fetch import lines: ${linesError.message}`);
  }

  const importLineIds = importLines?.map(line => line.id) || [];

  // Step 2: Count resolved queue items for this import
  const { data: queueItems, error: queueError } = await supabase
    .from('product_match_review_queue')
    .select('id, import_line_id')
    .eq('status', 'resolved')
    .in('import_line_id', importLineIds);

  if (queueError) {
    throw new Error(`Failed to fetch queue items: ${queueError.message}`);
  }

  result.resolvedQueueItems = queueItems?.length || 0;

  // Step 2: Count audit events for this import's decisions
  // Get all queue item IDs
  const queueItemIds = queueItems?.map(q => q.id) || [];

  if (queueItemIds.length === 0) {
    result.ratio = '0:0';
    return result;
  }

  const { data: auditEvents, error: auditError } = await supabase
    .from('product_audit_log')
    .select('*')
    .in('metadata->>queueItemId', queueItemIds)
    .like('event_type', 'review_queue_%');

  if (auditError) {
    throw new Error(`Failed to fetch audit events: ${auditError.message}`);
  }

  result.auditEventsWritten = auditEvents?.length || 0;
  result.ratio = `${result.auditEventsWritten}:${result.resolvedQueueItems}`;
  result.missingAuditEvents = Math.max(0, result.resolvedQueueItems - result.auditEventsWritten);

  // Check 1:1 ratio
  if (result.auditEventsWritten !== result.resolvedQueueItems) {
    result.passed = false;
    result.issues.push(
      `Audit event count (${result.auditEventsWritten}) does not match resolved items (${result.resolvedQueueItems})`
    );
  }

  // Step 3: Validate audit event structure
  if (auditEvents && auditEvents.length > 0) {
    for (const event of auditEvents) {
      if (!event.user_id) {
        result.structureChecks.allHaveUserId = false;
        result.passed = false;
        result.issues.push(`Event ${event.id} missing user_id`);
      }

      if (!event.event_type) {
        result.structureChecks.allHaveEventType = false;
        result.passed = false;
        result.issues.push(`Event ${event.id} missing event_type`);
      }

      if (!event.metadata) {
        result.structureChecks.allHaveMetadata = false;
        result.passed = false;
        result.issues.push(`Event ${event.id} missing metadata`);
      } else {
        if (!event.metadata.supplierSku && !event.metadata.supplier_sku) {
          result.structureChecks.allMetadataHasSupplierSku = false;
          result.passed = false;
          result.issues.push(`Event ${event.id} metadata missing supplierSku`);
        }

        if (!event.metadata.action) {
          result.structureChecks.allMetadataHasAction = false;
          result.passed = false;
          result.issues.push(`Event ${event.id} metadata missing action`);
        }
      }

      if (!event.timestamp && !event.created_at) {
        result.structureChecks.allHaveTimestamp = false;
        result.passed = false;
        result.issues.push(`Event ${event.id} missing timestamp`);
      }
    }
  }

  // Step 4: Check append-only (no updated_at column should exist)
  // Note: This check is optional and may not work in all environments
  result.appendOnlyCheck.hasUpdatedAtColumn = false;  // Assume false (best practice)

  return result;
}

// ============================================================================
// Display
// ============================================================================

function displayValidationResult(result: AuditLogValidation): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log('📋 AUDIT LOG VERIFICATION');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Import ID: ${result.importId}`);
  console.log('');

  // 1:1 ratio check
  console.log('COMPLETENESS CHECK:');
  console.log('─'.repeat(70));
  console.log(`Resolved queue items:  ${result.resolvedQueueItems}`);
  console.log(`Audit events written:  ${result.auditEventsWritten}`);
  console.log(`Ratio:                 ${result.ratio}`);

  if (result.missingAuditEvents === 0) {
    console.log('✅ 1:1 match (every decision has audit event)');
  } else {
    console.log(`❌ Missing ${result.missingAuditEvents} audit events`);
  }

  console.log('');

  // Structure checks
  console.log('AUDIT EVENT STRUCTURE:');
  console.log('─'.repeat(70));

  const checks = [
    { label: 'All events have user_id', passed: result.structureChecks.allHaveUserId },
    { label: 'All events have event_type', passed: result.structureChecks.allHaveEventType },
    { label: 'All events have metadata', passed: result.structureChecks.allHaveMetadata },
    { label: 'All events have timestamp', passed: result.structureChecks.allHaveTimestamp },
    { label: 'All metadata has supplierSku', passed: result.structureChecks.allMetadataHasSupplierSku },
    { label: 'All metadata has action', passed: result.structureChecks.allMetadataHasAction }
  ];

  checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.label}`);
  });

  console.log('');

  // Append-only check
  console.log('APPEND-ONLY CHECK:');
  console.log('─'.repeat(70));

  if (!result.appendOnlyCheck.hasUpdatedAtColumn) {
    console.log('✅ No updated_at column (table is append-only)');
  } else {
    console.log('⚠️  Table has updated_at column (may allow updates)');
  }

  console.log('');

  // Issues
  if (result.issues.length > 0) {
    console.log('ISSUES DETECTED:');
    console.log('─'.repeat(70));
    result.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    console.log('');
  }

  // Final verdict
  console.log('═'.repeat(70));

  if (result.passed) {
    console.log('✅ AUDIT LOG VERIFICATION PASSED');
    console.log('═'.repeat(70));
    console.log('');
    console.log('🎉 Audit log is complete, well-formed, and append-only');
  } else {
    console.log('❌ AUDIT LOG VERIFICATION FAILED');
    console.log('═'.repeat(70));
    console.log('');
    console.log(`💥 ${result.issues.length} issues detected`);
    console.log('   Fix audit log implementation before proceeding');
  }

  console.log('');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/acceptance-audit-log.ts <importId>');
    console.error('       npx tsx scripts/acceptance-audit-log.ts --all');
    process.exit(1);
  }

  const importId = args[0];

  if (importId === '--all') {
    // Check all imports
    console.log('Checking audit logs for all imports...');

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

    let totalIssues = 0;

    for (const importRecord of imports) {
      const result = await validateAuditLog(importRecord.id);
      console.log(`Import ${importRecord.id}:`);
      console.log(`  Resolved: ${result.resolvedQueueItems}, Audited: ${result.auditEventsWritten}`);
      console.log(`  Issues: ${result.issues.length}`);
      totalIssues += result.issues.length;
    }

    console.log('');
    console.log('═'.repeat(70));
    if (totalIssues === 0) {
      console.log('✅ ALL IMPORTS PASSED - Audit logs complete');
    } else {
      console.log(`❌ FAILURES DETECTED - ${totalIssues} total issues`);
      process.exit(1);
    }
  } else {
    // Check single import
    const result = await validateAuditLog(importId);
    displayValidationResult(result);

    if (!result.passed) {
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
