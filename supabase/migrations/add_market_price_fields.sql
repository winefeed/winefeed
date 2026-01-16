-- Lägg till kolumner för marknadsprisdata från Wine-Searcher
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS market_price_sek DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS market_price_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS market_merchant_count INTEGER DEFAULT 0;

-- Lägg till index för snabbare frågor
CREATE INDEX IF NOT EXISTS idx_wines_market_price_updated
ON wines(market_price_updated_at DESC NULLS LAST);

-- Kommentar
COMMENT ON COLUMN wines.market_price_sek IS 'Lägsta marknadspris från Wine-Searcher (SEK)';
COMMENT ON COLUMN wines.market_price_updated_at IS 'När marknadsdata senast uppdaterades';
COMMENT ON COLUMN wines.market_merchant_count IS 'Antal återförsäljare som säljer vinet';
