-- ═══════════════════════════════════════════════════════════════
-- WINE KNOWLEDGE RAG — pgvector table for sommelier enrichment
--
-- Stores taste profiles, aromas, food pairings scraped from
-- Systembolaget (and potentially other sources).
-- NO price data — Winefeed is B2B, prices come from suppliers.
--
-- Used by: matching-agent pipeline (step 4c: RAG enrichment)
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Wine knowledge table
CREATE TABLE IF NOT EXISTS wine_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Wine identity (for matching against supplier_wines)
  wine_name TEXT NOT NULL,
  producer TEXT,
  grape TEXT,
  country TEXT,
  region TEXT,
  subregion TEXT,
  color TEXT,               -- red, white, rose, sparkling, orange
  vintage INTEGER,

  -- Taste profile (Systembolaget's 1-12 scale)
  taste_clock_body INTEGER CHECK (taste_clock_body BETWEEN 1 AND 12),
  taste_clock_acidity INTEGER CHECK (taste_clock_acidity BETWEEN 1 AND 12),
  taste_clock_tannin INTEGER CHECK (taste_clock_tannin BETWEEN 1 AND 12),
  taste_clock_sweetness INTEGER CHECK (taste_clock_sweetness BETWEEN 1 AND 12),

  -- Descriptive text
  aroma_description TEXT,       -- "Nyanserad, kryddig doft med inslag av..."
  taste_description TEXT,       -- "Nyanserad, kryddig smak med..."
  appearance TEXT,              -- "Mörk, blåröd färg"
  food_pairings TEXT,           -- "Lamm, nötkött, vilt"

  -- Attributes (NOT price)
  alcohol_pct DECIMAL(4,1),
  organic BOOLEAN DEFAULT FALSE,
  biodynamic BOOLEAN DEFAULT FALSE,
  vegan BOOLEAN DEFAULT FALSE,
  serving_temp TEXT,            -- "8-10°C" or "cirka 18°C"
  aging_potential TEXT,         -- "Kan lagras" or null

  -- Source tracking
  source TEXT DEFAULT 'systembolaget',  -- 'systembolaget', 'wine-searcher', etc.
  source_url TEXT,
  source_id TEXT,                       -- External article number

  -- Embedding for vector search
  embedding vector(1536),               -- OpenAI text-embedding-3-small

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicates from same source
  UNIQUE (source, source_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wine_knowledge_embedding
  ON wine_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_wine_knowledge_grape ON wine_knowledge(grape);
CREATE INDEX IF NOT EXISTS idx_wine_knowledge_country ON wine_knowledge(country);
CREATE INDEX IF NOT EXISTS idx_wine_knowledge_region ON wine_knowledge(region);
CREATE INDEX IF NOT EXISTS idx_wine_knowledge_color ON wine_knowledge(color);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_wine_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  wine_name TEXT,
  producer TEXT,
  grape TEXT,
  country TEXT,
  region TEXT,
  subregion TEXT,
  color TEXT,
  taste_clock_body INTEGER,
  taste_clock_acidity INTEGER,
  taste_clock_tannin INTEGER,
  taste_clock_sweetness INTEGER,
  aroma_description TEXT,
  taste_description TEXT,
  food_pairings TEXT,
  organic BOOLEAN,
  serving_temp TEXT,
  aging_potential TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wk.id,
    wk.wine_name,
    wk.producer,
    wk.grape,
    wk.country,
    wk.region,
    wk.subregion,
    wk.color,
    wk.taste_clock_body,
    wk.taste_clock_acidity,
    wk.taste_clock_tannin,
    wk.taste_clock_sweetness,
    wk.aroma_description,
    wk.taste_description,
    wk.food_pairings,
    wk.organic,
    wk.serving_temp,
    wk.aging_potential,
    1 - (wk.embedding <=> query_embedding) AS similarity
  FROM wine_knowledge wk
  WHERE 1 - (wk.embedding <=> query_embedding) > match_threshold
  ORDER BY wk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- PostgREST schema reload
NOTIFY pgrst, 'reload schema';
