/**
 * SUPPLIER SPECIALIZATIONS — IOR broadcast coverage
 *
 * Suppliers (especially IOR operators) can declare country/region
 * specializations. The broadcast fan-out then matches on
 * specialization OR catalog match, so an IOR who covers "France"
 * receives French broadcasts even without French wines listed.
 *
 * Seed: Brasri AB gets "France" (all regions) per Corentin's request.
 */

CREATE TABLE IF NOT EXISTS supplier_specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('country', 'region', 'appellation')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_spec_type_value
  ON supplier_specializations(type, value);

CREATE INDEX IF NOT EXISTS idx_spec_supplier
  ON supplier_specializations(supplier_id);

COMMENT ON TABLE supplier_specializations IS 'Country/region/appellation specializations declared by suppliers — used by broadcast fan-out to include IOR operators beyond catalog match';

-- Seed: Brasri AB (Corentin) specializes in France, all regions
INSERT INTO supplier_specializations (supplier_id, type, value)
VALUES ('a1111111-1111-1111-1111-111111111111', 'country', 'France')
ON CONFLICT (supplier_id, type, value) DO NOTHING;
