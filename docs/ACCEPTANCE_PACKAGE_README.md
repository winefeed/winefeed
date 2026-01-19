# Phase 1 Acceptance Package - README

**Version:** 1.0.0
**Date:** 2024-01-14
**Status:** ✅ Complete and ready to use

---

## 🎯 Purpose

This acceptance package validates that Phase 1 (CSV import → match → review → decisions) is **production-safe** and aligned with core principles:

- ✅ GTIN optional (fuzzy matching works)
- ✅ Idempotent (re-runs don't duplicate)
- ✅ No wrong-bottle matches (guardrails enforce)
- ✅ Missing vintage → family logic
- ✅ Complete audit trail

---

## 📦 What's Included

### 🗂️ Documentation
1. **ACCEPTANCE_RUN_CHECKLIST.md** - Step-by-step acceptance run guide (10 gates)
2. **ACCEPTANCE_PACKAGE_SUMMARY.md** - Complete package overview with failure modes
3. **ACCEPTANCE_PACKAGE_README.md** - This file (quick start)

### 🧪 Test Scripts
1. **scripts/acceptance-run.ts** - End-to-end API test (6 gates)
2. **scripts/acceptance-wrong-bottle-gate.ts** - Safety guardrail validation (HARD FAIL on violations)
3. **scripts/acceptance-family-logic.ts** - Missing vintage → family logic test
4. **scripts/acceptance-audit-log.ts** - Audit trail completeness check

### 🗄️ Database Verification
1. **scripts/sql/verify-phase1-constraints.sql** - Schema validation (constraints, indexes, duplicates)

### 🚀 Automation
1. **scripts/run-acceptance-suite.sh** - Run all tests with one command
2. **data/test-samples/acceptance-test.csv** - Sample CSV for testing (50 lines)

### 🔌 API Enhancement
1. **app/api/imports/[importId]/metrics/route.ts** - Metrics endpoint for visibility

---

## ⚡ Quick Start

### 1. Set Environment Variables
```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export API_BASE_URL="http://localhost:3000"
export DATABASE_URL="postgresql://..."  # Optional, for SQL verification
```

### 2. Run Full Acceptance Suite
```bash
# Make script executable
chmod +x scripts/run-acceptance-suite.sh

# Run all tests
./scripts/run-acceptance-suite.sh

# Expected output:
# ✅ Database verification PASSED
# ✅ End-to-end test PASSED
# ✅ Wrong-bottle safety gate PASSED
# ✅ Family logic test PASSED
# ✅ Audit log verification PASSED
# ✅ ACCEPTANCE SUITE PASSED
```

### 3. Check Results
- **All tests pass** → ✅ Ready for production
- **Any test fails** → ❌ Fix issues before deploying

---

## 🧪 Individual Test Commands

### Database Verification
```bash
psql $DATABASE_URL -f scripts/sql/verify-phase1-constraints.sql
```
**Checks:** Tables, constraints, indexes, duplicates

### End-to-End API Test
```bash
npx tsx scripts/acceptance-run.ts
```
**Tests:** Upload → Match → Review → Approve → Idempotency

### Wrong-Bottle Safety Gate (CRITICAL)
```bash
# Check specific import
npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>

# Check all recent imports
npx tsx scripts/acceptance-wrong-bottle-gate.ts --all
```
**MUST BE 0 violations** - Any violation = HARD FAIL

### Family Logic Test
```bash
npx tsx scripts/acceptance-family-logic.ts
```
**Tests:** Missing vintage handling, family candidates, approve_family action

### Audit Log Verification
```bash
# Check specific import
npx tsx scripts/acceptance-audit-log.ts <importId>

# Check all recent imports
npx tsx scripts/acceptance-audit-log.ts --all
```
**Checks:** 1:1 ratio (decisions = audit events), structure, append-only

### Metrics Endpoint
```bash
curl "http://localhost:3000/api/imports/<importId>/metrics" | jq
```
**Returns:** Auto-match rate, review queue size, top reasons

---

## 🚨 Critical Gates (MUST PASS)

### Gate 1: Database Constraints
- All tables exist (7 tables)
- All unique constraints present (4 critical)
- All indexes present (8 indexes)
- Zero duplicates (mappings, queue items, import lines)

### Gate 2: Wrong-Bottle Safety
- **0 volume mismatches**
- **0 pack mismatches**
- **0 vintage mismatches in AUTO_MATCH**
- **0 ABV mismatches >0.5%**
- **0 units per case mismatches**

**If any violations detected → HARD FAIL, do NOT deploy**

### Gate 3: Idempotency
- Re-run matching does NOT create duplicates
- Re-approve decision does NOT create duplicate mappings
- Unique constraints enforce (supplier_id, supplier_sku)

### Gate 4: Audit Trail
- Every resolved decision has audit event (1:1 ratio)
- All events have user_id, event_type, metadata, timestamp
- Append-only (no updates/deletes)

---

## 📊 Expected Results

### After Running Acceptance Suite

```
═══════════════════════════════════════════════════════════════════════
📊 ACCEPTANCE SUITE SUMMARY
═══════════════════════════════════════════════════════════════════════

Tests passed:  6
Tests failed:  0
Tests skipped: 0

✅ ACCEPTANCE SUITE PASSED
═══════════════════════════════════════════════════════════════════════

🎉 Phase 1 is ready for production deployment

Next steps:
1. Deploy to staging environment
2. Run acceptance suite on staging
3. Test with real supplier data
4. Monitor metrics and iterate
```

---

## 🔥 Failure Modes & Quick Fixes

### ❌ Wrong-Bottle Violations Detected
**Symptom:** `acceptance-wrong-bottle-gate.ts` shows violations > 0
**Action:** **STOP IMMEDIATELY** - Do NOT deploy
**Fix:** Review guardrails in `lib/matching/product-matcher-v2.ts`

### ❌ Duplicate Mappings Created
**Symptom:** Re-approve creates 2nd mapping
**Action:** Check UPSERT logic uses `onConflict: 'supplier_id,supplier_sku'`
**Fix:** Verify unique constraint exists in database

### ❌ Missing Audit Events
**Symptom:** Audit count < resolved count
**Action:** Check decision endpoint writes audit AFTER successful mapping
**Fix:** Review `app/api/admin/review-queue/[queueItemId]/decision/route.ts`

### ❌ Database Constraints Missing
**Symptom:** SQL verification shows missing constraints
**Action:** Apply migration
**Fix:** `psql $DATABASE_URL -f supabase/migrations/20260114_supplier_imports.sql`

---

## 📁 File Structure

```
.
├── ACCEPTANCE_RUN_CHECKLIST.md          # Detailed step-by-step guide
├── ACCEPTANCE_PACKAGE_SUMMARY.md        # Complete package overview
├── ACCEPTANCE_PACKAGE_README.md         # This file (quick start)
│
├── scripts/
│   ├── acceptance-run.ts                # End-to-end test
│   ├── acceptance-wrong-bottle-gate.ts  # Safety validation
│   ├── acceptance-family-logic.ts       # Family logic test
│   ├── acceptance-audit-log.ts          # Audit verification
│   ├── run-acceptance-suite.sh          # Run all tests
│   │
│   └── sql/
│       └── verify-phase1-constraints.sql # Database verification
│
├── data/
│   └── test-samples/
│       └── acceptance-test.csv          # Sample CSV (50 lines)
│
└── app/
    └── api/
        └── imports/
            └── [importId]/
                └── metrics/
                    └── route.ts         # Metrics endpoint
```

---

## 🎯 Success Criteria

Phase 1 is ready for production when:

- ✅ All database constraints verified
- ✅ All 6 end-to-end gates pass
- ✅ **Zero wrong-bottle violations**
- ✅ Family logic validated
- ✅ Audit trail complete (1:1 ratio)
- ✅ Idempotency proven
- ✅ Metrics endpoint working

**Once all gates pass → Deploy to staging and repeat tests**

---

## 🚀 Next Steps

### 1. Run Acceptance Suite Locally
```bash
./scripts/run-acceptance-suite.sh
```

### 2. Deploy to Staging
```bash
# Deploy code
git push staging main

# Run acceptance suite on staging
API_BASE_URL=https://staging.example.com ./scripts/run-acceptance-suite.sh
```

### 3. Test with Real Data
```bash
# Upload real supplier CSV
curl -X POST https://staging.example.com/api/suppliers/<id>/imports \
  -F "file=@real-supplier-data.csv"

# Run safety check
npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>
```

### 4. Monitor Metrics
```bash
# Check import metrics
curl "https://staging.example.com/api/imports/<importId>/metrics" | jq

# Review auto-match rate, guardrail failures, top reasons
```

### 5. Production Deployment
- ✅ All staging tests pass
- ✅ Real data smoke test clean
- ✅ Metrics within targets (auto-match ≥70%)
- → Deploy to production

---

## 📞 Support

### Common Issues

**Q: Database verification fails with "table not found"**
A: Apply migration: `psql $DATABASE_URL -f supabase/migrations/20260114_supplier_imports.sql`

**Q: End-to-end test fails with "Connection refused"**
A: Check API is running: `curl http://localhost:3000/api/health`

**Q: Wrong-bottle gate shows violations**
A: **STOP** - Do NOT deploy. Review matching logic and guardrails.

**Q: Family logic test shows warnings**
A: Family matching may need implementation. Check matcher for missing vintage handling.

**Q: Audit log has missing events**
A: Check decision endpoint writes audit log after successful mapping.

### Documentation

- Database schema → `supabase/migrations/20260114_supplier_imports.sql`
- API endpoints → `docs/API_JSON_SHAPES.md`
- Matching rules → `MATCHING_RULES.md`
- Implementation → `PHASE1_IMPLEMENTATION_SUMMARY.md`

### Emergency Contact

If wrong-bottle violations detected in production:

```bash
# Check all imports immediately
npx tsx scripts/acceptance-wrong-bottle-gate.ts --all

# If violations found:
# 1. STOP all imports
# 2. Review violated lines
# 3. Fix guardrails
# 4. Re-test before resuming
```

---

## 📋 Checklist for Production Readiness

Before deploying to production, verify:

- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] All acceptance tests pass locally
- [ ] All acceptance tests pass on staging
- [ ] Real supplier data tested (smoke test)
- [ ] Metrics reviewed (auto-match ≥70%)
- [ ] Wrong-bottle gate shows 0 violations
- [ ] Audit log complete (1:1 ratio)
- [ ] Idempotency proven (re-run tests)
- [ ] Team trained on reviewing queue items
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

**All boxes checked → ✅ Ready for production**

---

## 📜 Version History

### v1.0.0 (2024-01-14)
- Initial acceptance package release
- Complete test suite (6 tests)
- Database verification queries
- Automated test runner
- Sample test data
- Metrics endpoint

---

**Package Maintainer:** Winefeed Engineering
**Last Updated:** 2024-01-14
**Status:** ✅ Production-ready
