-- Add style profile columns to supplier_wines
-- Used by matching agent for body/tannin/acidity-aware scoring

ALTER TABLE supplier_wines
  ADD COLUMN IF NOT EXISTS body text CHECK (body IN ('light', 'medium', 'full')),
  ADD COLUMN IF NOT EXISTS tannin text CHECK (tannin IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS acidity text CHECK (acidity IN ('low', 'medium', 'high'));

COMMENT ON COLUMN supplier_wines.body IS 'Wine body: light, medium, full. Nullable = auto-inferred at query time.';
COMMENT ON COLUMN supplier_wines.tannin IS 'Tannin level: low, medium, high. Nullable = auto-inferred at query time.';
COMMENT ON COLUMN supplier_wines.acidity IS 'Acidity level: low, medium, high. Nullable = auto-inferred at query time.';
