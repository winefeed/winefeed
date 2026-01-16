-- Add importer type for SE vs EU_PARTNER flow differentiation

CREATE TYPE importer_type AS ENUM (
  'SE',
  'EU_PARTNER'
);

ALTER TABLE importers
ADD COLUMN type importer_type NOT NULL DEFAULT 'SE';

COMMENT ON COLUMN importers.type IS 'Importer classification: SE (Swedish entity) or EU_PARTNER (EU partner under suspension arrangement)';

-- Create index for filtering by type
CREATE INDEX idx_importers_type ON importers(type);
