/**
 * OFFER EVENTS TABLE - AUDIT TRAIL
 *
 * Tracks all state changes and actions on offers
 * Provides full auditability for pilot loop
 *
 * Event types:
 * - CREATED: Offer created
 * - UPDATED: Offer metadata updated
 * - LINE_ADDED: Line item added
 * - LINE_UPDATED: Line item modified
 * - LINE_DELETED: Line item removed
 * - SENT: Offer sent to restaurant
 * - ACCEPTED: Offer accepted by restaurant
 * - REJECTED: Offer rejected by restaurant
 */

CREATE TABLE IF NOT EXISTS offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CREATED',
    'UPDATED',
    'LINE_ADDED',
    'LINE_UPDATED',
    'LINE_DELETED',
    'SENT',
    'ACCEPTED',
    'REJECTED'
  )),

  -- Actor (user who performed action)
  actor_user_id UUID NULL,  -- From auth.users

  -- Optional payload (diff, metadata, notes)
  payload JSONB NULL,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_offer_events_tenant_offer_created ON offer_events(tenant_id, offer_id, created_at DESC);
CREATE INDEX idx_offer_events_offer_created ON offer_events(offer_id, created_at DESC);
CREATE INDEX idx_offer_events_tenant_event_type ON offer_events(tenant_id, event_type);
CREATE INDEX idx_offer_events_actor ON offer_events(actor_user_id);

COMMENT ON TABLE offer_events IS 'Audit trail for all offer state changes and actions';
COMMENT ON COLUMN offer_events.event_type IS 'Type of event: CREATED, UPDATED, LINE_ADDED, LINE_UPDATED, LINE_DELETED, SENT, ACCEPTED, REJECTED';
COMMENT ON COLUMN offer_events.actor_user_id IS 'User who performed the action (from auth.users)';
COMMENT ON COLUMN offer_events.payload IS 'Optional event details (diff, metadata, notes)';
