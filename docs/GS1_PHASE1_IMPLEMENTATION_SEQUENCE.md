# GS1 Phase 1: Implementation Sequence

**Goal:** Build minimal GS1 integration in 2 weeks (10 working days)

**Team:** 1 full-stack developer + 1 part-time admin/tester

---

## Week 1: Backend Foundation (Days 1-5)

### Day 1: Database Schema
**Tasks:**
- [ ] Apply migration `20260114_gs1_phase1.sql` to dev database
- [ ] Verify all 7 tables created
- [ ] Test helper functions (`generate_wf_product_id`, `generate_wf_family_id`)
- [ ] Seed test data (5 product families, 20 master products)

**Deliverable:** Database schema ready

**Verification:**
```bash
# Apply migration
cd /path/to/winefeed
# (via Supabase Dashboard SQL Editor - paste migration)

# Verify
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'product%' OR table_name LIKE 'gtin%';"

# Should show 7 tables
```

---

### Day 2: GS1 Verification Service
**Tasks:**
- [ ] Create `lib/gs1/verification-service.ts` (already done ✅)
- [ ] Configure `GS1_API_KEY` in `.env.local`
- [ ] Test `verifyGTIN()` with real GTIN (manual test)
- [ ] Test cache (verify → cache hit → cache miss after TTL)
- [ ] Test rate limiting (61 requests/min should fail)
- [ ] Test circuit breaker (mock 5 failures → should open)

**Deliverable:** GS1 service working end-to-end

**Verification:**
```typescript
// Create test file: scripts/test-gs1.ts
import { gs1Service } from '../lib/gs1/verification-service';

async function testGS1() {
  // Test 1: Real GTIN (use a known wine GTIN)
  const result = await gs1Service.verifyGTIN('7312040017218');
  console.log('✅ GS1 verification:', result);

  // Test 2: Cache hit
  const cached = await gs1Service.verifyGTIN('7312040017218');
  console.assert(cached.source === 'cache', 'Should be cache hit');

  // Test 3: Batch
  const batch = await gs1Service.verifyBatch([
    '7312040017218',
    '7312040017225',
    '7312040017232'
  ]);
  console.log('✅ Batch verification:', batch.size);
}

testGS1();
```

---

### Day 3: Product Matching Engine
**Tasks:**
- [ ] Create `lib/matching/product-matcher.ts` (already done ✅)
- [ ] Test GTIN exact match (should return confidence 1.00)
- [ ] Test existing SKU mapping (should return confidence 0.90)
- [ ] Test fuzzy match (should return candidates with reasons)
- [ ] Test guardrails (volume mismatch should block)
- [ ] Test batch matching (100 products < 10 seconds)

**Deliverable:** Matching engine working with all 3 tiers

**Verification:**
```typescript
// Create test file: scripts/test-matcher.ts
import { productMatcher } from '../lib/matching/product-matcher';

async function testMatcher() {
  const supplierId = 'TEST_SUPPLIER_ID';

  // Test 1: GTIN exact match
  const gtinMatch = await productMatcher.matchProduct(supplierId, {
    supplierSku: 'TEST-001',
    gtinEach: '7312040017218',
    producerName: 'Systembolaget',
    productName: 'Test Wine',
    vintage: 2020,
    volumeMl: 750,
    packType: 'bottle',
    unitsPerCase: 1
  });
  console.assert(gtinMatch.status === 'auto_matched', 'GTIN match failed');
  console.log('✅ GTIN exact match:', gtinMatch.confidence);

  // Test 2: Fuzzy match
  const fuzzyMatch = await productMatcher.matchProduct(supplierId, {
    supplierSku: 'TEST-002',
    producerName: 'Chateau Margau',  // Typo
    productName: 'Margaux 2015',
    vintage: 2015,
    volumeMl: 750,
    packType: 'bottle',
    unitsPerCase: 1
  });
  console.log('✅ Fuzzy match:', fuzzyMatch.status, fuzzyMatch.candidates?.length);

  // Test 3: Guardrail (volume mismatch)
  const blocked = await productMatcher.matchProduct(supplierId, {
    supplierSku: 'TEST-003',
    gtinEach: '7312040017218',
    producerName: 'Test',
    productName: 'Test',
    volumeMl: 1500,  // Wrong volume
    packType: 'bottle',
    unitsPerCase: 1
  });
  console.assert(blocked.status === 'no_match', 'Guardrail failed');
  console.log('✅ Guardrail blocked:', blocked.guardrailBlocked);
}

testMatcher();
```

---

### Day 4: CSV Import API (Part 1 - Backend)
**Tasks:**
- [ ] Create `app/api/suppliers/[id]/catalog/import/route.ts`
- [ ] Parse CSV file (use `papaparse` or similar)
- [ ] Validate CSV schema (check required columns)
- [ ] Validate each row (data types, ranges, etc.)
- [ ] For each valid row:
  - Call `productMatcher.matchProduct()`
  - If auto-match → create `supplier_product_mappings`
  - If needs review → insert into `product_match_review_queue`
  - If no match → create new `master_products` + mapping
- [ ] Return import summary (totalRows, autoMatched, needsReview, etc.)

**Deliverable:** CSV import API working end-to-end

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
  -F 'file=@/tmp/test_import.csv' \
  | jq .

# Expected: {"success": true, "summary": {...}}
```

---

### Day 5: Audit Logging
**Tasks:**
- [ ] Create audit logging utility `lib/audit/logger.ts`
- [ ] Log all product/mapping events to `product_audit_log`
- [ ] Test audit log writes (should be fast, non-blocking)
- [ ] Verify audit logs in database

**Code:**
```typescript
// lib/audit/logger.ts
import { createClient } from '@supabase/supabase-js';

export async function logAuditEvent(params: {
  eventType: string;
  entityType: string;
  entityId: string;
  userId?: string;
  userEmail?: string;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('product_audit_log').insert({
    event_type: params.eventType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    user_id: params.userId,
    user_email: params.userEmail,
    before_state: params.beforeState,
    after_state: params.afterState,
    metadata: params.metadata
  });
}
```

**Verification:**
```sql
-- Check audit logs
SELECT * FROM product_audit_log ORDER BY created_at DESC LIMIT 10;
```

---

## Week 2: Frontend & Integration (Days 6-10)

### Day 6: Admin Review Queue API
**Tasks:**
- [ ] Create `app/api/admin/product-review/route.ts` (GET)
  - List pending review items
  - Pagination, filters (supplier, status)
- [ ] Create `app/api/admin/product-review/[id]/approve/route.ts` (POST)
  - Approve match → create mapping
  - Update queue item status
  - Log audit event
- [ ] Create `app/api/admin/product-review/[id]/create-new/route.ts` (POST)
  - Create new product family + master product
  - Create mapping
  - Update queue item
  - Log audit events
- [ ] Create `app/api/admin/product-review/[id]/reject/route.ts` (POST)
  - Update queue item status = 'rejected'
  - Log audit event

**Deliverable:** Review queue API ready

**Verification:**
```bash
# List pending
curl 'http://localhost:3000/api/admin/product-review?status=pending' | jq .

# Approve match
curl -X POST 'http://localhost:3000/api/admin/product-review/QUEUE_ID/approve' \
  -H 'Content-Type: application/json' \
  -d '{"masterProductId": "PRODUCT_ID"}' \
  | jq .
```

---

### Day 7-8: Admin Review Queue UI
**Tasks:**
- [ ] Create page `app/admin/product-review/page.tsx`
- [ ] Fetch pending items via API
- [ ] Display review item cards:
  - Supplier data section
  - Match candidates (top 3) with confidence scores
  - Match reasons (bullet points)
- [ ] Action buttons:
  - "✓ Approve Match" (per candidate)
  - "Create New Product" (per candidate)
  - "⨉ Reject All"
- [ ] Handle API responses (success/error toasts)
- [ ] Pagination (10 items per page)

**Deliverable:** Admin UI working end-to-end

**Verification:**
1. Open `http://localhost:3000/admin/product-review`
2. Should see pending review items
3. Click "Approve Match" → should create mapping + remove item
4. Verify mapping in database

---

### Day 9: Supplier CSV Import UI (Optional - can use API only)
**Tasks:**
- [ ] Create page `app/suppliers/catalog/import/page.tsx`
- [ ] File upload component (accept `.csv`, max 10MB)
- [ ] Call import API
- [ ] Show import summary (totalRows, autoMatched, needsReview, etc.)
- [ ] Link to review queue if items need review

**Deliverable:** Supplier-facing import UI

**Verification:**
1. Upload test CSV
2. Should see import summary
3. If items need review → click link to review queue

---

### Day 10: End-to-End Testing & Documentation
**Tasks:**
- [ ] Run end-to-end hero use case test (100-line CSV import)
- [ ] Measure metrics:
  - Automation rate (should be ≥80%)
  - Review time (should be ≤10 minutes)
  - Import time (should be <30 seconds)
- [ ] Fix any bugs found during testing
- [ ] Write admin user guide (how to use review queue)
- [ ] Update supplier data contract documentation
- [ ] Create video walkthrough (optional but recommended)

**Deliverable:** Phase 1 complete and documented

**Verification:**
- All checkboxes in `GS1_PHASE1_DEFINITION_OF_DONE.md` are ✅

---

## Daily Standup Template

```markdown
## Day X Standup

**Yesterday:**
- Completed: [X]
- Blockers: [None | GS1 API key not working]

**Today:**
- Goal: [Implement CSV import API]
- Tasks:
  1. [Parse CSV file]
  2. [Validate rows]
  3. [Call matcher for each row]

**Blockers:**
- [None | Need real GTINs for testing]

**Metrics:**
- Lines of code: [~500 LOC]
- Tests passing: [8/10]
- Coverage: [75%]
```

---

## Common Pitfalls & Solutions

### Pitfall 1: GS1 API Key Issues
**Problem:** GS1 API returns 401 Unauthorized
**Solution:**
1. Verify `GS1_API_KEY` is set in `.env.local`
2. Test with `curl`:
   ```bash
   curl -H "Authorization: Bearer $GS1_API_KEY" \
     https://api.gs1.se/v1/products/7312040017218
   ```
3. If still failing → use cache-only mode during development

---

### Pitfall 2: Fuzzy Matching Too Slow
**Problem:** Fuzzy matching takes >10 seconds per product
**Solution:**
1. Add database indexes on `producer`, `wine_name` (if not already)
2. Pre-filter by volume_ml and pack_type (hard constraints)
3. Limit candidate search to top 50 products
4. Consider Elasticsearch for fuzzy text matching (Phase 2)

---

### Pitfall 3: Review Queue Overwhelmed
**Problem:** Too many items in review queue (>100)
**Solution:**
1. Lower confidence threshold from 0.85 to 0.75 (temporary)
2. Bulk approve by trusted supplier (admin action)
3. Add more matching signals (region, grape, classification)
4. Educate suppliers to provide GTINs (increases auto-match rate)

---

### Pitfall 4: Guardrails Too Strict
**Problem:** Too many matches blocked by guardrails
**Solution:**
1. Review blocked matches in `product_match_review_queue`
2. Check `guardrailBlocked` field for reasons
3. Adjust guardrail rules if needed (e.g., allow vintage diff ±3 years instead of ±2)
4. Add override mechanism (admin can force approve)

---

## What NOT to Build in Phase 1

❌ **Supplier self-service matching** (admin-only in Phase 1)
❌ **Bulk approve** (one-by-one review is fine for pilot)
❌ **Advanced search** (simple filters sufficient)
❌ **Real-time notifications** (email batch once per day is fine)
❌ **GLN verification** (only GTIN in Phase 1)
❌ **Product family auto-merge** (manual merge via admin if needed)
❌ **Elasticsearch integration** (PostgreSQL full-text search sufficient)
❌ **Mobile app** (desktop web only)

---

## Phase 1 → Phase 2 Transition

After Phase 1 is stable (4-6 weeks in production):

**Phase 2 Features:**
1. GLN verification (party/location matching)
2. Supplier self-service matching
3. Bulk actions (approve all from supplier X)
4. Advanced analytics (matching accuracy dashboard)
5. Elasticsearch for fuzzy matching (if needed)
6. OCR + AI for PDF price lists
7. Product family auto-merge (dedupe logic)

**Trigger for Phase 2:**
- Automation rate stable at ≥80%
- Review time stable at ≤10 minutes
- 10+ suppliers onboarded
- 5,000+ products in master catalog

---

**Status:** Implementation Sequence v1.0
**Last Updated:** 2026-01-14
**Estimated Time:** 2 weeks (10 days)
