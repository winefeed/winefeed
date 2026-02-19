/**
 * Matching Agent — Pipeline Orchestrator
 *
 * Runs the full matching pipeline:
 * 1. Parse fritext (AI, try/catch → fallback to empty)
 * 2. Lookup food/occasion/style (sync, cannot fail)
 * 3. Build smart query (sync)
 * 4. Run query (async, fallback cascade)
 * 4b. Build knowledge context (sync, <1ms)
 * 5. Pre-score (sync, <5ms)
 * 5b. RAG enrichment — taste profiles from wine_knowledge (async)
 * 6. AI re-rank top 15 (try/catch → fallback to pre-score order)
 * 7. Fetch supplier info
 *
 * Logs timing per step.
 */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  MatchingAgentInput,
  MatchingAgentOptions,
  MatchingAgentResult,
  DEFAULT_OPTIONS,
  EMPTY_PARSED,
  ParsedFritext,
  ScoredWine,
  SupplierInfo,
} from './types';
import { parseFritext } from './fritext-parser';
import { mergePreferences, setRuntimeOverrides } from './food-pairing';
import { loadPairingOverrides } from '../food-scan/pairing-loader';
import { runSmartQuery } from './smart-query';
import { preScoreWines } from './pre-scorer';
import { rankWinesEnhanced } from '../ai/rank-wines';
import { buildKnowledgeContext } from './knowledge';
import { enrichWithKnowledge } from '../rag/wine-knowledge-store';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Run the full matching agent pipeline.
 * Gracefully degrades at each step — always returns results if wines exist.
 */
export async function runMatchingAgentPipeline(
  input: MatchingAgentInput,
  partialOptions?: Partial<MatchingAgentOptions>,
): Promise<MatchingAgentResult> {
  const options = { ...DEFAULT_OPTIONS, ...partialOptions };
  const timing: Record<string, number> = {};
  const t0 = Date.now();

  // -------------------------------------------------------------------------
  // Step 1: Parse fritext (AI)
  // -------------------------------------------------------------------------
  let parsed: ParsedFritext = { ...EMPTY_PARSED };

  if (options.enableParsing && input.fritext) {
    const tParse = Date.now();
    try {
      parsed = await parseFritext(input.fritext, input.structuredFilters);
      console.log('[MatchingAgent] Parsed fritext:', JSON.stringify(parsed));
    } catch (err: any) {
      console.warn('[MatchingAgent] Parse failed, continuing with empty parsed:', err?.message);
    }
    timing.parse = Date.now() - tParse;
  }

  // -------------------------------------------------------------------------
  // Step 1b: Load DB pairing overrides (async, cached 5 min)
  // -------------------------------------------------------------------------
  try {
    const overrides = await loadPairingOverrides();
    setRuntimeOverrides(overrides);
  } catch (err: any) {
    console.warn('[MatchingAgent] Failed to load pairing overrides (non-critical):', err?.message);
  }

  // -------------------------------------------------------------------------
  // Step 2: Lookup food/occasion/style + merge preferences (sync)
  // -------------------------------------------------------------------------
  const tLookup = Date.now();
  const preferences = mergePreferences(
    parsed,
    input.structuredFilters.color,
    input.structuredFilters.country,
    input.structuredFilters.grape,
  );
  timing.lookup = Date.now() - tLookup;
  console.log('[MatchingAgent] Merged preferences:', JSON.stringify({
    colors: preferences.colors,
    countries: preferences.countries,
    regions: preferences.regions.slice(0, 3),
    grapes: preferences.grapes.slice(0, 3),
    food: preferences.food_pairing,
    occasion: preferences.occasion,
  }));

  // -------------------------------------------------------------------------
  // Step 3+4: Smart query (async, with fallback cascade)
  // -------------------------------------------------------------------------
  const tQuery = Date.now();
  const wines = await runSmartQuery(input.structuredFilters, preferences, options);
  timing.query = Date.now() - tQuery;
  const totalDbMatches = wines.length;
  console.log(`[MatchingAgent] Query returned ${wines.length} wines in ${timing.query}ms`);

  if (wines.length === 0) {
    return {
      wines: [],
      suppliersMap: {},
      parsed,
      preferences,
      timing: { ...timing, total: Date.now() - t0 },
      totalDbMatches: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Step 4b: Build knowledge context (sync, <1ms)
  // -------------------------------------------------------------------------
  const tKnowledge = Date.now();
  const knowledgeContext = buildKnowledgeContext({
    grapes: preferences.grapes,
    regions: preferences.regions,
    countries: preferences.countries,
    foodDescription: input.fritext || preferences.food_pairing.join(', ') || undefined,
    wineColor: input.structuredFilters.color || undefined,
  });
  timing.knowledge = Date.now() - tKnowledge;
  if (knowledgeContext.promptContext) {
    console.log('[MatchingAgent] Knowledge context built:', {
      grapeProfiles: knowledgeContext.grapeProfiles.length,
      regionInfo: knowledgeContext.regionInfo.length,
      hasFoodAnalysis: !!knowledgeContext.foodAnalysis,
      season: knowledgeContext.season.season,
    });
  }

  // -------------------------------------------------------------------------
  // Step 5: Pre-score (sync, <5ms)
  // -------------------------------------------------------------------------
  let scoredWines: ScoredWine[];

  if (options.enablePreScoring) {
    const tScore = Date.now();
    scoredWines = preScoreWines(wines, preferences, input.structuredFilters, options.preScoreTopN);
    timing.preScore = Date.now() - tScore;
    console.log(`[MatchingAgent] Pre-scored ${wines.length} → top ${scoredWines.length} in ${timing.preScore}ms`);
    console.log('[MatchingAgent] Top 3 scores:', scoredWines.slice(0, 3).map(sw => ({
      name: sw.wine.name,
      score: sw.score,
      breakdown: sw.breakdown,
    })));
  } else {
    // No pre-scoring: wrap wines as ScoredWine with neutral scores
    scoredWines = wines.slice(0, options.preScoreTopN).map(wine => ({
      wine,
      score: 50,
      breakdown: { price: 12, color: 10, region: 10, grape: 8, food: 5, availability: 5 },
    }));
  }

  // -------------------------------------------------------------------------
  // Step 5b: RAG enrichment — taste profiles from wine_knowledge (async)
  // Fail-safe: RAG failure doesn't block pipeline
  // -------------------------------------------------------------------------
  let ragContext = '';
  try {
    const tRag = Date.now();
    const topWinesForRag = scoredWines.slice(0, 5).map(sw => ({
      name: sw.wine.name,
      grape: sw.wine.grape || undefined,
      country: sw.wine.country || undefined,
      region: sw.wine.region || undefined,
      color: sw.wine.color || undefined,
    }));
    ragContext = await enrichWithKnowledge(topWinesForRag);
    timing.rag = Date.now() - tRag;
    if (ragContext) {
      console.log(`[MatchingAgent] RAG enrichment: ${ragContext.split('\n').length} lines in ${timing.rag}ms`);
    }
  } catch (err: any) {
    console.warn('[MatchingAgent] RAG enrichment failed (non-critical):', err?.message);
  }

  // -------------------------------------------------------------------------
  // Step 6: AI re-rank (async, fallback to pre-score order)
  // -------------------------------------------------------------------------
  if (options.enableAIRerank) {
    const tRerank = Date.now();

    // Build search context for AI
    const searchContext = buildSearchContext(input, parsed);

    // Combine knowledge base context + RAG context
    const combinedKnowledge = [knowledgeContext.promptContext, ragContext]
      .filter(Boolean)
      .join('\n\n');

    try {
      const aiResults = await rankWinesEnhanced(
        scoredWines,
        preferences,
        searchContext,
        options.finalTopN,
        combinedKnowledge || undefined,
        input.restaurantContext || undefined,
      );

      // Re-order scoredWines based on AI ranking
      if (aiResults.length > 0) {
        const reordered: ScoredWine[] = [];
        for (const aiResult of aiResults) {
          const sw = scoredWines.find(s => s.wine.id === aiResult.wine_id);
          if (sw) {
            reordered.push({
              ...sw,
              // Store AI score and reason on the wine for later use
              score: Math.round(aiResult.score * 100),
              wine: {
                ...sw.wine,
                // Attach AI reason as description override for the response
                description: aiResult.reason,
              },
            });
          }
        }
        // Add any wines AI missed (keep pre-score order)
        for (const sw of scoredWines) {
          if (!reordered.find(r => r.wine.id === sw.wine.id)) {
            reordered.push(sw);
          }
        }
        scoredWines = reordered.slice(0, options.finalTopN);
      }
    } catch (err: any) {
      console.warn('[MatchingAgent] AI re-rank failed, using pre-score order:', err?.message);
      scoredWines = scoredWines.slice(0, options.finalTopN);
    }

    timing.aiRerank = Date.now() - tRerank;
  } else {
    scoredWines = scoredWines.slice(0, options.finalTopN);
  }

  // -------------------------------------------------------------------------
  // Step 7: Fetch supplier info
  // -------------------------------------------------------------------------
  const tSuppliers = Date.now();
  const suppliersMap = await fetchSupplierInfo(scoredWines);
  timing.suppliers = Date.now() - tSuppliers;

  timing.total = Date.now() - t0;
  console.log(`[MatchingAgent] Pipeline complete in ${timing.total}ms`, timing);

  return {
    wines: scoredWines,
    suppliersMap,
    parsed,
    preferences,
    timing,
    totalDbMatches,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function buildSearchContext(input: MatchingAgentInput, parsed: ParsedFritext): string {
  const parts: string[] = [];

  const colorLabels: Record<string, string> = {
    red: 'rött vin', white: 'vitt vin', rose: 'rosévin',
    sparkling: 'mousserande vin', orange: 'orange vin', fortified: 'starkvin',
  };

  const color = input.structuredFilters.color;
  if (color && color !== 'all') {
    parts.push(`Söker ${colorLabels[color] || color}`);
  } else if (parsed.implied_color) {
    parts.push(`Söker ${colorLabels[parsed.implied_color] || parsed.implied_color}`);
  } else {
    parts.push('Söker vin (alla typer)');
  }

  const country = input.structuredFilters.country;
  if (country && country !== 'all') {
    parts.push(`från ${country}`);
  } else if (parsed.implied_country) {
    parts.push(`från ${parsed.implied_country}`);
  }

  if (parsed.implied_region) {
    parts.push(`region: ${parsed.implied_region}`);
  }

  const grape = input.structuredFilters.grape;
  if (grape && grape !== 'all') {
    parts.push(`druva: ${grape}`);
  }

  if (input.structuredFilters.budget_max) {
    parts.push(`budget max ${input.structuredFilters.budget_max} kr/flaska`);
  }

  if (input.fritext) {
    parts.push(`Önskemål: ${input.fritext}`);
  }

  return parts.join('. ');
}

async function fetchSupplierInfo(scoredWines: ScoredWine[]): Promise<Record<string, SupplierInfo>> {
  const supplierIds = [...new Set(scoredWines.map(sw => sw.wine.supplier_id).filter(Boolean))];
  const suppliersMap: Record<string, SupplierInfo> = {};

  if (supplierIds.length === 0) return suppliersMap;

  try {
    const { data: suppliers } = await getSupabaseAdmin()
      .from('suppliers')
      .select('id, namn, kontakt_email, min_order_bottles, provorder_enabled, provorder_fee_sek')
      .in('id', supplierIds);

    if (suppliers) {
      for (const s of suppliers) {
        suppliersMap[s.id] = {
          id: s.id,
          namn: s.namn,
          kontakt_email: s.kontakt_email,
          min_order_bottles: s.min_order_bottles,
          provorder_enabled: s.provorder_enabled || false,
          provorder_fee_sek: s.provorder_fee_sek || 500,
        };
      }
    }
  } catch (err: any) {
    console.warn('[MatchingAgent] Failed to fetch suppliers:', err?.message);
  }

  return suppliersMap;
}
