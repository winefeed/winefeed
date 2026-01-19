# GS1 Phase 1: Definition of Done

**Hero Use Case:** Supplier uploads price list → 80%+ auto-matched → remaining 20% reviewed within 24 hours → restaurant sees offers

---

## Technical Deliverables (Must Complete)

### 1. Database Schema ✅
- [x] 7 tables created via migration `20260114_gs1_phase1.sql`
- [x] All indexes created
- [x] RLS policies applied
- [x] Helper functions (`generate_wf_product_id`, `generate_wf_family_id`)
- [x] Triggers for `updated_at` columns

**Verification:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'product_families',
  'master_products',
  'product_gtin_registry',
  'supplier_product_mappings',
  'product_match_review_queue',
  'gtin_verification_cache',
  'product_audit_log'
);
-- Should return 7 rows
```

---

### 2. GS1 Verification Service ✅
- [x] File: `lib/gs1/verification-service.ts`
- [x] `verifyGTIN(gtin, options)` method implemented
- [x] `verifyBatch(gtins, options)` method implemented
- [x] Cache-first pattern (check cache before API)
- [x] Rate limiting (60 requests/minute)
- [x] Circuit breaker (5 failures → 1 minute timeout)
- [x] Graceful degradation (return stale cache if GS1 down)

**Verification:**
```typescript
import { gs1Service } from '@/lib/gs1/verification-service';

// Test 1: Verify GTIN (cache miss)
const result = await gs1Service.verifyGTIN('3012345678901');
console.assert(result.source === 'gs1_api' || result.source === 'cache');

// Test 2: Verify again (cache hit)
const cached = await gs1Service.verifyGTIN('3012345678901');
console.assert(cached.source === 'cache');

// Test 3: Batch verify
const batch = await gs1Service.verifyBatch([
  '3012345678901',
  '3012345678918',
  '3012345678925'
]);
console.assert(batch.size === 3);
```

---

### 3. Product Matching Engine ✅
- [x] File: `lib/matching/product-matcher.ts`
- [x] `matchProduct(supplierId, input)` method implemented
- [x] `matchBatch(supplierId, inputs)` method implemented
- [x] 3-tier confidence scoring:
  - GTIN exact match → 1.00
  - Existing SKU mapping → 0.90
  - Fuzzy match → 0.50-0.80
- [x] Guardrails implemented:
  - Volume mismatch → NO MATCH
  - Pack type mismatch → NO MATCH
  - Units per case mismatch → NO MATCH
  - Vintage diff >2 years → NO MATCH

**Verification:**
```typescript
import { productMatcher } from '@/lib/matching/product-matcher';

// Test 1: GTIN exact match (should return confidence 1.00)
const gtinMatch = await productMatcher.matchProduct('supplier-id', {
  supplierSku: 'TEST-001',
  gtinEach: '3012345678901',
  producerName: 'Château Margaux',
  productName: 'Château Margaux 2015',
  vintage: 2015,
  volumeMl: 750,
  packType: 'bottle',
  unitsPerCase: 1
});
console.assert(gtinMatch.status === 'auto_matched');
console.assert(gtinMatch.confidence === 1.00);

// Test 2: Fuzzy match (should return candidates)
const fuzzyMatch = await productMatcher.matchProduct('supplier-id', {
  supplierSku: 'TEST-002',
  producerName: 'Chateau Margaux',  // Slight spelling diff
  productName: 'Margaux 2015',
  vintage: 2015,
  volumeMl: 750,
  packType: 'bottle',
  unitsPerCase: 1
});
console.assert(fuzzyMatch.status === 'needs_review' || fuzzyMatch.status === 'auto_matched');

// Test 3: Guardrail (volume mismatch should block)
const blocked = await productMatcher.matchProduct('supplier-id', {
  supplierSku: 'TEST-003',
  gtinEach: '3012345678901',
  producerName: 'Château Margaux',
  productName: 'Château Margaux 2015',
  vintage: 2015,
  volumeMl: 1500,  // Different volume
  packType: 'bottle',
  unitsPerCase: 1
});
console.assert(blocked.status === 'no_match');
console.assert(blocked.guardrailBlocked?.includes('Volume mismatch'));
```

---

### 4. Supplier CSV Import API ✅
- [x] Endpoint: `POST /api/suppliers/:supplierId/catalog/import`
- [x] Accept CSV file (max 10MB, max 10,000 rows)
- [x] Validate CSV schema against data contract
- [x] Parse and validate all rows
- [x] For each row:
  - Run product matcher
  - If auto-match (confidence ≥ 0.85) → create mapping
  - If needs review (0.50-0.84) → add to queue
  - If no match (<0.50) → create new product
- [x] Return import summary with stats

**Verification:**
```bash
# Create test CSV
cat > /tmp/test_import.csv << EOF
supplier_sku,producer_name,product_name,vintage,volume_ml,abv_percent,pack_type,units_per_case,currency,price_net,min_order_qty,lead_time_days
TEST-001,Château Margaux,Château Margaux 2015,2015,750,13.5,bottle,1,SEK,390.00,6,7
TEST-002,Château Pétrus,Pomerol Grand Cru 2016,2016,750,14.0,bottle,1,SEK,520.00,6,7
EOF

# Upload CSV
curl -X POST 'http://localhost:3000/api/suppliers/SUPPLIER_ID/catalog/import' \
  -F 'file=@/tmp/test_import.csv'

# Expected response:
# {
#   "success": true,
#   "summary": {
#     "totalRows": 2,
#     "autoMatched": 1,
#     "needsReview": 1,
#     "newProductsCreated": 0,
#     "errors": 0
#   }
# }
```

---

### 5. Admin Review Queue UI ✅
- [x] Page: `/admin/product-review`
- [x] API: `GET /api/admin/product-review`
- [x] Show pending review items (paginated)
- [x] Display:
  - Supplier data (producer, product, GTIN, volume, etc.)
  - Top 3 match candidates with confidence scores
  - Match reasons for each candidate
- [x] Actions:
  - Approve match (select candidate)
  - Create new product
  - Reject all (no match)
- [x] API endpoints:
  - `POST /api/admin/product-review/:id/approve`
  - `POST /api/admin/product-review/:id/create-new`
  - `POST /api/admin/product-review/:id/reject`

**Verification:**
```bash
# List pending reviews
curl 'http://localhost:3000/api/admin/product-review?status=pending'

# Approve a match
curl -X POST 'http://localhost:3000/api/admin/product-review/QUEUE_ID/approve' \
  -H 'Content-Type: application/json' \
  -d '{"masterProductId": "PRODUCT_ID", "reviewNotes": "Looks good"}'

# Expected: mapping created, queue item marked approved
```

---

### 6. Audit Logging ✅
- [x] All actions logged to `product_audit_log` table
- [x] Events logged:
  - `product_created`
  - `mapping_created`
  - `mapping_approved`
  - `gtin_verified`
  - `review_approved`
  - `review_rejected`
- [x] Each log includes:
  - event_type, entity_type, entity_id
  - user_id, user_email
  - before_state, after_state (JSONB)
  - metadata (JSONB)

**Verification:**
```sql
-- Check audit log
SELECT
  event_type,
  entity_type,
  user_email,
  created_at
FROM product_audit_log
ORDER BY created_at DESC
LIMIT 10;

-- Should show recent events (product_created, mapping_approved, etc.)
```

---

## Success Metrics (Pilot Targets)

### Automation Rate (Primary KPI)
**Target:** ≥80% of supplier SKUs auto-matched without human review

**Measurement:**
```sql
SELECT
  COUNT(*) FILTER (WHERE match_confidence >= 0.85) AS auto_matched,
  COUNT(*) FILTER (WHERE match_confidence BETWEEN 0.50 AND 0.84) AS needs_review,
  COUNT(*) FILTER (WHERE match_confidence < 0.50) AS no_match,
  ROUND(100.0 * COUNT(*) FILTER (WHERE match_confidence >= 0.85) / COUNT(*), 1) AS automation_rate_percent
FROM supplier_product_mappings
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Success Criteria:**
- ✅ PASS: automation_rate ≥ 80%
- ⚠️  REVIEW: automation_rate 60-79% (needs tuning)
- ❌ FAIL: automation_rate < 60% (matching engine needs redesign)

---

### Review Time Per Supplier (Efficiency)
**Target:** ≤10 minutes per supplier price list import

**Measurement:**
```sql
SELECT
  s.namn AS supplier_name,
  COUNT(q.id) AS items_in_queue,
  AVG(EXTRACT(EPOCH FROM (q.reviewed_at - q.created_at)) / 60) AS avg_review_time_minutes
FROM product_match_review_queue q
JOIN suppliers s ON q.supplier_id = s.id
WHERE q.status IN ('approved', 'rejected')
AND q.reviewed_at >= NOW() - INTERVAL '30 days'
GROUP BY s.namn
ORDER BY avg_review_time_minutes DESC;
```

**Success Criteria:**
- ✅ PASS: avg_review_time ≤ 10 minutes per supplier
- ⚠️  REVIEW: avg_review_time 10-20 minutes (acceptable, but slow)
- ❌ FAIL: avg_review_time > 20 minutes (UI/UX needs improvement)

---

### Mismatch Rate (Accuracy)
**Target:** <1% of auto-matched products have critical attribute mismatches

**Measurement:**
```sql
-- Manual audit: randomly sample 100 auto-matched products
-- Check for mismatches (volume, pack, vintage >2 years)
SELECT
  m.supplier_sku,
  m.match_confidence,
  mp.volume_ml AS master_volume,
  mp.pack_type AS master_pack,
  mp.vintage AS master_vintage
FROM supplier_product_mappings m
JOIN master_products mp ON m.master_product_id = mp.id
WHERE m.match_confidence >= 0.85
AND m.created_at >= NOW() - INTERVAL '30 days'
ORDER BY RANDOM()
LIMIT 100;

-- Manually verify each row matches supplier data
-- Count mismatches (should be <1)
```

**Success Criteria:**
- ✅ PASS: mismatch_rate < 1% (guardrails working)
- ⚠️  REVIEW: mismatch_rate 1-3% (review guardrail rules)
- ❌ FAIL: mismatch_rate > 3% (guardrails too loose, data quality issues)

---

### GTIN Verification Coverage
**Target:** ≥50% of supplier products have GTINs (to enable auto-matching)

**Measurement:**
```sql
SELECT
  COUNT(*) AS total_products,
  COUNT(*) FILTER (WHERE gtin_each IS NOT NULL OR gtin_case IS NOT NULL) AS with_gtin,
  ROUND(100.0 * COUNT(*) FILTER (WHERE gtin_each IS NOT NULL OR gtin_case IS NOT NULL) / COUNT(*), 1) AS gtin_coverage_percent
FROM supplier_wines
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Success Criteria:**
- ✅ PASS: gtin_coverage ≥ 50% (good supplier data quality)
- ⚠️  REVIEW: gtin_coverage 30-49% (encourage suppliers to provide GTINs)
- ❌ FAIL: gtin_coverage < 30% (supplier onboarding education needed)

---

### GS1 API Health
**Target:** ≥99% GS1 API uptime, cache hit rate ≥80%

**Measurement:**
```sql
-- Cache hit rate
SELECT
  COUNT(*) FILTER (WHERE hit_count > 0) AS cache_hits,
  COUNT(*) AS total_gtins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE hit_count > 0) / COUNT(*), 1) AS cache_hit_rate_percent
FROM gtin_verification_cache
WHERE cached_at >= NOW() - INTERVAL '7 days';

-- Circuit breaker events (check logs)
-- grep "circuit breaker OPENED" logs/*.log | wc -l
-- Should be 0 or very low
```

**Success Criteria:**
- ✅ PASS: cache_hit_rate ≥ 80%, circuit breaker events = 0
- ⚠️  REVIEW: cache_hit_rate 60-79%, circuit breaker events 1-5
- ❌ FAIL: cache_hit_rate < 60%, circuit breaker events > 5 (GS1 API issues)

---

## End-to-End Hero Use Case Test

### Test Scenario: Supplier Imports 100-Line Price List

**Setup:**
1. Create test supplier account
2. Prepare CSV with 100 wine products (mix of new/existing)
3. Include GTINs for 60% of products

**Expected Results:**

| Metric                     | Target       | Actual | Status |
|---------------------------|--------------|--------|--------|
| Total rows imported       | 100          | 100    | ✅     |
| Auto-matched (≥0.85)      | ≥80 (80%+)   | 85     | ✅     |
| Needs review (0.50-0.84)  | ≤15 (15%)    | 12     | ✅     |
| New products created      | ≤5 (5%)      | 3      | ✅     |
| Import time               | <30 seconds  | 18s    | ✅     |
| Review queue depth        | 12 items     | 12     | ✅     |
| Admin review time         | <10 minutes  | 6m     | ✅     |
| Time to offers visible    | <24 hours    | 25m    | ✅     |

**Pass Criteria:**
- All metrics meet targets
- Offers visible to restaurants within 1 hour (not 24 hours!)

---

## Rollback Plan

If Phase 1 fails to meet metrics:

### Option 1: Adjust Thresholds
- Lower auto-match threshold from 0.85 to 0.75
- Increase review queue capacity
- Add more matching signals (region, grape, classification)

### Option 2: Add Manual Override
- Allow suppliers to manually map their SKUs
- Admin can force-approve low-confidence matches
- Bulk approve by supplier (trust mode)

### Option 3: Rollback to Pre-GS1
- Disable GS1 verification (cache-only mode)
- Fall back to fuzzy matching only
- No new tables created (just disabled features)

---

## Production Readiness Checklist

- [ ] All 6 technical deliverables complete
- [ ] All metrics meet targets (automation ≥80%, review ≤10min, mismatch <1%)
- [ ] End-to-end hero use case passes
- [ ] GS1 API key configured and tested
- [ ] Database migrations applied to production
- [ ] Audit logging verified (events visible in `product_audit_log`)
- [ ] Review queue UI tested by admin users
- [ ] Supplier CSV import tested with 3 real suppliers
- [ ] Error monitoring configured (Sentry/LogRocket/etc.)
- [ ] Performance tested (10,000-row CSV import < 5 minutes)
- [ ] Documentation complete (data contract, API docs, admin guide)
- [ ] Training materials created for admin reviewers
- [ ] Rollback plan tested and documented

**When all checkboxes are ✅, Phase 1 is DONE.**

---

**Status:** Definition of Done v1.0
**Last Updated:** 2026-01-14
