-- Switch from OpenAI (1536 dim) to Hugging Face bge-small (384 dim)

-- Drop old index and function (they reference vector(1536))
DROP INDEX IF EXISTS idx_wine_knowledge_embedding;
DROP FUNCTION IF EXISTS match_wine_knowledge;

-- Change column type
ALTER TABLE wine_knowledge DROP COLUMN IF EXISTS embedding;
ALTER TABLE wine_knowledge ADD COLUMN embedding vector(384);

-- Recreate index
CREATE INDEX idx_wine_knowledge_embedding
  ON wine_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Recreate similarity search function
CREATE OR REPLACE FUNCTION match_wine_knowledge(
  query_embedding vector(384),
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

NOTIFY pgrst, 'reload schema';
