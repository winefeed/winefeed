-- REQUEST ITEMS TABLE
-- Migration: 20260128_request_items
-- Purpose: Store individual wine items in a quote request with provorder support

-- ============================================================================
-- Create request_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  wine_id UUID REFERENCES supplier_wines(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Wine snapshot (in case wine is deleted)
  wine_name TEXT NOT NULL,
  producer TEXT,
  country TEXT,
  region TEXT,
  vintage INTEGER,
  color TEXT,

  -- Order details
  quantity INTEGER NOT NULL,
  price_sek INTEGER, -- Price at time of request (öre)
  moq INTEGER DEFAULT 0,

  -- Provorder info
  provorder BOOLEAN DEFAULT FALSE,
  provorder_fee INTEGER, -- Fee in SEK if provorder

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_supplier_id ON request_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_request_items_wine_id ON request_items(wine_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE request_items IS 'Individual wine items in a quote request';
COMMENT ON COLUMN request_items.provorder IS 'Whether this item is ordered as provorder (below MOQ with fee)';
COMMENT ON COLUMN request_items.provorder_fee IS 'Flat fee in SEK for this provorder item';
