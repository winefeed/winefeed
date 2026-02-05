-- =============================================================================
-- IOR FEEDBACK ITEMS
-- Structured feedback collection from importers testing the IOR module
-- =============================================================================

CREATE TABLE IF NOT EXISTS ior_feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  importer_id uuid NOT NULL,

  -- Optional context links
  producer_id uuid REFERENCES ior_producers(id) ON DELETE SET NULL,
  product_id uuid REFERENCES ior_products(id) ON DELETE SET NULL,
  case_id uuid REFERENCES ior_communication_cases(id) ON DELETE SET NULL,

  -- Feedback metadata
  page_path text NOT NULL,
  category text NOT NULL CHECK (category IN ('UX', 'Bug', 'Data', 'Workflow', 'Missing feature', 'Other')),
  severity text NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),

  -- Feedback content
  title text NOT NULL,
  details text NOT NULL,
  expected text,

  -- Status tracking
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'DONE', 'WONTFIX')),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ior_feedback_tenant_importer ON ior_feedback_items(tenant_id, importer_id);
CREATE INDEX idx_ior_feedback_created_at ON ior_feedback_items(created_at DESC);
CREATE INDEX idx_ior_feedback_status ON ior_feedback_items(status);
CREATE INDEX idx_ior_feedback_category ON ior_feedback_items(category);

-- Enable RLS
ALTER TABLE ior_feedback_items ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access" ON ior_feedback_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- IOR users can manage their own feedback
CREATE POLICY "IOR access own feedback" ON ior_feedback_items
  FOR ALL
  USING (importer_id = auth_entity_id('IOR'))
  WITH CHECK (importer_id = auth_entity_id('IOR'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ior_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ior_feedback_updated_at
  BEFORE UPDATE ON ior_feedback_items
  FOR EACH ROW
  EXECUTE FUNCTION update_ior_feedback_updated_at();

-- =============================================================================
-- SAMPLE DATA (optional, for testing)
-- =============================================================================

-- Sample feedback items will be inserted via the app during testing
