-- ============================================================================
-- VINKOLL ACCESS — Mediation Engine: Database Migration
-- Run this in Supabase SQL Editor
--
-- CONTEXT: access_requests.status is TEXT (not enum), responded_at already exists.
-- This migration adds mediation-specific columns and an optional CHECK constraint.
-- All statements are idempotent (safe to run multiple times).
-- ============================================================================

-- 1) Add mediation columns (all IF NOT EXISTS = safe to re-run)
ALTER TABLE access_requests
  ADD COLUMN IF NOT EXISTS response_price_sek       numeric,
  ADD COLUMN IF NOT EXISTS response_quantity        integer,
  ADD COLUMN IF NOT EXISTS response_delivery_days   integer,
  ADD COLUMN IF NOT EXISTS response_note            text,
  ADD COLUMN IF NOT EXISTS forwarded_at             timestamptz,
  ADD COLUMN IF NOT EXISTS consumer_notified_at     timestamptz;

-- 2) responded_at already exists in original schema — verify, add if somehow missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN responded_at timestamptz;
  END IF;
END$$;

-- 3) Status is TEXT, not an enum. Add CHECK constraint with 'seen' included.
--    Drop-then-recreate pattern handles both fresh installs and upgrades.
DO $$
BEGIN
  ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_status_check;
  ALTER TABLE access_requests ADD CONSTRAINT access_requests_status_check
    CHECK (status IN ('pending', 'seen', 'accepted', 'declined', 'expired'));
EXCEPTION WHEN OTHERS THEN
  -- If something unexpected, log and continue (text column works without constraint)
  RAISE NOTICE 'Could not add status CHECK constraint: %', SQLERRM;
END$$;

-- 4) Index for admin cockpit queries (action-first sorting)
CREATE INDEX IF NOT EXISTS idx_access_requests_admin_action
  ON access_requests (status, forwarded_at, responded_at)
  WHERE status IN ('pending', 'seen', 'accepted', 'declined');

-- 5) Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'access_requests'
ORDER BY ordinal_position;
