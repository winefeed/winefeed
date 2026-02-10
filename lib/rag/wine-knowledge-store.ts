/**
 * WINE KNOWLEDGE STORE
 *
 * Storage + retrieval for the wine knowledge RAG.
 *
 * Storage: Supabase pgvector (wine_knowledge table)
 * Retrieval: Three strategies (combined):
 *   1. Vector similarity search (semantic)
 *   2. Grape + region match (deterministic)
 *   3. Name fuzzy match (deterministic)
 *
 * Returns enriched taste context for AI prompt injection.
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding, generateEmbeddings, buildWineEmbeddingText } from './embeddings';
import type { ScrapedWine } from './systembolaget-scraper';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ═══════════════════════════════════════════
// STORAGE — Ingest scraped wines
// ═══════════════════════════════════════════

export interface IngestResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: number;
}

/**
 * Ingest an array of scraped wines into the knowledge store.
 * Generates embeddings and stores in Supabase.
 * Skips duplicates (same source + source_id).
 */
export async function ingestWines(wines: ScrapedWine[]): Promise<IngestResult> {
  const supabase = getSupabase();
  const result: IngestResult = { total: wines.length, inserted: 0, skipped: 0, errors: 0 };

  // Process in batches of 20 (embedding batch size)
  const BATCH_SIZE = 20;

  for (let i = 0; i < wines.length; i += BATCH_SIZE) {
    const batch = wines.slice(i, i + BATCH_SIZE);
    console.log(`[KnowledgeStore] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(wines.length / BATCH_SIZE)}`);

    // Build embedding texts
    const texts = batch.map(wine => buildWineEmbeddingText({
      wine_name: wine.wine_name,
      producer: wine.producer || undefined,
      grape: wine.grape || undefined,
      country: wine.country || undefined,
      region: wine.region || undefined,
      subregion: wine.subregion || undefined,
      color: wine.color || undefined,
      aroma_description: wine.aroma_description || undefined,
      taste_description: wine.taste_description || undefined,
      food_pairings: wine.food_pairings || undefined,
      taste_clock_body: wine.taste_clock_body || undefined,
      taste_clock_acidity: wine.taste_clock_acidity || undefined,
      taste_clock_tannin: wine.taste_clock_tannin || undefined,
      taste_clock_sweetness: wine.taste_clock_sweetness || undefined,
    }));

    // Generate embeddings
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(texts);
    } catch (error: any) {
      console.error(`[KnowledgeStore] Embedding generation failed: ${error.message}`);
      result.errors += batch.length;
      continue;
    }

    // Upsert into Supabase
    for (let j = 0; j < batch.length; j++) {
      const wine = batch[j];
      const embedding = embeddings[j];

      try {
        const { error } = await supabase
          .from('wine_knowledge')
          .upsert({
            wine_name: wine.wine_name,
            producer: wine.producer,
            grape: wine.grape,
            country: wine.country,
            region: wine.region,
            subregion: wine.subregion,
            color: wine.color,
            vintage: wine.vintage,
            taste_clock_body: wine.taste_clock_body,
            taste_clock_acidity: wine.taste_clock_acidity,
            taste_clock_tannin: wine.taste_clock_tannin,
            taste_clock_sweetness: wine.taste_clock_sweetness,
            aroma_description: wine.aroma_description,
            taste_description: wine.taste_description,
            appearance: wine.appearance,
            food_pairings: wine.food_pairings,
            alcohol_pct: wine.alcohol_pct,
            organic: wine.organic,
            biodynamic: wine.biodynamic,
            vegan: wine.vegan,
            serving_temp: wine.serving_temp,
            aging_potential: wine.aging_potential,
            source: 'systembolaget',
            source_url: wine.source_url,
            source_id: wine.source_id,
            embedding: JSON.stringify(embedding),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'source,source_id',
          });

        if (error) {
          if (error.code === '23505') {
            result.skipped++;
          } else {
            console.warn(`[KnowledgeStore] Insert error: ${error.message}`);
            result.errors++;
          }
        } else {
          result.inserted++;
        }
      } catch (err: any) {
        console.warn(`[KnowledgeStore] Error storing ${wine.wine_name}: ${err.message}`);
        result.errors++;
      }
    }
  }

  console.log(`[KnowledgeStore] Ingestion complete:`, result);
  return result;
}

// ═══════════════════════════════════════════
// RETRIEVAL — Find relevant wine knowledge
// ═══════════════════════════════════════════

export interface WineKnowledgeMatch {
  wine_name: string;
  producer: string | null;
  grape: string | null;
  country: string | null;
  region: string | null;
  color: string | null;
  taste_clock_body: number | null;
  taste_clock_acidity: number | null;
  taste_clock_tannin: number | null;
  taste_clock_sweetness: number | null;
  aroma_description: string | null;
  taste_description: string | null;
  food_pairings: string | null;
  organic: boolean;
  serving_temp: string | null;
  aging_potential: string | null;
  similarity: number;
  match_type: 'vector' | 'grape_region' | 'name';
}

/**
 * Find relevant wine knowledge for a supplier wine.
 * Combines three retrieval strategies for best results.
 */
export async function findWineKnowledge(params: {
  wineName?: string;
  grape?: string;
  country?: string;
  region?: string;
  color?: string;
  limit?: number;
}): Promise<WineKnowledgeMatch[]> {
  const supabase = getSupabase();
  const limit = params.limit || 3;
  const allMatches: WineKnowledgeMatch[] = [];

  // Strategy 1: Vector similarity search (best for semantic matching)
  try {
    const queryText = [
      params.wineName,
      params.grape ? `Druva: ${params.grape}` : null,
      params.country,
      params.region,
      params.color === 'red' ? 'Rött vin' : params.color === 'white' ? 'Vitt vin' : params.color,
    ].filter(Boolean).join('. ');

    if (queryText.length > 5) {
      const embedding = await generateEmbedding(queryText);

      const { data: vectorResults } = await supabase
        .rpc('match_wine_knowledge', {
          query_embedding: JSON.stringify(embedding),
          match_threshold: 0.5,
          match_count: limit,
        });

      if (vectorResults) {
        for (const row of vectorResults) {
          allMatches.push({
            ...row,
            match_type: 'vector' as const,
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(`[KnowledgeStore] Vector search failed: ${err.message}`);
  }

  // Strategy 2: Grape + region deterministic match
  if (params.grape || params.region) {
    try {
      let query = supabase
        .from('wine_knowledge')
        .select('wine_name, producer, grape, country, region, color, taste_clock_body, taste_clock_acidity, taste_clock_tannin, taste_clock_sweetness, aroma_description, taste_description, food_pairings, organic, serving_temp, aging_potential')
        .limit(limit);

      if (params.grape) {
        query = query.ilike('grape', `%${params.grape}%`);
      }
      if (params.region) {
        query = query.ilike('region', `%${params.region}%`);
      }
      if (params.color) {
        query = query.eq('color', params.color);
      }

      const { data: grapeResults } = await query;

      if (grapeResults) {
        for (const row of grapeResults) {
          // Skip if already found by vector search
          if (!allMatches.some(m => m.wine_name === row.wine_name)) {
            allMatches.push({
              ...row,
              similarity: 0.7,
              match_type: 'grape_region' as const,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[KnowledgeStore] Grape/region search failed: ${err.message}`);
    }
  }

  // Sort by similarity, deduplicate, limit
  allMatches.sort((a, b) => b.similarity - a.similarity);
  return allMatches.slice(0, limit);
}

/**
 * Build an AI prompt context string from wine knowledge matches.
 * This gets injected into the sommelier AI prompt.
 */
export function buildRAGContext(matches: WineKnowledgeMatch[]): string {
  if (matches.length === 0) return '';

  const parts: string[] = ['VINKUNSKAP FRÅN DATABAS (smakprofiler för liknande viner):'];

  for (const match of matches) {
    const lines: string[] = [];
    lines.push(`• ${match.wine_name}${match.producer ? ` (${match.producer})` : ''}`);

    if (match.grape) lines.push(`  Druva: ${match.grape}`);
    if (match.region) lines.push(`  Region: ${match.region}`);

    // Taste clock
    const clockParts: string[] = [];
    if (match.taste_clock_body) clockParts.push(`kropp ${match.taste_clock_body}/12`);
    if (match.taste_clock_acidity) clockParts.push(`syra ${match.taste_clock_acidity}/12`);
    if (match.taste_clock_tannin) clockParts.push(`tannin ${match.taste_clock_tannin}/12`);
    if (match.taste_clock_sweetness) clockParts.push(`sötma ${match.taste_clock_sweetness}/12`);
    if (clockParts.length > 0) lines.push(`  Smakur: ${clockParts.join(', ')}`);

    if (match.aroma_description) lines.push(`  Doft: ${match.aroma_description}`);
    if (match.taste_description) lines.push(`  Smak: ${match.taste_description}`);
    if (match.food_pairings) lines.push(`  Passar till: ${match.food_pairings}`);
    if (match.serving_temp) lines.push(`  Servering: ${match.serving_temp}`);

    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n');
}

/**
 * Full retrieval: find knowledge for multiple supplier wines and build context.
 * Used by the matching pipeline.
 */
export async function enrichWithKnowledge(supplierWines: {
  name: string;
  grape?: string;
  country?: string;
  region?: string;
  color?: string;
}[]): Promise<string> {
  const allMatches: WineKnowledgeMatch[] = [];
  const seen = new Set<string>();

  // Limit to top 5 wines to control API costs
  for (const wine of supplierWines.slice(0, 5)) {
    const matches = await findWineKnowledge({
      wineName: wine.name,
      grape: wine.grape,
      country: wine.country,
      region: wine.region,
      color: wine.color,
      limit: 2,
    });

    for (const match of matches) {
      if (!seen.has(match.wine_name)) {
        seen.add(match.wine_name);
        allMatches.push(match);
      }
    }
  }

  // Keep top 5 most relevant
  allMatches.sort((a, b) => b.similarity - a.similarity);
  return buildRAGContext(allMatches.slice(0, 5));
}

// ═══════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════

export async function getKnowledgeStats(): Promise<{
  total: number;
  withTasteData: number;
  byColor: Record<string, number>;
  byCountry: Record<string, number>;
}> {
  const supabase = getSupabase();

  const { count: total } = await supabase
    .from('wine_knowledge')
    .select('*', { count: 'exact', head: true });

  const { count: withTaste } = await supabase
    .from('wine_knowledge')
    .select('*', { count: 'exact', head: true })
    .not('taste_description', 'is', null);

  return {
    total: total || 0,
    withTasteData: withTaste || 0,
    byColor: {},
    byCountry: {},
  };
}
