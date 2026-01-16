# Apply Requests Migration

⚠️ **REQUIRED BEFORE RUNNING SMOKE TEST** ⚠️

The `requests` table needs `accepted_offer_id` and `status` columns for Pilot Loop 1.0.

## Quick Apply (Copy-Paste)

1. Open Supabase SQL Editor:
   👉 **https://pqmmgclfpyydrbjaoump.supabase.co/project/_/sql**

2. Copy and paste this SQL:

```sql
-- ============================================================================
-- ADD ACCEPTED_OFFER_ID AND STATUS TO REQUESTS - PILOT LOOP 1.0
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

-- Check that columns were added
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
   accepted_offer_id | uuid | NULL | YES
   status           | text | 'OPEN'::text | NO
   ```

5. Run smoke test:
   ```bash
   npm run test:pilotloop:mvp
   ```

## What This Does

- ✅ Adds `accepted_offer_id` column (nullable FK to offers)
- ✅ Adds `status` column (OPEN/ACCEPTED/CLOSED/CANCELLED)
- ✅ Creates indexes for performance
- ✅ Adds FK constraint for referential integrity
- ✅ Sets default status to 'OPEN'

## Security Note

**Tenant Isolation Strategy:**

- `requests` table does NOT have `tenant_id` column (single-tenant design in MVP)
- Tenant isolation enforced via:
  1. `offers.tenant_id` filtering when fetching offers for a request
  2. Service layer validation (offer must belong to tenant before updating request)
  3. Future: Add `tenant_id` to requests or scope via `restaurants.tenant_id` JOIN

This is safe for MVP because:
- Offer acceptance validates request_id comes from tenant-scoped offer
- Requests API filters offers by tenant_id when returning related offers
- No cross-tenant data leakage possible through the offer→request flow
