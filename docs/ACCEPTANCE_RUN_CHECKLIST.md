# Phase 1 Acceptance Run - Checklist

**Purpose:** Validate Phase 1 vertical slice is production-safe and ready for deployment.

**Target:** CSV import → match → review queue → decisions (with safety guarantees)

---

## ✅ Pre-Flight: Database Verification

### Run SQL Verification Queries

```bash
# Run all verification queries
psql $DATABASE_URL -f scripts/sql/verify-phase1-constraints.sql
```

**Expected Output:**
- ✅ All required tables exist (7 checks pass)
- ✅ All unique constraints present (4 checks pass)
- ✅ All indexes present (8 checks pass)
- ✅ Zero duplicate mappings (0 rows)
- ✅ Zero duplicate queue items (0 rows)

**Gate 1: PASS if all checks return expected results. FAIL if any constraint/index missing.**

---

## ✅ Step 1: Upload CSV Import

```bash
curl -X POST http://localhost:3000/api/suppliers/test-supplier-id/imports \
  -F "file=@./data/test-samples/acceptance-test.csv"
```

**Expected Response:**
```json
{
  "importId": "<UUID>",
  "supplierId": "test-supplier-id",
  "filename": "acceptance-test.csv",
  "totalLines": 50,
  "status": "PARSED"
}
```

**Validation Queries:**
```sql
-- Check import record created
SELECT id, supplier_id, status, total_lines
FROM supplier_imports
WHERE id = '<importId>';

-- Check lines inserted (should be 50)
SELECT COUNT(*)
FROM supplier_import_lines
WHERE import_id = '<importId>';

-- Check all lines have PENDING status
SELECT COUNT(*)
FROM supplier_import_lines
WHERE import_id = '<importId>' AND match_status = 'PENDING';
```

**Gate 2: PASS if import status = PARSED, total_lines = 50, all lines PENDING.**

---

## ✅ Step 2: Run Matching

```bash
curl -X POST http://localhost:3000/api/imports/<importId>/match
```

**Expected Response:**
```json
{
  "importId": "<UUID>",
  "status": "MATCHED",
  "summary": {
    "totalLines": 50,
    "autoMatched": 30,
    "samplingReview": 5,
    "needsReview": 10,
    "noMatch": 5,
    "errors": 0,
    "autoMatchedPercent": "60.0",
    "needsReviewPercent": "20.0",
    "noMatchPercent": "10.0"
  }
}
```

**Validation Queries:**
```sql
-- Check import status updated
SELECT status, auto_matched, sampling_review, needs_review, no_match, errors
FROM supplier_imports
WHERE id = '<importId>';

-- Check line statuses distributed correctly
SELECT match_status, COUNT(*)
FROM supplier_import_lines
WHERE import_id = '<importId>'
GROUP BY match_status;

-- Check AUTO_MATCHED lines have mappings created
SELECT COUNT(*)
FROM supplier_product_mappings spm
JOIN supplier_import_lines sil ON sil.supplier_sku = spm.supplier_sku
WHERE sil.import_id = '<importId>' AND sil.match_status = 'AUTO_MATCHED';

-- Check NEEDS_REVIEW lines added to queue
SELECT COUNT(*)
FROM product_match_review_queue
WHERE import_line_id IN (
  SELECT id FROM supplier_import_lines
  WHERE import_id = '<importId>' AND match_status = 'NEEDS_REVIEW'
);
```

**Gate 3: PASS if:**
- Import status = MATCHED
- Sum of decision counts = totalLines
- AUTO_MATCHED count = mappings created
- NEEDS_REVIEW count = queue items inserted
- errors = 0

---

## ✅ Step 3: Fetch Review Queue

```bash
curl "http://localhost:3000/api/admin/review-queue?importId=<importId>&status=pending&limit=50"
```

**Expected Response:**
```json
{
  "items": [
    {
      "queueItemId": "<UUID>",
      "status": "pending",
      "supplier": { "id": "test-supplier-id", "name": "Test Supplier" },
      "line": {
        "supplierSku": "TEST-001",
        "producerName": "Test Producer",
        "productName": "Test Product",
        "vintage": 2020,
        "volumeMl": 750,
        "packType": "bottle"
      },
      "matchMetadata": {
        "confidenceScore": 75,
        "reasons": ["PRODUCER_EXACT", "PRODUCT_FUZZY_STRONG"],
        "guardrailFailures": []
      },
      "candidates": [
        {
          "id": "wf-prod-123",
          "type": "master_product",
          "score": 85,
          "reasons": ["PRODUCER_EXACT", "PRODUCT_EXACT"],
          "reasonSummary": "Producer match • Product match"
        }
      ]
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Validation:**
- Total matches needsReview count from Step 2
- All items have status = "pending"
- All items have at least 1 candidate

**Gate 4: PASS if pagination.total matches needsReview count, all items well-formed.**

---

## ✅ Step 4: Approve Match (Human Decision)

```bash
curl -X POST http://localhost:3000/api/admin/review-queue/<queueItemId>/decision \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve_match",
    "selectedId": "wf-prod-123",
    "comment": "Acceptance test - verified match",
    "reviewedBy": "acceptance-test-user"
  }'
```

**Expected Response:**
```json
{
  "queueItemId": "<UUID>",
  "status": "resolved",
  "action": "approve_match",
  "mapping": {
    "mappingId": "<UUID>",
    "masterProductId": "wf-prod-123",
    "matchConfidence": 1.0,
    "matchMethod": "human_review"
  },
  "auditEventId": "<UUID>",
  "message": "Successfully approved match"
}
```

**Validation Queries:**
```sql
-- Check queue item marked resolved
SELECT status, resolved_at, resolved_by, resolution_action
FROM product_match_review_queue
WHERE id = '<queueItemId>';

-- Check mapping created
SELECT *
FROM supplier_product_mappings
WHERE id = '<mappingId>';

-- Check audit event written
SELECT *
FROM product_audit_log
WHERE id = '<auditEventId>';

-- Check import line updated
SELECT match_status, matched_product_id
FROM supplier_import_lines
WHERE id = (
  SELECT import_line_id FROM product_match_review_queue WHERE id = '<queueItemId>'
);
```

**Gate 5: PASS if:**
- Queue item status = resolved
- Mapping created with match_confidence = 1.0, match_method = 'human_review'
- Audit event exists with event_type = 'review_queue_approve_match'
- Import line updated with matched_product_id

---

## ✅ Step 5: Idempotency Check - Re-run Matching

```bash
# Re-run the SAME import matching
curl -X POST http://localhost:3000/api/imports/<importId>/match
```

**Expected Response:**
```json
{
  "importId": "<UUID>",
  "status": "MATCHED",
  "summary": {
    "totalLines": 50,
    "autoMatched": 30,
    "samplingReview": 5,
    "needsReview": 10,
    "noMatch": 5,
    "errors": 0
  },
  "message": "Import already matched (idempotent)"
}
```

**Validation Queries:**
```sql
-- Check no duplicate queue items created
SELECT import_line_id, COUNT(*) as duplicate_count
FROM product_match_review_queue
WHERE import_line_id IN (
  SELECT id FROM supplier_import_lines WHERE import_id = '<importId>'
)
GROUP BY import_line_id
HAVING COUNT(*) > 1;
-- MUST return 0 rows

-- Check no duplicate mappings created
SELECT supplier_id, supplier_sku, COUNT(*) as duplicate_count
FROM supplier_product_mappings
GROUP BY supplier_id, supplier_sku
HAVING COUNT(*) > 1;
-- MUST return 0 rows

-- Check import summary unchanged
SELECT auto_matched, sampling_review, needs_review, no_match
FROM supplier_imports
WHERE id = '<importId>';
-- Values should match Step 2
```

**Gate 6: PASS if:**
- Response includes "idempotent" message
- Zero duplicate queue items
- Zero duplicate mappings
- Summary statistics unchanged

---

## ✅ Step 6: Idempotency Check - Re-approve Same Decision

```bash
# Re-approve the SAME queue item
curl -X POST http://localhost:3000/api/admin/review-queue/<queueItemId>/decision \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve_match",
    "selectedId": "wf-prod-123",
    "comment": "Duplicate approval attempt",
    "reviewedBy": "acceptance-test-user"
  }'
```

**Expected Response:**
```json
{
  "queueItemId": "<UUID>",
  "status": "resolved",
  "message": "Queue item already resolved (idempotent)",
  "existingMapping": {
    "id": "<mappingId>",
    "supplier_sku": "TEST-001",
    "master_product_id": "wf-prod-123"
  }
}
```

**Validation Queries:**
```sql
-- Check only ONE mapping exists for this SKU
SELECT COUNT(*)
FROM supplier_product_mappings
WHERE supplier_id = 'test-supplier-id' AND supplier_sku = 'TEST-001';
-- MUST return 1

-- Check audit log has exactly 1 approval event (not 2)
SELECT COUNT(*)
FROM product_audit_log
WHERE metadata->>'queueItemId' = '<queueItemId>'
  AND event_type = 'review_queue_approve_match';
-- Should return 1 (no duplicate audit events)
```

**Gate 7: PASS if:**
- Response includes "idempotent" message
- Only 1 mapping exists for the SKU
- Only 1 audit event for this queue item

---

## ✅ Step 7: Wrong-Bottle Safety Gate

```bash
npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>
```

**Expected Output:**
```
🛡️  WRONG-BOTTLE SAFETY GATE
═══════════════════════════════════════════════════════════════════

✅ PASS: Volume mismatches (0 violations)
✅ PASS: Pack mismatches (0 violations)
✅ PASS: Units per case mismatches (0 violations)
✅ PASS: Vintage mismatches in AUTO_MATCH (0 violations)
✅ PASS: ABV mismatches >0.5% (0 violations)

⚠️  RISK FLAGS:
  - Missing vintage → vintage-specific match: 0
  - Fuzzy ≥90 without GTIN/SKU: 0

═══════════════════════════════════════════════════════════════════
✅ SAFETY GATE PASSED - No wrong-bottle matches detected
```

**Gate 8: PASS if all violation counts = 0. FAIL if any violations detected.**

---

## ✅ Step 8: Missing Vintage → Family Logic

```bash
npx tsx scripts/acceptance-family-logic.ts
```

**Test Scenario:**
1. Upload CSV with line having `vintage = null`
2. Run matching
3. Verify decision is REVIEW_QUEUE (not AUTO_MATCH)
4. Verify candidate is ProductFamily (not vintage-specific MasterProduct)
5. Approve as family
6. Verify mapping has `product_family_id` (not `master_product_id`)

**Expected Output:**
```
🧪 FAMILY LOGIC TEST
═══════════════════════════════════════════════════════════════════

✅ Line with missing vintage routes to REVIEW_QUEUE
✅ Candidate type = 'product_family'
✅ Decision endpoint accepts approve_family action
✅ Mapping created with product_family_id (not master_product_id)
✅ Audit event type = 'review_queue_approve_family'

═══════════════════════════════════════════════════════════════════
✅ FAMILY LOGIC TEST PASSED
```

**Gate 9: PASS if all checks pass.**

---

## ✅ Step 9: Audit Log Verification

```bash
npx tsx scripts/acceptance-audit-log.ts <importId>
```

**Validation:**
- Every resolved queue item has 1 audit event
- Audit events are append-only (no updates/deletes)
- Audit events contain: user_id, action, supplier_sku, selectedId, timestamp

**Expected Output:**
```
📋 AUDIT LOG VERIFICATION
═══════════════════════════════════════════════════════════════════

Resolved queue items: 10
Audit events written: 10
✅ 1:1 match (every decision has audit event)

Audit event structure check:
✅ All events have user_id
✅ All events have event_type
✅ All events have metadata.supplierSku
✅ All events have metadata.selectedId
✅ All events have timestamp

Append-only check:
✅ No updated_at column present (table is append-only)

═══════════════════════════════════════════════════════════════════
✅ AUDIT LOG VERIFICATION PASSED
```

**Gate 10: PASS if resolved count = audit event count, structure valid.**

---

## ✅ Step 10: Metrics Endpoint (Optional)

```bash
curl "http://localhost:3000/api/imports/<importId>/metrics"
```

**Expected Response:**
```json
{
  "importId": "<UUID>",
  "metrics": {
    "totalLines": 50,
    "autoMatchRate": 0.60,
    "samplingReviewRate": 0.10,
    "reviewQueueSize": 10,
    "noMatchRate": 0.10,
    "errorRate": 0.00,
    "topReasons": [
      { "code": "GTIN_EXACT", "count": 25, "percent": 50.0 },
      { "code": "PRODUCER_EXACT", "count": 20, "percent": 40.0 },
      { "code": "VINTAGE_EXACT", "count": 18, "percent": 36.0 }
    ],
    "topGuardrailFailures": [
      { "reason": "VOLUME_MISMATCH", "count": 5, "percent": 10.0 }
    ]
  }
}
```

**Gate 11: PASS if metrics match summary from Step 2.**

---

## 📊 Final Acceptance Summary

**All Gates Must Pass:**
- ✅ Gate 1: Database constraints verified
- ✅ Gate 2: CSV upload successful
- ✅ Gate 3: Matching completed with correct distribution
- ✅ Gate 4: Review queue fetched
- ✅ Gate 5: Decision approved with mapping + audit
- ✅ Gate 6: Re-run matching is idempotent
- ✅ Gate 7: Re-approve decision is idempotent
- ✅ Gate 8: Wrong-bottle safety gate passed (0 violations)
- ✅ Gate 9: Family logic validated
- ✅ Gate 10: Audit log verified (1:1 with decisions)
- ✅ Gate 11: Metrics endpoint accurate

**Production Readiness:**
- If ALL gates pass → ✅ Ready for production
- If ANY gate fails → ❌ Block deployment, investigate failure

---

## 🚨 Known Failure Modes

### Gate 3 Failure: Matching Errors
**Symptom:** `errors > 0` in summary
**Action:** Check logs, investigate failing lines

### Gate 6 Failure: Duplicate Queue Items
**Symptom:** Re-run matching creates duplicate review queue entries
**Action:** Verify unique constraint on `import_line_id` in review queue table

### Gate 7 Failure: Duplicate Mappings
**Symptom:** Re-approve creates second mapping for same SKU
**Action:** Verify unique constraint `(supplier_id, supplier_sku)` on mappings table

### Gate 8 Failure: Wrong-Bottle Violation
**Symptom:** Auto-match with volume/vintage/pack mismatch detected
**Action:** HARD FAIL - guardrails broken, do NOT deploy

### Gate 9 Failure: Missing Vintage Auto-Matched
**Symptom:** Line with missing vintage auto-matched to vintage-specific product
**Action:** Fix matcher logic, add vintage presence check

---

## 🏁 Acceptance Run Complete

Once all gates pass, Phase 1 is validated as:
- ✅ Production-safe (guardrails work)
- ✅ Idempotent (no duplicate data)
- ✅ Auditable (complete trail)
- ✅ Correct (family logic works)

**Next Step:** Deploy to staging environment and run acceptance suite again.
