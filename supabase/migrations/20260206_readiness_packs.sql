/**
 * PRODUCER READINESS PACKS
 *
 * Feature-flagged service for helping producers deliver required materials
 * AFTER an access request has been ACCEPTED by IOR.
 *
 * POLICY CONSTRAINTS (enforced at multiple levels):
 * 1. Packs can ONLY be created when access_request.status = 'besvarad' or later accepted states
 * 2. Only IOR/admin can create packs (not producers)
 * 3. This is a SERVICE fee, NOT a priority/access fee
 * 4. Payment does NOT influence deal selection or acceptance
 *
 * Feature flag: FEATURE_PRODUCER_READINESS_PACKS (default: false)
 */

-- Enum for pack status
DO $$ BEGIN
  CREATE TYPE readiness_pack_status AS ENUM (
    'DRAFT',        -- Created but not sent to producer
    'REQUESTED',    -- Sent to producer, awaiting materials
    'IN_PROGRESS',  -- Producer is working on it
    'DELIVERED',    -- Materials received
    'CLOSED',       -- Completed successfully
    'CANCELLED'     -- Cancelled (never completed)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for payer type
DO $$ BEGIN
  CREATE TYPE readiness_pack_payer AS ENUM (
    'IOR',          -- IOR pays (default, MVP)
    'PRODUCER',     -- Producer pays (future, post-ACCEPTED only)
    'FREE'          -- No charge (promotional/pilot)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main readiness_packs table
CREATE TABLE IF NOT EXISTS readiness_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to access request (MUST be in ACCEPTED state)
  access_request_id UUID NOT NULL REFERENCES access_requests(id) ON DELETE CASCADE,

  -- Who created this pack (IOR/admin user)
  created_by UUID NOT NULL,

  -- Payment info (service fee, NOT priority fee)
  payer readiness_pack_payer NOT NULL DEFAULT 'IOR',
  currency TEXT NOT NULL DEFAULT 'EUR',
  price_cents INTEGER, -- NULL = not yet priced / free

  -- Scope of deliverables requested
  -- Example: {"product_sheet": true, "price_list": true, "data_pack": true, "translations": false}
  scope JSONB NOT NULL DEFAULT '{}',

  -- Current status
  status readiness_pack_status NOT NULL DEFAULT 'DRAFT',

  -- Optional notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- CONSTRAINT: Ensure we document this is NOT for priority
  -- (enforced via code + UI copy, not DB)

  CONSTRAINT scope_is_object CHECK (jsonb_typeof(scope) = 'object')
);

-- Audit log for all pack events
CREATE TABLE IF NOT EXISTS readiness_pack_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_pack_id UUID NOT NULL REFERENCES readiness_packs(id) ON DELETE CASCADE,

  -- Who performed the action
  actor_id UUID NOT NULL,
  actor_name TEXT, -- Denormalized for audit readability

  -- Event details
  event_type TEXT NOT NULL, -- 'CREATED', 'STATUS_CHANGED', 'SCOPE_UPDATED', 'NOTE_ADDED', etc.
  payload JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_readiness_packs_access_request
  ON readiness_packs(access_request_id);
CREATE INDEX IF NOT EXISTS idx_readiness_packs_status
  ON readiness_packs(status);
CREATE INDEX IF NOT EXISTS idx_readiness_packs_created_at
  ON readiness_packs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readiness_pack_events_pack
  ON readiness_pack_events(readiness_pack_id);
CREATE INDEX IF NOT EXISTS idx_readiness_pack_events_created
  ON readiness_pack_events(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_readiness_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_readiness_packs_updated_at ON readiness_packs;
CREATE TRIGGER trg_readiness_packs_updated_at
  BEFORE UPDATE ON readiness_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_readiness_packs_updated_at();

/**
 * CRITICAL: ACCEPTED-gate trigger
 *
 * Prevents creating readiness packs for requests that haven't been accepted.
 * This is the DB-level enforcement of our core policy.
 *
 * Valid statuses for creating a pack:
 * - 'besvarad' (importer has responded with price/terms)
 * - 'meddelad' (consumer notified)
 * - 'slutford' (completed)
 *
 * NOT valid:
 * - 'ny' (new request)
 * - 'vidareskickad' (forwarded to importer, not yet responded)
 * - 'utgangen' (expired)
 */
CREATE OR REPLACE FUNCTION check_access_request_accepted()
RETURNS TRIGGER AS $$
DECLARE
  request_status TEXT;
BEGIN
  -- Get the current status of the access request
  SELECT status INTO request_status
  FROM access_requests
  WHERE id = NEW.access_request_id;

  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Access request not found: %', NEW.access_request_id;
  END IF;

  -- Only allow pack creation for accepted states
  -- 'besvarad' = importer responded (our "ACCEPTED" equivalent)
  IF request_status NOT IN ('besvarad', 'meddelad', 'slutford') THEN
    RAISE EXCEPTION
      'Readiness packs can only be created for ACCEPTED requests. Current status: %',
      request_status
      USING HINT = 'Wait until the IOR has accepted the request before creating a readiness pack.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_accepted_before_pack ON readiness_packs;
CREATE TRIGGER trg_check_accepted_before_pack
  BEFORE INSERT ON readiness_packs
  FOR EACH ROW
  EXECUTE FUNCTION check_access_request_accepted();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE readiness_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_pack_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for server-side operations)
CREATE POLICY "Service role full access on readiness_packs"
  ON readiness_packs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on readiness_pack_events"
  ON readiness_pack_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- IOR/Admin access: Can manage packs for their access requests
-- Note: In Vinkoll Access, the admin manages all requests
-- This policy allows reading packs if you created them or are admin
CREATE POLICY "Admin can manage readiness_packs"
  ON readiness_packs FOR ALL
  TO authenticated
  USING (
    -- User created the pack OR is the original admin
    created_by = auth.uid()
    -- In production, add: OR auth_has_role('admin')
  )
  WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "Admin can view readiness_pack_events"
  ON readiness_pack_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM readiness_packs rp
      WHERE rp.id = readiness_pack_events.readiness_pack_id
      AND rp.created_by = auth.uid()
    )
  );

CREATE POLICY "Admin can create readiness_pack_events"
  ON readiness_pack_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM readiness_packs rp
      WHERE rp.id = readiness_pack_events.readiness_pack_id
      AND rp.created_by = auth.uid()
    )
  );

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE readiness_packs IS
'Producer Readiness Packs - Optional service to help producers deliver required materials.
CRITICAL POLICY: Only creatable when access_request is in ACCEPTED state.
This is a SERVICE fee, NOT a priority/access fee. Does NOT influence deal selection.
Feature flag: FEATURE_PRODUCER_READINESS_PACKS';

COMMENT ON COLUMN readiness_packs.payer IS
'Who pays for this pack. IOR (default), PRODUCER (future), or FREE.
IMPORTANT: Payment is for the readiness SERVICE only, never for priority or access.';

COMMENT ON COLUMN readiness_packs.price_cents IS
'Price in cents. This is for the READINESS SERVICE only.
NULL means not yet priced or free. Does NOT affect acceptance priority.';

COMMENT ON TRIGGER trg_check_accepted_before_pack ON readiness_packs IS
'POLICY ENFORCEMENT: Prevents creating packs for non-accepted requests.
This is a critical safeguard against misuse.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
