# GS1 Phase 1: Complete Implementation Package

**Status:** ✅ Ready to Start Coding
**Created:** 2026-01-14
**Hero Use Case:** Supplier uploads price list → 80%+ auto-matched → remaining 20% reviewed within 24 hours → restaurant sees offers

---

## What You Have Now

All technical artifacts needed to implement GS1 Phase 1:

### A) Database Schema ✅
**File:** `supabase/migrations/20260114_gs1_phase1.sql`
- 7 tables (minimal, no bloat)
- All indexes, constraints, triggers
- Helper functions for ID generation
- RLS policies
- ~380 lines of SQL

**To Apply:**
1. Open Supabase Dashboard SQL Editor
2. Paste migration SQL
3. Click "Run"
4. Verify 7 tables created

---

### B) GS1 Verification Service ✅
**File:** `lib/gs1/verification-service.ts`
- `verifyGTIN(gtin, options)` - single GTIN verification
- `verifyBatch(gtins, options)` - batch verification (concurrency-safe)
- Cache-first pattern (30-day TTL for verified, 7-day for not found)
- Rate limiting (60 requests/minute)
- Circuit breaker (5 failures → 1 minute timeout)
- Graceful degradation (stale cache if GS1 down)
- ~450 lines of TypeScript

**To Test:**
```typescript
import { gs1Service } from '@/lib/gs1/verification-service';

const result = await gs1Service.verifyGTIN('7312040017218');
console.log(result); // { gtin, verified, source, productData }
```

---

### C) Product Matching Engine ✅
**File:** `lib/matching/product-matcher.ts`
- `matchProduct(supplierId, input)` - single product matching
- `matchBatch(supplierId, inputs)` - batch matching
- 3-tier confidence scoring:
  - GTIN exact → 1.00 (auto-match)
  - Existing SKU → 0.90 (auto-match)
  - Fuzzy match → 0.50-0.80 (review queue)
- Guardrails (volume, pack, vintage, units)
- ~500 lines of TypeScript

**To Test:**
```typescript
import { productMatcher } from '@/lib/matching/product-matcher';

const result = await productMatcher.matchProduct('supplier-id', {
  supplierSku: 'MARG-2015-750',
  gtinEach: '3012345678901',
  producerName: 'Château Margaux',
  productName: 'Château Margaux 2015',
  vintage: 2015,
  volumeMl: 750,
  packType: 'bottle',
  unitsPerCase: 1
});

console.log(result); // { status: 'auto_matched', confidence: 1.00 }
```

---

### D) Admin Review Queue UI Spec ✅
**File:** `ADMIN_REVIEW_QUEUE_SPEC.md`
- Complete wireframes (ASCII art)
- UI components breakdown
- API endpoints specification
- User actions flow
- Design tokens (colors, typography, spacing)
- Success metrics
- ~350 lines of documentation

**What to Build:**
- Page: `/admin/product-review`
- APIs:
  - `GET /api/admin/product-review` (list items)
  - `POST /api/admin/product-review/:id/approve` (approve match)
  - `POST /api/admin/product-review/:id/create-new` (create new product)
  - `POST /api/admin/product-review/:id/reject` (reject)

---

### E) Supplier Data Contract ✅
**File:** `SUPPLIER_DATA_CONTRACT.md`
- Complete CSV schema (required + optional columns)
- Validation rules with code examples
- Example CSV file
- Common errors & solutions
- Import processing flow
- API endpoint spec
- ~400 lines of documentation

**CSV Schema:**
- 12 required columns (supplier_sku, producer_name, product_name, vintage, volume_ml, etc.)
- 8 optional columns (gtin_each, gtin_case, country_of_origin, region, etc.)

**Example:**
```csv
supplier_sku,producer_name,product_name,vintage,volume_ml,pack_type,price_net
MARG-2015,Château Margaux,Château Margaux 2015,2015,750,bottle,390.00
```

---

### F) Definition of Done ✅
**File:** `GS1_PHASE1_DEFINITION_OF_DONE.md`
- 6 technical deliverables checklist
- 5 success metrics with SQL queries:
  - Automation rate (target: ≥80%)
  - Review time per supplier (target: ≤10 minutes)
  - Mismatch rate (target: <1%)
  - GTIN coverage (target: ≥50%)
  - GS1 API health (target: ≥99% uptime, ≥80% cache hit)
- End-to-end hero use case test
- Rollback plan
- Production readiness checklist
- ~600 lines of documentation

**When is Phase 1 DONE?**
- All 6 deliverables complete
- All metrics meet targets
- Hero use case passes
- Production readiness checklist ✅

---

### G) Implementation Sequence ✅
**File:** `GS1_PHASE1_IMPLEMENTATION_SEQUENCE.md`
- 10-day build schedule (2 weeks)
- Day-by-day tasks:
  - Day 1: Database schema
  - Day 2: GS1 verification service
  - Day 3: Product matching engine
  - Day 4: CSV import API
  - Day 5: Audit logging
  - Day 6: Admin review queue API
  - Day 7-8: Admin review queue UI
  - Day 9: Supplier CSV import UI
  - Day 10: End-to-end testing
- Verification steps for each day
- Common pitfalls & solutions
- Daily standup template
- ~500 lines of documentation

**Start Here:**
```bash
# Day 1 - Apply database migration
cd /path/to/winefeed
# Open Supabase Dashboard SQL Editor
# Paste supabase/migrations/20260114_gs1_phase1.sql
# Click "Run"

# Verify
# Run: SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'product%';
# Should see 7 tables
```

---

## File Inventory

All files created in this session:

```
supabase/migrations/
  └── 20260114_gs1_phase1.sql                    # Database schema (380 lines)

lib/gs1/
  └── verification-service.ts                    # GS1 verification service (450 lines)

lib/matching/
  └── product-matcher.ts                         # Product matching engine (500 lines)

docs/ (or root)
  ├── ADMIN_REVIEW_QUEUE_SPEC.md                # Admin UI spec (350 lines)
  ├── SUPPLIER_DATA_CONTRACT.md                  # CSV schema (400 lines)
  ├── GS1_PHASE1_DEFINITION_OF_DONE.md          # Success criteria (600 lines)
  ├── GS1_PHASE1_IMPLEMENTATION_SEQUENCE.md     # Build schedule (500 lines)
  └── GS1_PHASE1_SUMMARY.md                     # This file

Total: ~3,180 lines of code + documentation
```

---

## Quick Start (First 30 Minutes)

### Step 1: Apply Database Migration (5 min)
```bash
# 1. Open Supabase Dashboard: https://supabase.com/dashboard
# 2. Go to SQL Editor
# 3. Paste migration from: supabase/migrations/20260114_gs1_phase1.sql
# 4. Click "Run"
# 5. Verify: SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'product%';
```

### Step 2: Configure Environment (5 min)
```bash
# Add to .env.local
GS1_API_KEY=your_gs1_api_key_here
GS1_API_URL=https://api.gs1.se/v1
```

### Step 3: Test GS1 Service (10 min)
```bash
# Create test script: scripts/test-gs1.ts
import { gs1Service } from '../lib/gs1/verification-service';

async function test() {
  const result = await gs1Service.verifyGTIN('7312040017218');
  console.log('✅ GS1 verification:', result);
}

test();

# Run: npx tsx scripts/test-gs1.ts
```

### Step 4: Test Matching Engine (10 min)
```bash
# Create test script: scripts/test-matcher.ts
import { productMatcher } from '../lib/matching/product-matcher';

async function test() {
  const result = await productMatcher.matchProduct('test-supplier', {
    supplierSku: 'TEST-001',
    gtinEach: '7312040017218',
    producerName: 'Test Producer',
    productName: 'Test Wine',
    vintage: 2020,
    volumeMl: 750,
    packType: 'bottle',
    unitsPerCase: 1
  });
  console.log('✅ Match result:', result);
}

test();

# Run: npx tsx scripts/test-matcher.ts
```

**If all 4 steps pass → Ready to build APIs!**

---

## Next Steps (Choose Your Path)

### Path A: Backend-First (Recommended)
1. ✅ Database schema (done)
2. ✅ GS1 service (done)
3. ✅ Matcher (done)
4. ⏭️ Build CSV import API (Day 4)
5. ⏭️ Build admin review queue API (Day 6)
6. ⏭️ Build admin UI (Day 7-8)
7. ⏭️ End-to-end test (Day 10)

### Path B: Full-Stack Parallel
1. ✅ Database schema (done)
2. ✅ Services (done)
3. ⏭️ Developer A: Build APIs (Days 4-6)
4. ⏭️ Developer B: Build UI (Days 7-9) in parallel
5. ⏭️ Integrate + test (Day 10)

### Path C: Proof of Concept First
1. ✅ Database schema (done)
2. ✅ Services (done)
3. ⏭️ Build minimal CSV import (no UI, API-only)
4. ⏭️ Test with 1 real supplier (100 products)
5. ⏭️ Measure automation rate
6. ⏭️ If ≥80% → continue to full build
7. ⏭️ If <80% → tune matcher, retry

---

## Decision Point: Start Now or Review?

### Option 1: START CODING NOW ✅
- All artifacts ready
- Clear 10-day schedule
- No ambiguity
- **Action:** Apply database migration, start Day 1

### Option 2: REVIEW & ADJUST
- Review artifacts with team
- Adjust thresholds (e.g., auto-match 0.75 instead of 0.85)
- Add/remove features
- **Action:** Schedule 1-hour review meeting

### Option 3: POC FIRST
- Build minimal version (3-4 days)
- Test with 1 supplier
- Validate metrics
- **Action:** Follow "Path C" above

---

## Support & Questions

If you get stuck during implementation:

**Database Issues:**
- Check migration file: `supabase/migrations/20260114_gs1_phase1.sql`
- Verify all 7 tables exist
- Check for constraint errors (unique, foreign keys)

**GS1 API Issues:**
- Verify `GS1_API_KEY` is set
- Test with curl: `curl -H "Authorization: Bearer $GS1_API_KEY" https://api.gs1.se/v1/products/7312040017218`
- If no API key → use cache-only mode (will work but no new verifications)

**Matching Issues:**
- Check guardrails (volume, pack, vintage)
- Lower confidence threshold temporarily (0.75 instead of 0.85)
- Add debug logs to see why matches fail

**Performance Issues:**
- Add indexes on `producer`, `wine_name` columns
- Limit candidate search to top 50 products
- Use batch matching for large imports

---

## Success Looks Like This

**After Phase 1 (2 weeks):**

✅ **Supplier uploads 100-line CSV**
- Import time: <30 seconds
- Auto-matched: 85 products (85%)
- Needs review: 12 products (12%)
- New products: 3 (3%)

✅ **Admin reviews 12 items**
- Review time: 6 minutes total
- All items approved/rejected
- Audit log complete

✅ **Restaurant sees offers**
- Time from CSV upload to offers visible: <25 minutes
- All products have correct volume, vintage, pack type
- No duplicate products in catalog

✅ **Metrics Dashboard**
- Automation rate: 85%
- Mismatch rate: 0.5%
- GTIN coverage: 62%
- GS1 API uptime: 99.8%
- Cache hit rate: 87%

**ALL metrics meet or exceed targets → Phase 1 DONE! 🎉**

---

## Final Checklist Before Starting

- [ ] All files saved in correct locations
- [ ] Database migration ready to apply
- [ ] GS1 API key obtained (or plan to use cache-only mode)
- [ ] Dev environment set up (Node.js, TypeScript, Supabase)
- [ ] Team assigned (1 dev + 1 tester minimum)
- [ ] 2-week sprint planned
- [ ] Metrics dashboard ready (Google Sheets or similar)
- [ ] Test supplier identified (for POC)
- [ ] Rollback plan understood

**When all checkboxes ✅ → START BUILDING!**

---

**Status:** 🚀 Ready to Ship
**Estimated Effort:** 2 weeks (10 days)
**Risk Level:** Low (well-defined scope, clear success criteria)
**Next Action:** Apply database migration and start Day 1

Good luck! 🍷
