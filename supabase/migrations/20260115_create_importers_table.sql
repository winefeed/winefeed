-- Create importers table
-- This table stores legal entities authorized to import alcohol

CREATE TABLE IF NOT EXISTS importers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Legal entity
  legal_name TEXT NOT NULL,
  org_number TEXT NOT NULL,

  -- Contact
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,

  -- License
  license_number TEXT,
  license_verified BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_org_number CHECK (org_number ~ '^\d{6}-\d{4}$')
);

CREATE INDEX idx_importers_tenant ON importers(tenant_id);
CREATE INDEX idx_importers_org_number ON importers(org_number);

COMMENT ON TABLE importers IS 'Legal entities authorized to import alcohol';
