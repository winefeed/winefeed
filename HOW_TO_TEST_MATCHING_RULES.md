# How to Test Matching Rules

## Prerequisites

1. **Node.js installed** (v18+ recommended)
   ```bash
   node --version  # Should show v18.x or higher
   ```

2. **Dependencies installed**
   ```bash
   cd /path/to/winefeed
   npm install
   ```

3. **Database running** with test data (see setup below)

4. **Environment variables set**
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GS1_API_KEY=your_gs1_api_key  # Optional for initial tests
   ```

---

## Setup Test Data (One-Time)

Before running tests, you need some test data in the database:

```sql
-- Run this in Supabase SQL Editor

-- 1. Create a test product family
INSERT INTO product_families (id, wf_family_id, producer, wine_name, country, region)
VALUES (
  gen_random_uuid(),
  'WF-FAM-00001',
  'Château Margaux',
  'Château Margaux',
  'France',
  'Bordeaux'
) RETURNING id;  -- Copy this ID

-- 2. Create a test master product (use family_id from step 1)
INSERT INTO master_products (
  id,
  wf_product_id,
  family_id,
  vintage,
  volume_ml,
  pack_type,
  units_per_case,
  data_source,
  is_active
) VALUES (
  gen_random_uuid(),
  'WF-PROD-00001',
  'PASTE_FAMILY_ID_HERE',
  2015,
  750,
  'bottle',
  1,
  'manual',
  true
) RETURNING id;  -- Copy this ID

-- 3. Create a test GTIN (use master_product_id from step 2)
INSERT INTO product_gtin_registry (
  id,
  master_product_id,
  gtin,
  gtin_level,
  is_verified
) VALUES (
  gen_random_uuid(),
  'PASTE_MASTER_PRODUCT_ID_HERE',
  '7312040017218',
  'each',
  true
);

-- 4. Create a test supplier (if not exists)
INSERT INTO suppliers (id, namn, kontakt_email)
VALUES (
  gen_random_uuid(),
  'Test Supplier',
  'test@supplier.com'
) RETURNING id;  -- Copy this ID for tests
```

---

## Run Tests

```bash
# Full test suite (requires database)
cd /path/to/winefeed
npx tsx scripts/test-matching-rules.ts

# Expected output:
# 🧪 MATCHING RULES TEST SUITE
# ════════════════════════════════════════════════════════════
# Testing product-matcher-v2.ts against MATCHING_RULES.md
#
# 📋 TEST 1: Hard Guardrails (NO_MATCH)
# ────────────────────────────────────────────────────────────
#   ✅ Volume mismatch triggers NO_MATCH
#   ✅ Pack type mismatch triggers NO_MATCH
#   ...
#
# 📊 RESULTS: 35 passed, 0 failed
#
# ✅ ALL TESTS PASSED! 🎉
```

---

## Run Unit Tests (No Database Required)

If you want to test the logic without database setup:

```bash
# Run unit tests (mocks database)
npx tsx scripts/test-matching-rules-unit.ts
```

---

## Troubleshooting

### Error: "Cannot find module '@supabase/supabase-js'"

**Solution:**
```bash
npm install @supabase/supabase-js
```

### Error: "Cannot find module '../lib/gs1/verification-service'"

**Solution:**
Make sure all files are in the correct locations:
```
lib/
  gs1/
    verification-service.ts
  matching/
    product-matcher-v2.ts
scripts/
  test-matching-rules.ts
```

### Error: "Could not find the table 'product_families'"

**Solution:**
Apply the database migration first:
```bash
# Open Supabase Dashboard SQL Editor
# Paste: supabase/migrations/20260114_gs1_phase1.sql
# Click "Run"
```

### Error: Database connection fails

**Solution:**
Check your `.env.local` file:
```bash
cat .env.local | grep SUPABASE

# Should show:
# NEXT_PUBLIC_SUPABASE_URL=https://...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### Tests fail with "No candidates found"

**Solution:**
You need test data in the database (see "Setup Test Data" above).

---

## Test Individual Functions

```typescript
// Create a test file: scripts/test-single.ts

import { productMatcherV2 } from '../lib/matching/product-matcher-v2';

async function test() {
  const result = await productMatcherV2.matchProduct('test-supplier-id', {
    supplierSku: 'TEST-001',
    producerName: 'Château Margaux',
    productName: 'Château Margaux 2015',
    vintage: 2015,
    volumeMl: 750,
    packType: 'bottle',
    unitsPerCase: 1
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

test();
```

Run:
```bash
npx tsx scripts/test-single.ts
```

---

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
name: Test Matching Rules

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx tsx scripts/test-matching-rules.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## What Each Test Group Validates

1. **Guardrails** - Volume, pack, units, ABV mismatches trigger NO_MATCH
2. **Vintage Policy** - Exact match required for auto-match
3. **Scoring Model** - GTIN, producer, product name scoring correct
4. **Decision Thresholds** - 90/80/60 thresholds work correctly
5. **Reason Codes** - Standardized enum values used
6. **Output Format** - Required fields present, correct types
7. **Edge Cases** - Empty strings, special chars, extreme values

---

**Status:** Ready to test (requires Node.js + database setup)
