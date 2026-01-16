# Acceptance Testing - Quick Reference Card

**Copy-paste commands for Phase 1 validation**

---

## 🔧 Setup (One-time)

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export API_BASE_URL="http://localhost:3000"
export DATABASE_URL="postgresql://..."

# Make test runner executable
chmod +x scripts/run-acceptance-suite.sh
```

---

## ⚡ Run All Tests (Recommended)

```bash
# Run complete acceptance suite
./scripts/run-acceptance-suite.sh

# Skip database verification (if DATABASE_URL not set)
./scripts/run-acceptance-suite.sh --skip-db-check
```

**Exit code 0** = All tests pass, ready for production
**Exit code 1** = Tests failed, fix issues before deploying

---

## 🧪 Individual Tests

### 1. Database Verification
```bash
psql $DATABASE_URL -f scripts/sql/verify-phase1-constraints.sql
```
**Checks:** Tables, constraints, indexes, duplicates
**Gate:** All checks must pass

### 2. End-to-End API Test
```bash
npx tsx scripts/acceptance-run.ts
```
**Tests:** Upload → Match → Review → Approve → Idempotency
**Gate:** 6/6 gates pass

### 3. Wrong-Bottle Safety Gate ⚠️ CRITICAL
```bash
# Specific import
npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>

# All recent imports
npx tsx scripts/acceptance-wrong-bottle-gate.ts --all
```
**Gate:** **MUST BE 0 VIOLATIONS** (HARD FAIL if any)

### 4. Family Logic Test
```bash
npx tsx scripts/acceptance-family-logic.ts
```
**Tests:** Missing vintage handling, family candidates
**Gate:** All checks pass (warnings OK if not implemented)

### 5. Audit Log Verification
```bash
# Specific import
npx tsx scripts/acceptance-audit-log.ts <importId>

# All recent imports
npx tsx scripts/acceptance-audit-log.ts --all
```
**Gate:** 1:1 ratio (decisions = audit events)

### 6. Metrics Endpoint
```bash
curl "http://localhost:3000/api/imports/<importId>/metrics" | jq
```
**Returns:** Auto-match rate, top reasons, guardrail failures

---

## 🚨 Emergency Commands

### Check All Imports for Violations
```bash
# Safety check
npx tsx scripts/acceptance-wrong-bottle-gate.ts --all

# Audit completeness
npx tsx scripts/acceptance-audit-log.ts --all
```

### Verify Database State
```bash
# Check for duplicates
psql $DATABASE_URL -c "
SELECT supplier_id, supplier_sku, COUNT(*)
FROM supplier_product_mappings
GROUP BY supplier_id, supplier_sku
HAVING COUNT(*) > 1;
"
# Should return 0 rows

# Check orphaned records
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM supplier_import_lines sil
WHERE NOT EXISTS (
  SELECT 1 FROM supplier_imports WHERE id = sil.import_id
);
"
# Should return 0
```

---

## 📊 Expected Output Examples

### ✅ Successful Run
```
═══════════════════════════════════════════════════════════════════════
📊 ACCEPTANCE SUITE SUMMARY
═══════════════════════════════════════════════════════════════════════

Tests passed:  6
Tests failed:  0
Tests skipped: 0

✅ ACCEPTANCE SUITE PASSED
═══════════════════════════════════════════════════════════════════════
```

### ❌ Failed Run (Wrong-Bottle Violation)
```
❌ Volume mismatches: 3
  Violation 1:
    Line: 42
    SKU: TEST-001
    Input value: 750
    Candidate value: 1500

❌ SAFETY GATE FAILED
🚨 DO NOT DEPLOY TO PRODUCTION
```

---

## 🔥 Quick Fixes

### Missing Database Constraints
```bash
psql $DATABASE_URL -f supabase/migrations/20260114_supplier_imports.sql
```

### Duplicate Mappings Detected
```bash
# Check UPSERT logic in decision endpoint
grep -n "upsert" app/api/admin/review-queue/*/decision/route.ts

# Verify unique constraint
psql $DATABASE_URL -c "
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'supplier_product_mappings'
  AND constraint_type = 'UNIQUE';
"
```

### API Not Responding
```bash
# Check API health
curl http://localhost:3000/api/health

# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $API_BASE_URL
```

---

## 📋 Pre-Deployment Checklist

```bash
# 1. Run full acceptance suite
./scripts/run-acceptance-suite.sh

# 2. Check specific import (from Step 1 output)
export TEST_IMPORT_ID="<importId-from-acceptance-run>"

npx tsx scripts/acceptance-wrong-bottle-gate.ts $TEST_IMPORT_ID
npx tsx scripts/acceptance-audit-log.ts $TEST_IMPORT_ID

# 3. Check metrics
curl "http://localhost:3000/api/imports/$TEST_IMPORT_ID/metrics" | jq '.metrics'

# 4. Verify auto-match rate ≥70% (target)
# 5. Verify 0 guardrail violations (MUST)
# 6. Verify audit completeness (MUST)

# ✅ All pass → Ready for staging deployment
```

---

## 🚀 Staging Deployment Validation

```bash
# Set staging URL
export API_BASE_URL="https://staging.example.com"

# Run acceptance suite on staging
./scripts/run-acceptance-suite.sh

# Upload real supplier data
curl -X POST "$API_BASE_URL/api/suppliers/<supplierId>/imports" \
  -F "file=@real-supplier-data.csv"

# Check safety (use importId from response)
npx tsx scripts/acceptance-wrong-bottle-gate.ts <importId>

# ✅ All pass → Ready for production
```

---

## 📞 Support Contacts

**Database Issues:** Check `scripts/sql/verify-phase1-constraints.sql`
**API Issues:** Check `ACCEPTANCE_RUN_CHECKLIST.md`
**Guardrail Issues:** Check `MATCHING_RULES.md`
**General Questions:** Check `ACCEPTANCE_PACKAGE_README.md`

---

## 🎯 Critical Gates Summary

| Test | Gate | Failure Action |
|------|------|----------------|
| Database verification | All constraints present | Apply migration |
| Wrong-bottle safety | **0 violations** | **HARD STOP - Fix guardrails** |
| End-to-end | 6/6 gates pass | Review API implementation |
| Family logic | All checks pass | Implement family matching |
| Audit log | 1:1 ratio | Fix audit writes |
| Idempotency | No duplicates | Fix UPSERT logic |

---

**Last Updated:** 2024-01-14
**Version:** 1.0.0
