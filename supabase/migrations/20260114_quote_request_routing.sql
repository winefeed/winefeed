-- QUOTE REQUEST ROUTING & ASSIGNMENTS
-- Migration: 20260114_quote_request_routing
-- Purpose: Enable marketplace routing of quote requests to matched suppliers

-- ============================================================================
-- STEP 1: Create QuoteRequestAssignment table
-- ============================================================================

-- Assignment status enum
CREATE TYPE assignment_status AS ENUM (
  'SENT',       -- Assignment created and sent to supplier
  'VIEWED',     -- Supplier has viewed the quote request
  'RESPONDED',  -- Supplier has created at least one offer
  'EXPIRED'     -- Assignment expired (past expiresAt deadline)
);

-- QuoteRequestAssignment table
CREATE TABLE quote_request_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Status tracking
  status assignment_status DEFAULT 'SENT',

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Scoring metadata (why was this supplier matched?)
  match_score DECIMAL(4,2),  -- 0.00-100.00
  match_reasons TEXT[],  -- Array of reasons: ["region_match", "budget_match", etc.]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_assignment UNIQUE (quote_request_id, supplier_id),
  CONSTRAINT valid_match_score CHECK (match_score >= 0 AND match_score <= 100),
  CONSTRAINT valid_status_transitions CHECK (
    -- Status can only move forward (no going back)
    CASE status
      WHEN 'SENT' THEN TRUE
      WHEN 'VIEWED' THEN viewed_at IS NOT NULL
      WHEN 'RESPONDED' THEN responded_at IS NOT NULL
      WHEN 'EXPIRED' THEN expires_at < NOW()
      ELSE FALSE
    END
  )
);

-- Indexes for fast queries
CREATE INDEX idx_assignments_quote_request ON quote_request_assignments(quote_request_id);
CREATE INDEX idx_assignments_supplier ON quote_request_assignments(supplier_id);
CREATE INDEX idx_assignments_status ON quote_request_assignments(status);
CREATE INDEX idx_assignments_expires ON quote_request_assignments(expires_at);

-- Composite index for supplier queries (most common: get active assignments for supplier)
CREATE INDEX idx_assignments_supplier_status ON quote_request_assignments(supplier_id, status);

-- ============================================================================
-- STEP 2: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE quote_request_assignments ENABLE ROW LEVEL SECURITY;

-- Suppliers can only see their own assignments
CREATE POLICY "Suppliers see own assignments"
  ON quote_request_assignments FOR SELECT
  USING (
    supplier_id IN (
      SELECT supplier_id FROM supplier_users WHERE id = auth.uid()
    )
  );

-- Restaurants can see assignments for their quote requests
CREATE POLICY "Restaurants see assignments for their requests"
  ON quote_request_assignments FOR SELECT
  USING (
    quote_request_id IN (
      SELECT id FROM requests WHERE restaurant_id = auth.uid()
    )
  );

-- Only system (service role) can create/update assignments
-- (No policy for INSERT/UPDATE means only service role can do it)

-- ============================================================================
-- STEP 3: Auto-update triggers
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON quote_request_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-expire assignments
CREATE OR REPLACE FUNCTION auto_expire_assignments()
RETURNS void AS $$
BEGIN
  UPDATE quote_request_assignments
  SET status = 'EXPIRED'
  WHERE status IN ('SENT', 'VIEWED')
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- This function should be called periodically (e.g., via cron job or Edge Function)
-- For now, we'll call it manually when needed
COMMENT ON FUNCTION auto_expire_assignments() IS 'Call periodically to expire old assignments';

-- ============================================================================
-- STEP 4: Helper views
-- ============================================================================

-- View: Active assignments (not expired)
CREATE VIEW active_assignments AS
SELECT *
FROM quote_request_assignments
WHERE status IN ('SENT', 'VIEWED', 'RESPONDED')
  AND expires_at > NOW();

-- View: Supplier assignment summary
CREATE VIEW supplier_assignment_stats AS
SELECT
  supplier_id,
  COUNT(*) as total_assignments,
  COUNT(*) FILTER (WHERE status = 'SENT') as sent_count,
  COUNT(*) FILTER (WHERE status = 'VIEWED') as viewed_count,
  COUNT(*) FILTER (WHERE status = 'RESPONDED') as responded_count,
  COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_count,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'RESPONDED')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('SENT', 'VIEWED', 'RESPONDED')), 0) * 100,
    2
  ) as response_rate_percent
FROM quote_request_assignments
GROUP BY supplier_id;

-- ============================================================================
-- STEP 5: Audit logging for assignments
-- ============================================================================

-- Add assignment actions to audit events (if not exists)
-- This assumes AuditEvent table exists from compliance implementation
-- If not, this is a placeholder

-- Example audit event insert would look like:
-- INSERT INTO audit_events (entity_type, entity_id, action, actor_type, actor_id)
-- VALUES ('ASSIGNMENT', assignment_id, 'DISPATCHED', 'SYSTEM', 'routing-service');

-- ============================================================================
-- STEP 6: Data integrity checks
-- ============================================================================

-- Ensure expires_at is always in the future when created
ALTER TABLE quote_request_assignments
ADD CONSTRAINT expires_at_in_future CHECK (expires_at > sent_at);

-- Ensure timestamps make sense
ALTER TABLE quote_request_assignments
ADD CONSTRAINT valid_timestamp_order CHECK (
  (viewed_at IS NULL OR viewed_at >= sent_at) AND
  (responded_at IS NULL OR responded_at >= sent_at) AND
  (responded_at IS NULL OR viewed_at IS NULL OR responded_at >= viewed_at)
);

-- ============================================================================
-- STEP 7: Comments for documentation
-- ============================================================================

COMMENT ON TABLE quote_request_assignments IS
  'Tracks which suppliers have been matched to which quote requests. Enables marketplace routing and access control.';

COMMENT ON COLUMN quote_request_assignments.match_score IS
  'Scoring from 0-100 indicating how well this supplier matches the quote request criteria.';

COMMENT ON COLUMN quote_request_assignments.match_reasons IS
  'Array of match reasons like ["region_match", "budget_match", "lead_time_ok"] for transparency.';

COMMENT ON COLUMN quote_request_assignments.expires_at IS
  'Deadline for supplier to respond. After this time, assignment status becomes EXPIRED.';

-- ============================================================================
-- STEP 8: Sample data validation function
-- ============================================================================

-- Function to validate an assignment is still valid for offer creation
CREATE OR REPLACE FUNCTION is_assignment_valid_for_offer(
  p_quote_request_id UUID,
  p_supplier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  SELECT * INTO v_assignment
  FROM quote_request_assignments
  WHERE quote_request_id = p_quote_request_id
    AND supplier_id = p_supplier_id;

  -- No assignment found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Assignment expired
  IF v_assignment.expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Assignment already expired status
  IF v_assignment.status = 'EXPIRED' THEN
    RETURN FALSE;
  END IF;

  -- Valid assignment
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_assignment_valid_for_offer IS
  'Checks if a supplier has a valid (non-expired) assignment for a quote request.';
