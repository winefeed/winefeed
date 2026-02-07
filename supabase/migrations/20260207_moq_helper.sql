-- ============================================
-- MOQ HELPER - Database Schema
-- ============================================
-- Feature flag: FEATURE_MOQ_HELPER=false (default)
--
-- PURPOSE:
-- Help consumers fill up their order to meet importer MOQ
-- AFTER an access request has been ACCEPTED.
--
-- POLICY (enforced at multiple levels):
-- 1. Only available when access_request.status = 'besvarad' (accepted)
-- 2. Only request owner can add items
-- 3. Items must be from SAME importer as original request
-- 4. NO cart, NO checkout, NO payment totals
-- 5. This is a "fill-up helper", not commerce
-- ============================================

-- ============================================
-- 1. ADD MOQ TO IMPORTERS
-- ============================================
-- Add MOQ fields to existing importers table
-- Using bottles as v1 unit (cases can come later)

ALTER TABLE importers
ADD COLUMN IF NOT EXISTS moq_bottles INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moq_note TEXT DEFAULT NULL;

COMMENT ON COLUMN importers.moq_bottles IS 'Minimum order quantity in bottles. NULL = no MOQ or unknown.';
COMMENT ON COLUMN importers.moq_note IS 'Optional note about MOQ terms (e.g., "6 bottles minimum for first order")';

-- ============================================
-- 2. ACCESS_REQUEST_ITEMS TABLE
-- ============================================
-- Stores additional items added to an access request
-- Original item is in access_requests itself (wine_id, quantity)
-- This table is for MOQ fill-up additions only

CREATE TABLE IF NOT EXISTS access_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent request
  access_request_id UUID NOT NULL REFERENCES access_requests(id) ON DELETE CASCADE,

  -- The lot/wine being added
  lot_id UUID NOT NULL REFERENCES access_lots(id),
  wine_id UUID NOT NULL REFERENCES access_wines(id),

  -- Denormalized for display (avoids joins)
  wine_name TEXT NOT NULL,
  vintage INTEGER, -- NULL for NV
  importer_name TEXT NOT NULL,

  -- Quantity
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 24),

  -- Origin tracking
  added_reason TEXT NOT NULL DEFAULT 'MOQ_HELPER' CHECK (added_reason IN ('MOQ_HELPER', 'MANUAL', 'SUGGESTED')),

  -- Audit
  added_by UUID, -- consumer user id (nullable for system additions)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE access_request_items IS 'Additional items added to access requests (e.g., MOQ fill-up). Original item is in access_requests table.';
COMMENT ON COLUMN access_request_items.added_reason IS 'Why this item was added: MOQ_HELPER (fill-up), MANUAL (user chose), SUGGESTED (system recommended)';
COMMENT ON COLUMN access_request_items.quantity IS 'Quantity in bottles. Capped at 24 per item.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_access_request_items_request
  ON access_request_items(access_request_id);
CREATE INDEX IF NOT EXISTS idx_access_request_items_lot
  ON access_request_items(lot_id);

-- ============================================
-- 3. MOQ_HELPER_EVENTS TABLE (Audit/Analytics)
-- ============================================
-- Tracks MOQ helper interactions for learning and optimization

CREATE TABLE IF NOT EXISTS moq_helper_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  access_request_id UUID NOT NULL REFERENCES access_requests(id) ON DELETE CASCADE,
  actor_id UUID, -- consumer user id (nullable for anonymous)

  -- Event
  event_type TEXT NOT NULL CHECK (event_type IN (
    'BANNER_SHOWN',      -- MOQ banner displayed to user
    'SUGGESTIONS_SHOWN', -- Suggestion list rendered
    'SUGGESTION_CLICKED',-- User clicked a suggestion
    'ITEM_ADDED',        -- Item successfully added
    'ITEM_REMOVED',      -- Item removed (if we support that)
    'DISMISSED'          -- User dismissed the banner
  )),

  -- Payload (flexible for different event types)
  payload JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- BANNER_SHOWN: {moq: 6, current: 2, deficit: 4}
  -- SUGGESTIONS_SHOWN: {suggestion_ids: [...], count: 8}
  -- ITEM_ADDED: {lot_id: "...", quantity: 2, new_total: 4}

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE moq_helper_events IS 'Analytics/audit log for MOQ helper interactions. Used for learning and conversion optimization.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_moq_helper_events_request
  ON moq_helper_events(access_request_id);
CREATE INDEX IF NOT EXISTS idx_moq_helper_events_type
  ON moq_helper_events(event_type);
CREATE INDEX IF NOT EXISTS idx_moq_helper_events_created
  ON moq_helper_events(created_at DESC);

-- ============================================
-- 4. TRIGGER: Enforce ACCEPTED status on item add
-- ============================================
-- Items can ONLY be added when request status is 'besvarad' (accepted)

CREATE OR REPLACE FUNCTION check_request_accepted_for_item()
RETURNS TRIGGER AS $$
DECLARE
  request_status TEXT;
BEGIN
  SELECT status INTO request_status
  FROM access_requests
  WHERE id = NEW.access_request_id;

  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Access request not found: %', NEW.access_request_id;
  END IF;

  -- Only allow items when request is accepted
  -- 'besvarad' = accepted in Vinkoll Access flow
  IF request_status NOT IN ('besvarad', 'meddelad', 'slutford') THEN
    RAISE EXCEPTION 'Items can only be added to ACCEPTED requests. Current status: %', request_status
      USING HINT = 'Wait for importer to accept the request before adding items.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_request_accepted_for_item
  BEFORE INSERT ON access_request_items
  FOR EACH ROW
  EXECUTE FUNCTION check_request_accepted_for_item();

COMMENT ON TRIGGER trg_check_request_accepted_for_item ON access_request_items IS
  'POLICY: Items can only be added to ACCEPTED requests (besvarad/meddelad/slutford)';

-- ============================================
-- 5. TRIGGER: Enforce same importer
-- ============================================
-- Added items must be from the SAME importer as the original request

CREATE OR REPLACE FUNCTION check_item_same_importer()
RETURNS TRIGGER AS $$
DECLARE
  request_importer_id UUID;
  lot_importer_id UUID;
BEGIN
  -- Get importer from the original request
  SELECT importer_id INTO request_importer_id
  FROM access_requests
  WHERE id = NEW.access_request_id;

  -- Get importer from the lot being added
  SELECT importer_id INTO lot_importer_id
  FROM access_lots
  WHERE id = NEW.lot_id;

  IF request_importer_id IS NULL OR lot_importer_id IS NULL THEN
    RAISE EXCEPTION 'Cannot verify importer match: request_importer=%, lot_importer=%',
      request_importer_id, lot_importer_id;
  END IF;

  IF request_importer_id != lot_importer_id THEN
    RAISE EXCEPTION 'Item must be from same importer as original request. Request importer: %, Item importer: %',
      request_importer_id, lot_importer_id
      USING HINT = 'MOQ fill-up items must come from the same importer.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_item_same_importer
  BEFORE INSERT ON access_request_items
  FOR EACH ROW
  EXECUTE FUNCTION check_item_same_importer();

COMMENT ON TRIGGER trg_check_item_same_importer ON access_request_items IS
  'POLICY: Added items must be from the SAME importer as the original request';

-- ============================================
-- 6. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE access_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE moq_helper_events ENABLE ROW LEVEL SECURITY;

-- Service role full access (for server-side operations)
CREATE POLICY "Service role full access on access_request_items"
  ON access_request_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on moq_helper_events"
  ON moq_helper_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: Consumer access is handled via API routes with auth checks
-- We don't expose these tables directly to anon users

-- ============================================
-- 7. HELPER VIEW: Request with total bottles
-- ============================================
-- Convenient view to get request + total bottles (original + added)

CREATE OR REPLACE VIEW access_request_totals AS
SELECT
  ar.id,
  ar.consumer_id,
  ar.wine_id,
  ar.lot_id,
  ar.importer_id,
  ar.importer_name,
  ar.quantity AS original_quantity,
  ar.status,
  COALESCE(SUM(ari.quantity), 0)::INTEGER AS added_quantity,
  (ar.quantity + COALESCE(SUM(ari.quantity), 0))::INTEGER AS total_quantity
FROM access_requests ar
LEFT JOIN access_request_items ari ON ari.access_request_id = ar.id
GROUP BY ar.id;

COMMENT ON VIEW access_request_totals IS 'Access requests with original + added item quantities summed';

-- ============================================
-- 8. NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';
