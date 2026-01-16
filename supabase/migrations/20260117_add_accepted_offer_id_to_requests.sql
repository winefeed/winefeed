/**
 * ADD ACCEPTED OFFER ID TO REQUESTS - PILOT LOOP 1.0
 *
 * Purpose: Enable request ↔ offer relationship for pilot loop
 * Flow: Request → Offer → Accept → Request.accepted_offer_id set
 *
 * Changes:
 * 1. Add accepted_offer_id column (nullable FK to offers)
 * 2. Add status column if missing (OPEN/ACCEPTED/CLOSED)
 * 3. Add index for performance
 * 4. Add constraint: only 1 accepted offer per request
 *
 * Security:
 * - RLS policies inherited from requests table
 * - Service layer enforces single accepted offer
 */

-- Add accepted_offer_id column (nullable FK to offers)
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS accepted_offer_id UUID NULL REFERENCES offers(id) ON DELETE SET NULL;

-- Add status column if it doesn't exist (default OPEN)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'requests' AND column_name = 'status') THEN
    ALTER TABLE requests ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
      CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
  END IF;
END
$$;

-- Index for efficient queries
-- Note: Only create tenant_id indexes if tenant_id column exists
DO $$
BEGIN
  -- Check if tenant_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'requests' AND column_name = 'tenant_id') THEN
    -- Create indexes with tenant_id
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(tenant_id, accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(tenant_id, status);
  ELSE
    -- Create indexes without tenant_id (single-tenant mode)
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  END IF;
END
$$;

-- Comments
COMMENT ON COLUMN requests.accepted_offer_id IS 'FK to accepted offer (pilot loop 1.0) - only 1 accepted offer per request';
COMMENT ON COLUMN requests.status IS 'Request status: OPEN (awaiting offers), ACCEPTED (offer accepted), CLOSED, CANCELLED';

-- Constraint: If accepted_offer_id is set, status should be ACCEPTED
-- (This is enforced in application layer for MVP, but could add CHECK constraint)
-- ALTER TABLE requests ADD CONSTRAINT accepted_offer_implies_status
--   CHECK (accepted_offer_id IS NULL OR status = 'ACCEPTED');
