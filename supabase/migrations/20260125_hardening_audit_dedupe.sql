/**
 * HARDENING C: Audit Log De-duplication
 *
 * Migration: 20260125_hardening_audit_dedupe
 *
 * Prevents duplicate audit log entries from rapid clicks or retries.
 * Uses unique partial indexes with time bucketing.
 */

-- =============================================================================
-- STEP 1: Add idempotency key column to event tables
-- =============================================================================

-- request_events
ALTER TABLE request_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- offer_events
ALTER TABLE offer_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- order_events
ALTER TABLE order_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- import_status_events
ALTER TABLE import_status_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- =============================================================================
-- STEP 2: Create unique partial indexes for deduplication
-- These prevent duplicate events within the same minute for the same entity/action
-- =============================================================================

-- request_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_events_dedupe
  ON request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- offer_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_events_dedupe
  ON offer_events (
    offer_id,
    event_type,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- order_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_events_dedupe
  ON order_events (
    order_id,
    event_type,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- import_status_events: prevent duplicate status changes within same minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_events_dedupe
  ON import_status_events (
    import_id,
    from_status,
    to_status,
    date_trunc('minute', created_at)
  )
  WHERE idempotency_key IS NULL;

-- =============================================================================
-- STEP 3: Create helper function for safe event insertion
-- =============================================================================

CREATE OR REPLACE FUNCTION insert_event_safe(
  p_table_name TEXT,
  p_event_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Dynamic insert with ON CONFLICT DO NOTHING behavior via exception handling
  BEGIN
    EXECUTE format(
      'INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) RETURNING to_jsonb(%I.*)',
      p_table_name, p_table_name, p_table_name
    ) INTO v_result USING p_event_data;

    RETURN jsonb_build_object(
      'success', true,
      'inserted', true,
      'data', v_result
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', true,
        'inserted', false,
        'reason', 'duplicate_prevented'
      );
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: Comments
-- =============================================================================

COMMENT ON COLUMN request_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events (e.g., user retry with new key)';
COMMENT ON COLUMN offer_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events';
COMMENT ON COLUMN order_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events';
COMMENT ON COLUMN import_status_events.idempotency_key IS 'Optional client-provided key to allow intentional duplicate events';

COMMENT ON FUNCTION insert_event_safe(TEXT, JSONB) IS 'Safely insert event with automatic deduplication (returns success even if duplicate prevented)';

-- Done!
