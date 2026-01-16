-- Create import_status_events table
-- Audit trail for import case status changes

CREATE TABLE import_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,

  -- Status transition
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  note TEXT,

  -- Audit
  changed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_events_tenant ON import_status_events(tenant_id);
CREATE INDEX idx_import_events_import ON import_status_events(import_id);
CREATE INDEX idx_import_events_created ON import_status_events(created_at DESC);

COMMENT ON TABLE import_status_events IS 'Audit trail for import case status changes';
