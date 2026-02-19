-- Market intelligence table for storing competitor/industry analysis
-- Data sourced from public financial reports (e.g., Viva Wine Group annual reports)
-- Used by matching agent to inject trend context into recommendations

CREATE TABLE IF NOT EXISTS supplier_market_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  report_year integer NOT NULL,

  -- Structured trend data (array of trend objects)
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Subsidiary/brand data for competitive flagging
  subsidiaries jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Raw source metadata
  source_document text,
  extracted_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(company_name, report_year)
);

COMMENT ON TABLE supplier_market_intelligence IS 'Market intelligence from public reports — trends and competitive data for matching agent';
COMMENT ON COLUMN supplier_market_intelligence.trends IS 'JSONB array: [{key, signal, detail, implication}]';
COMMENT ON COLUMN supplier_market_intelligence.subsidiaries IS 'JSONB array: [{name, country, description}]';
