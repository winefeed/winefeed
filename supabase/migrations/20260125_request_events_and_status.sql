-- =============================================================================
-- MIGRATION: Request Events & Status Updates
--
-- Adds audit trail for request status changes and ensures status enum is complete.
-- =============================================================================

-- 1. Create request_events table for audit trail
CREATE TABLE IF NOT EXISTS request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'status_change', 'offer_received', 'offer_accepted', etc.
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata JSONB DEFAULT '{}',
  actor_user_id UUID,
  actor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_request_events_request_id ON request_events(request_id);
CREATE INDEX IF NOT EXISTS idx_request_events_created_at ON request_events(created_at DESC);

-- 2. Add DRAFT status to requests if not exists (for future use)
-- Note: Current requests use OPEN as initial status, DRAFT can be used for saved-but-not-sent requests

-- 3. Add closed_at and cancelled_at timestamps to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- 4. Create function to log request status changes
CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO request_events (
      request_id,
      event_type,
      from_status,
      to_status,
      metadata
    ) VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'accepted_offer_id', NEW.accepted_offer_id,
        'closed_reason', NEW.closed_reason,
        'cancelled_reason', NEW.cancelled_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for automatic logging
DROP TRIGGER IF EXISTS trigger_request_status_change ON requests;
CREATE TRIGGER trigger_request_status_change
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_status_change();

-- 6. Add RLS policies for request_events
ALTER TABLE request_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to request_events"
  ON request_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- OFFER STATUS UPDATES
-- =============================================================================

-- 7. Add VIEWED and EXPIRED statuses to offers if CHECK constraint allows
-- Note: We'll handle this in application layer since offers use TEXT with CHECK

-- 8. Add viewed_at and expired_at columns to offers
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;  -- When the offer will expire

-- =============================================================================
-- IMPORT STATUS UPDATES
-- =============================================================================

-- 9. Ensure import_status enum has all needed values
-- Note: Adding new enum values is safe (existing data unaffected)
DO $$
BEGIN
  -- Add DOCS_PENDING if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DOCS_PENDING' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'DOCS_PENDING' AFTER 'SUBMITTED';
  END IF;

  -- Add IN_TRANSIT if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'IN_TRANSIT' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT' AFTER 'DOCS_PENDING';
  END IF;

  -- Add CLEARED if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLEARED' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'CLEARED' AFTER 'IN_TRANSIT';
  END IF;

  -- Add CLOSED if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLOSED' AND enumtypid = 'import_status'::regtype) THEN
    ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'CLOSED' AFTER 'APPROVED';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Enum might not exist or values might already exist
    NULL;
END $$;

-- =============================================================================
-- ORDER STATUS UPDATES
-- =============================================================================

-- 10. Add PENDING status to order_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING' AND enumtypid = 'order_status'::regtype) THEN
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'CONFIRMED';
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Done!
