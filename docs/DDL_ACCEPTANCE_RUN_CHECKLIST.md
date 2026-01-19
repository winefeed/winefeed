# DDL (Direct Delivery Location) Acceptance Test Checklist

**Purpose:** Prove the DDL compliance module is production-safe before deployment

**Date:** 2026-01-14

**Status:** Ready for execution

---

## Prerequisites

### Environment Setup
- [ ] Database migration applied: `supabase/migrations/20260114_direct_delivery_locations.sql`
- [ ] Storage bucket created: `ddl-documents`
- [ ] Environment variables set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `API_BASE_URL` (e.g., http://localhost:3000)
- [ ] Test tenant created with ID
- [ ] Test users created:
  - Restaurant user (no admin role)
  - Compliance admin (role: `compliance_admin`)
- [ ] Dependencies installed: `npm install pdf-lib`

### Test Data
- [ ] Test restaurant created
- [ ] Test importer created
- [ ] Valid Swedish org number ready: `556789-1234`

---

## GATE 1: Database Schema & Constraints ✅

**Run:** `psql $DATABASE_URL -f scripts/sql/verify-ddl-constraints.sql`

**Pass Criteria:**
- [ ] All 3 tables exist (`direct_delivery_locations`, `ddl_documents`, `ddl_status_events`)
- [ ] Status enum has all 5 values (NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED, EXPIRED)
- [ ] Org number constraint enforces format `^\d{6}-\d{4}$`
- [ ] Email constraint enforces valid format
- [ ] Unique constraint on (tenant_id, restaurant_id, importer_id, delivery_address_line1, postal_code, city)
- [ ] RLS enabled on all 3 tables
- [ ] At least 2 RLS policies per table (read + write)
- [ ] No duplicate APPROVED DDLs for same restaurant+importer+address
- [ ] All status events have corresponding DDL records

**Fail Actions:**
- If tables missing → Re-run migration
- If constraints missing → Check migration syntax
- If RLS not enabled → Run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

---

## GATE 2: End-to-End Workflow (Happy Path) 🎯

**Run:** `npx tsx scripts/ddl-acceptance-run.ts --scenario=happy-path`

**Scenario:** Complete workflow from creation to approved shipment

### Steps:

#### 2.1 Create DDL (NOT_REGISTERED)
```bash
POST /api/restaurants/:restaurantId/direct-delivery-locations
{
  "importer_id": "test-importer-1",
  "org_number": "556789-1234",
  "legal_name": "Test Restaurant AB",
  "delivery_address": {
    "line1": "Kungsgatan 1",
    "postal_code": "111 43",
    "city": "Stockholm",
    "country_code": "SE"
  },
  "contact": {
    "name": "John Doe",
    "email": "john@test.se",
    "phone": "070-123 45 67"
  },
  "consent_given": true
}
```

**Pass Criteria:**
- [ ] Returns 201 Created
- [ ] Response includes `ddl_id`
- [ ] Status = `NOT_REGISTERED`
- [ ] Org number normalized to `556789-1234` (with hyphen)

#### 2.2 Generate Document (v1)
```bash
POST /api/direct-delivery-locations/:ddlId/generate-document
```

**Pass Criteria:**
- [ ] Returns 200 OK
- [ ] Response includes `document_id`, `version: 1`, `file_url`
- [ ] Document record created in `ddl_documents` table
- [ ] PDF file exists in Supabase Storage at path: `{tenant_id}/{ddl_id}/application-v1.pdf`
- [ ] SHA-256 hash computed and stored
- [ ] `current_document_id` updated in `direct_delivery_locations`

#### 2.3 Submit for Approval
```bash
POST /api/direct-delivery-locations/:ddlId/submit
{
  "note": "Ready for review"
}
```

**Pass Criteria:**
- [ ] Returns 200 OK
- [ ] Status changed to `SUBMITTED`
- [ ] Status event created in `ddl_status_events` (NOT_REGISTERED → SUBMITTED)
- [ ] Event includes user_id, timestamp, note

#### 2.4 Validate Shipment (Should BLOCK - not approved yet)
```bash
POST /api/shipments/validate-ddl
{
  "restaurant_id": "test-restaurant-1",
  "importer_id": "test-importer-1",
  "delivery_address": {
    "line1": "Kungsgatan 1",
    "postal_code": "11143",
    "city": "Stockholm"
  }
}
```

**Pass Criteria:**
- [ ] Returns 200 OK
- [ ] `valid: false`
- [ ] `status: "SUBMITTED"`
- [ ] Error message: "Direkt leveransplats är inte godkänd. Status: SUBMITTED"

**🚨 CRITICAL GATE:** SUBMITTED status MUST block shipments

#### 2.5 Approve (Compliance Admin)
```bash
POST /api/direct-delivery-locations/:ddlId/approve
{
  "note": "All documents verified"
}
Headers: x-user-role: compliance_admin
```

**Pass Criteria:**
- [ ] Returns 200 OK
- [ ] Status changed to `APPROVED`
- [ ] Status event created (SUBMITTED → APPROVED)
- [ ] Event includes admin user_id

#### 2.6 Validate Shipment (Should ALLOW - now approved)
```bash
POST /api/shipments/validate-ddl
{
  "restaurant_id": "test-restaurant-1",
  "importer_id": "test-importer-1",
  "delivery_address": {
    "line1": "Kungsgatan 1",
    "postal_code": "11143",
    "city": "Stockholm"
  }
}
```

**Pass Criteria:**
- [ ] Returns 200 OK
- [ ] `valid: true`
- [ ] `status: "APPROVED"`
- [ ] `ddl_id` matches created DDL
- [ ] No error message

**🚨 CRITICAL GATE:** APPROVED status with matching address MUST allow shipments

---

## GATE 3: Shipment Gating (Negative Scenarios) 🚨

**Run:** `npx tsx scripts/ddl-acceptance-run.ts --scenario=shipment-gating`

### Scenario 3.1: No DDL Exists

**Pass Criteria:**
- [ ] `valid: false`
- [ ] Error: "Direkt leveransplats saknas för denna restaurang och importör"

**🚨 CRITICAL GATE:** Missing DDL MUST block shipments

### Scenario 3.2: REJECTED DDL

**Setup:** Create DDL → Generate → Submit → Reject

**Pass Criteria:**
- [ ] `valid: false`
- [ ] `status: "REJECTED"`
- [ ] Error contains "inte godkänd"

**🚨 CRITICAL GATE:** REJECTED status MUST block shipments

### Scenario 3.3: APPROVED DDL but Address Mismatch (Different Street)

**Setup:** Create DDL with address "Kungsgatan 1", approve it
**Validate:** Try shipment to "Drottninggatan 5"

**Pass Criteria:**
- [ ] `valid: false`
- [ ] Error contains "matchar inte"

**🚨 CRITICAL GATE:** Address mismatch MUST block shipments

### Scenario 3.4: APPROVED DDL but Address Mismatch (Different Postal Code)

**Setup:** Create DDL with postal code "11143", approve it
**Validate:** Try shipment to postal code "12345"

**Pass Criteria:**
- [ ] `valid: false`
- [ ] Error contains "matchar inte"

### Scenario 3.5: APPROVED DDL but Address Mismatch (Different City)

**Setup:** Create DDL with city "Stockholm", approve it
**Validate:** Try shipment to city "Göteborg"

**Pass Criteria:**
- [ ] `valid: false`
- [ ] Error contains "matchar inte"

### Scenario 3.6: Case Insensitive Matching (Should ALLOW)

**Setup:** Create DDL with "Kungsgatan 1", "Stockholm", approve it
**Validate:** Try shipment to "kungsgatan 1", "STOCKHOLM" (different case)

**Pass Criteria:**
- [ ] `valid: true`
- [ ] Case differences ignored

### Scenario 3.7: Postal Code Space Handling (Should ALLOW)

**Setup:** Create DDL with postal code "111 43", approve it
**Validate:** Try shipment to postal code "11143" (no space)

**Pass Criteria:**
- [ ] `valid: true`
- [ ] Spaces normalized

**🚨 ZERO FALSE ALLOWS REQUIRED** - If ANY negative scenario returns `valid: true`, FAIL IMMEDIATELY

---

## GATE 4: Validation & Business Rules 🔒

**Run:** `npx tsx scripts/ddl-acceptance-run.ts --scenario=validation`

### Scenario 4.1: Invalid Org Number Format

**Test:** Create DDL with org_number: "12345"

**Pass Criteria:**
- [ ] Returns 400 Bad Request
- [ ] Error: "Ogiltigt format. Förväntat format: NNNNNN-NNNN"

### Scenario 4.2: Invalid Org Number Checksum

**Test:** Create DDL with org_number: "556789-1235" (invalid Luhn checksum)

**Pass Criteria:**
- [ ] Returns 400 Bad Request
- [ ] Error contains "checksumma felaktig"

### Scenario 4.3: Consent Not Given

**Test:** Create DDL with `consent_given: false`

**Pass Criteria:**
- [ ] Returns 400 Bad Request
- [ ] Error: "Consent required"

### Scenario 4.4: Duplicate DDL (Same Restaurant + Importer + Address)

**Test:** Create DDL twice with identical data

**Pass Criteria:**
- [ ] First request: 201 Created
- [ ] Second request: 400 Bad Request
- [ ] Error contains "Duplicate DDL"

### Scenario 4.5: Invalid Status Transition (Skip SUBMITTED)

**Test:** Try to approve DDL directly from NOT_REGISTERED

**Pass Criteria:**
- [ ] Returns 400 Bad Request
- [ ] Error: "Ogiltig statusövergång"

### Scenario 4.6: Cannot Submit Without Document

**Test:** Try to submit DDL before generating document

**Pass Criteria:**
- [ ] Returns 400 Bad Request
- [ ] Error: "Dokument måste genereras först"

---

## GATE 5: Security & Access Control 🔐

**Run:** `npx tsx scripts/ddl-acceptance-security.ts`

### Scenario 5.1: Multi-Tenant Isolation

**Setup:**
- Create DDL in tenant A
- Try to read DDL from tenant B (using different tenant-id header)

**Pass Criteria:**
- [ ] Returns 404 Not Found OR empty result
- [ ] DDL from tenant A NOT visible to tenant B

**🚨 CRITICAL GATE:** Tenant isolation MUST be enforced

### Scenario 5.2: Restaurant User Cannot Approve/Reject

**Test:** Restaurant user (no compliance_admin role) tries to approve DDL

**Pass Criteria:**
- [ ] Returns 403 Forbidden
- [ ] Error: "Endast compliance_admin kan godkänna/avslå"

### Scenario 5.3: Compliance Admin Can Approve/Reject

**Test:** User with `compliance_admin` role approves DDL

**Pass Criteria:**
- [ ] Returns 200 OK
- [ ] Status changed to APPROVED

### Scenario 5.4: Restaurant User Can Only See Own DDLs

**Setup:**
- Restaurant A creates DDL
- Restaurant B tries to read Restaurant A's DDL

**Pass Criteria:**
- [ ] Restaurant B gets 404 or empty result
- [ ] Restaurant A's DDL not visible to Restaurant B

### Scenario 5.5: Storage Access Control

**Test:** Try to access PDF file without authentication

**Pass Criteria:**
- [ ] Returns 401 Unauthorized OR 403 Forbidden
- [ ] PDF not accessible without valid auth token

**🚨 CRITICAL GATE:** Storage MUST NOT leak documents publicly

---

## GATE 6: Audit Trail Completeness 📋

**Run:** `npx tsx scripts/ddl-acceptance-audit.ts`

### Scenario 6.1: Every Status Change Creates Event

**Test:** Complete workflow: Create → Submit → Approve

**Pass Criteria:**
- [ ] 2 status events created (NOT_REGISTERED→SUBMITTED, SUBMITTED→APPROVED)
- [ ] Each event has: ddl_id, from_status, to_status, changed_by_user_id, timestamp
- [ ] Events ordered by created_at

**🚨 CRITICAL GATE:** Audit trail MUST be 1:1 with status changes

### Scenario 6.2: Rejection Creates Event

**Test:** Create → Submit → Reject

**Pass Criteria:**
- [ ] 2 events: NOT_REGISTERED→SUBMITTED, SUBMITTED→REJECTED
- [ ] Rejection note captured in event

### Scenario 6.3: Status Events Are Immutable

**Test:** Try to UPDATE or DELETE status event

**Pass Criteria:**
- [ ] UPDATE fails (RLS policy prevents it)
- [ ] DELETE fails (RLS policy prevents it)
- [ ] Events append-only

### Scenario 6.4: Audit Trail Includes User Context

**Test:** Approve DDL as admin user

**Pass Criteria:**
- [ ] Event includes `changed_by_user_id` matching admin user
- [ ] Can query: "Who approved this DDL?"

---

## GATE 7: Document Generation & Versioning 📄

**Run:** `npx tsx scripts/ddl-acceptance-documents.ts`

### Scenario 7.1: First Generation Creates v1

**Pass Criteria:**
- [ ] Document version = 1
- [ ] File stored at: `{tenant_id}/{ddl_id}/application-v1.pdf`
- [ ] SHA-256 hash computed
- [ ] PDF is valid (can be opened)

### Scenario 7.2: Regeneration Creates v2

**Test:** Generate document twice

**Pass Criteria:**
- [ ] First generation: version = 1
- [ ] Second generation: version = 2
- [ ] Both files exist in storage
- [ ] `current_document_id` points to v2

### Scenario 7.3: PDF Content Integrity

**Test:** Generate document, verify content

**Pass Criteria:**
- [ ] PDF contains org_number
- [ ] PDF contains delivery address
- [ ] PDF contains contact info
- [ ] PDF contains consent timestamp
- [ ] PDF contains internal reference: `DDL-{id}-{date}-v{version}`

### Scenario 7.4: SHA-256 Hash Verification

**Test:** Download PDF, recompute hash

**Pass Criteria:**
- [ ] Computed hash matches stored hash
- [ ] Hash is 64 characters (256 bits hex)

### Scenario 7.5: Cannot Generate After APPROVED

**Test:** Try to generate document when status = APPROVED

**Pass Criteria:**
- [ ] Returns 400 Bad Request
- [ ] Error: "Kan inte generera dokument för godkänd DDL"

---

## GATE 8: Versioning & Resubmission 🔄

**Run:** `npx tsx scripts/ddl-acceptance-run.ts --scenario=resubmission`

### Scenario 8.1: Rejected DDL Can Be Reset

**Test:** Create → Submit → Reject → Reset to NOT_REGISTERED

**Pass Criteria:**
- [ ] Status successfully changes to NOT_REGISTERED
- [ ] Status event created (REJECTED → NOT_REGISTERED)
- [ ] Can regenerate document (as v2 or v3)

### Scenario 8.2: Rejected DDL Can Be Resubmitted

**Test:** Create → Submit → Reject → Reset → Regenerate → Resubmit

**Pass Criteria:**
- [ ] New submission allowed
- [ ] Status changes to SUBMITTED
- [ ] New document version created
- [ ] All transitions logged

### Scenario 8.3: Cannot Modify APPROVED DDL

**Test:** Try to update address on APPROVED DDL

**Pass Criteria:**
- [ ] Returns 400 Bad Request OR 403 Forbidden
- [ ] APPROVED DDL immutable

---

## Summary: Critical Gates

### ZERO-TOLERANCE Gates (Must Pass 100%)
1. **Shipment Gating - No False Allows**
   - [ ] SUBMITTED blocks shipments
   - [ ] REJECTED blocks shipments
   - [ ] Address mismatch blocks shipments
   - [ ] Missing DDL blocks shipments

2. **Audit Trail - 1:1 with Status Changes**
   - [ ] Every status change creates exactly one event
   - [ ] Events are immutable (append-only)

3. **Storage Security - No Public Leaks**
   - [ ] PDFs not accessible without auth
   - [ ] Tenant isolation enforced

4. **Multi-Tenant Isolation**
   - [ ] Tenant A cannot access Tenant B's DDLs
   - [ ] RLS policies enforced at database level

---

## Execution Plan

### Phase 1: Database Verification (5 min)
```bash
psql $DATABASE_URL -f scripts/sql/verify-ddl-constraints.sql
```

### Phase 2: End-to-End Testing (20 min)
```bash
npx tsx scripts/ddl-acceptance-run.ts --scenario=happy-path
npx tsx scripts/ddl-acceptance-run.ts --scenario=shipment-gating
npx tsx scripts/ddl-acceptance-run.ts --scenario=validation
npx tsx scripts/ddl-acceptance-run.ts --scenario=resubmission
```

### Phase 3: Security Testing (15 min)
```bash
npx tsx scripts/ddl-acceptance-security.ts
```

### Phase 4: Audit Trail Testing (10 min)
```bash
npx tsx scripts/ddl-acceptance-audit.ts
```

### Phase 5: Document Testing (15 min)
```bash
npx tsx scripts/ddl-acceptance-documents.ts
```

**Total Estimated Time:** 65 minutes

---

## Acceptance Criteria

### Must Pass (Production Blocker)
- [ ] All GATE 1 checks pass (schema/constraints)
- [ ] All GATE 2 steps complete successfully (happy path)
- [ ] All GATE 3 scenarios BLOCK as expected (zero false allows)
- [ ] All GATE 5 security checks pass (tenant isolation, RBAC, storage)
- [ ] All GATE 6 audit trail checks pass (1:1 events)

### Should Pass (High Priority)
- [ ] All GATE 4 validation checks pass
- [ ] All GATE 7 document checks pass
- [ ] All GATE 8 resubmission checks pass

### Nice to Have
- [ ] Metrics endpoint functional (optional)
- [ ] Performance acceptable (<500ms per request)

---

## Sign-Off

**Tester:** _____________________ **Date:** _____

**Compliance Lead:** _____________________ **Date:** _____

**Engineering Lead:** _____________________ **Date:** _____

---

## Failure Response Plan

### If Shipment Gating Fails (False Allow)
1. **STOP ALL DEPLOYMENTS** - Critical compliance risk
2. Review `ddlService.validateForShipment()` logic
3. Review address matching logic in `validation.ts`
4. Review status checks
5. Re-run ALL shipment gating tests after fix

### If Audit Trail Incomplete
1. Review `ddl_status_events` insertion logic
2. Check RLS policies on status_events table
3. Verify all status transition endpoints create events

### If Storage Leaks Documents
1. Review Supabase Storage bucket policies
2. Update RLS to enforce tenant_id check
3. Add authentication requirement to all document URLs

### If Tenant Isolation Broken
1. **STOP ALL DEPLOYMENTS** - Security risk
2. Review ALL RLS policies
3. Verify `tenant_id` passed in all queries
4. Re-test multi-tenant scenarios

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-14
**Owner:** Winefeed Compliance Team
