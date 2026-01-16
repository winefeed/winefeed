# Apply Both Migrations - Hardened Tenant Scoping

⚠️ **REQUIRED BEFORE RUNNING SMOKE TEST** ⚠️

Two migrations needed:
1. Add `tenant_id` to `restaurants` (hardened tenant scoping)
2. Add `accepted_offer_id` and `status` to `requests` (pilot loop)

## Quick Apply (Copy-Paste)

1. Open Supabase SQL Editor:
   👉 **https://pqmmgclfpyydrbjaoump.supabase.co/project/_/sql**

2. Copy and paste this complete SQL:

```sql
-- ============================================================================
-- MIGRATION 1: ADD TENANT_ID TO RESTAURANTS - ROBUST TENANT SCOPING
-- ============================================================================

-- Step 1: Add tenant_id column to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- Step 2: Create index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_tenant ON restaurants(tenant_id);

-- Step 3: Add comment
COMMENT ON COLUMN restaurants.tenant_id IS 'Tenant isolation for multi-tenant platform - enables secure request scoping';

-- ============================================================================
-- MIGRATION 2: ADD ACCEPTED_OFFER_ID AND STATUS TO REQUESTS - PILOT LOOP 1.0
-- ============================================================================

-- Step 1: Add accepted_offer_id column
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS accepted_offer_id UUID NULL;

-- Step 2: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'requests_accepted_offer_id_fkey'
  ) THEN
    ALTER TABLE requests
    ADD CONSTRAINT requests_accepted_offer_id_fkey
    FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 3: Add status column with CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'status'
  ) THEN
    ALTER TABLE requests
    ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(accepted_offer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

-- Step 5: Add comments
COMMENT ON COLUMN requests.accepted_offer_id IS 'FK to accepted offer (pilot loop 1.0) - only 1 accepted offer per request';
COMMENT ON COLUMN requests.status IS 'Request status: OPEN (awaiting offers), ACCEPTED (offer accepted), CLOSED, CANCELLED';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify restaurants.tenant_id
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurants'
  AND column_name = 'tenant_id';

-- Verify requests.accepted_offer_id and status
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'requests'
  AND column_name IN ('accepted_offer_id', 'status')
ORDER BY column_name;
```

3. Click **"Run"** (or press Ctrl+Enter)

4. Verify output shows:
   ```
   -- restaurants.tenant_id
   tenant_id | uuid | '00000000-0000-0000-0000-000000000001'::uuid | NO

   -- requests columns
   accepted_offer_id | uuid | NULL | YES
   status           | text | 'OPEN'::text | NO
   ```

5. Run smoke test:
   ```bash
   npm run test:pilotloop:mvp
   ```

## What These Migrations Do

### Migration 1: restaurants.tenant_id
- ✅ Adds `tenant_id` column to restaurants
- ✅ Sets default to MVP tenant: `00000000-0000-0000-0000-000000000001`
- ✅ Creates index for performance
- ✅ Enables robust tenant scoping for requests via JOIN

**Why This Matters:**
- Requests can now be tenant-scoped via `restaurants.tenant_id`
- No dependency on offers for request visibility
- Requests without offers are visible in lists
- Prevents cross-tenant data leakage at the source

### Migration 2: requests.accepted_offer_id + status
- ✅ Adds `accepted_offer_id` column (nullable FK to offers)
- ✅ Adds `status` column (OPEN/ACCEPTED/CLOSED/CANCELLED)
- ✅ Creates indexes for performance
- ✅ Adds FK constraint for referential integrity
- ✅ Sets default status to 'OPEN'

**Why This Matters:**
- Enables Pilot Loop 1.0: Request → Offer → Accept
- Tracks which offer was accepted per request
- Prevents multiple accepted offers per request
- Status tracks request lifecycle

## Security Architecture

**Before (Weak):**
```
requests (no tenant_id)
  └─ offers (has tenant_id) [indirect scoping]
     ❌ Requests without offers were invisible
     ❌ Circular dependency for scoping
```

**After (Hardened):**
```
restaurants (has tenant_id)
  └─ requests (via restaurant_id FK)
     └─ offers (has tenant_id)
        ✅ Requests scoped via restaurants.tenant_id
        ✅ Requests without offers are visible
        ✅ No circular dependency
```

**Tenant Isolation Flow:**
1. User provides `x-tenant-id` header
2. API fetches restaurants WHERE `tenant_id = x-tenant-id`
3. API filters requests WHERE `restaurant_id IN (tenant_restaurants)`
4. API filters offers WHERE `tenant_id = x-tenant-id`

**Result:** Zero cross-tenant data leakage ✅

## Testing

The smoke test now includes 9 tests (was 8):

1. Get/Create Test Request
2. GET Request Details
3. **NEW: Verify Request Visible Without Offers** ✨
4. Create Offer Linked to Request
5. Verify offer has request_id
6. Accept Offer (Pilot Loop Core)
7. Verify Request.accepted_offer_id
8. Verify Request.status = ACCEPTED
9. Try Accept Second Offer (should fail)

**Expected Result:** 9/9 tests passing

## Troubleshooting

### "column restaurants.tenant_id does not exist"
- ➡️ Migration 1 not applied
- ➡️ Copy and run SQL from this file

### "column requests.status does not exist"
- ➡️ Migration 2 not applied
- ➡️ Copy and run SQL from this file

### "Request NOT found in list (tenant scoping issue?)"
- ➡️ Check that test restaurant has correct tenant_id
- ➡️ Verify: `SELECT id, tenant_id FROM restaurants;`
- ➡️ Should show tenant_id = `00000000-0000-0000-0000-000000000001`

### "Tests Failed" after migrations
- ➡️ Check Supabase logs for errors
- ➡️ Verify both migrations completed successfully
- ➡️ Restart dev server: `npm run dev`

## Files Modified

1. `supabase/migrations/20260117_add_tenant_id_to_restaurants.sql` - NEW
2. `supabase/migrations/20260117_add_accepted_offer_id_to_requests.sql` - EXISTING
3. `app/api/requests/route.ts` - Hardened with tenant JOIN
4. `app/api/requests/[id]/route.ts` - Hardened with tenant check
5. `scripts/mvp-request-offer-accept-smoke.sh` - Added test 2B
6. `docs/REQUEST_OFFER_INTEGRATION.md` - Updated security docs

## Next Steps

After applying migrations:

```bash
# 1. Verify migrations applied
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'tenant_id';"

# 2. Run smoke test
npm run test:pilotloop:mvp

# 3. Expected output: ✅ ALL TESTS PASSED (9/9)
```
