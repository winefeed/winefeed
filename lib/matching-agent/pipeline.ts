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
import { mergePreferences, setRuntimeOverrides, FOOD_TO_WINE_STYLES } from './food-pairing';
import { loadPairingOverrides } from '../food-scan/pairing-loader';
import { runSmartQuery, SmartQueryResult } from './smart-query';
import { preScoreWines } from './pre-scorer';
import { rankWinesEnhanced } from '../ai/rank-wines';
import { buildKnowledgeContext } from './knowledge';
import { enrichWithKnowledge } from '../rag/wine-knowledge-store';
import { buildMarketContext, getMarketLeaderSubsidiaries } from './market-context';
import { inferWineStyle } from './style-inference';
import { parseCuisineFromContext } from './cuisine-profiles';

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
  // Step 1b: Regex fallback — extract basic signals if AI parser failed
  // This ensures color/country keywords in fritext are never ignored.
  // -------------------------------------------------------------------------
  if (input.fritext && !parsed.implied_color && !input.structuredFilters.color) {
    const ft = input.fritext.toLowerCase();
    const colorKeywords: Record<string, string> = {
      'rött': 'red', 'röda': 'red', 'rödvin': 'red', 'rött vin': 'red',
      'vitt': 'white', 'vita': 'white', 'vitvin': 'white', 'vitt vin': 'white',
      'rosé': 'rose', 'rosévin': 'rose',
      'mousserande': 'sparkling', 'bubbel': 'sparkling', 'champagne': 'sparkling',
      'orange': 'orange', 'orangevin': 'orange',
    };
    for (const [keyword, color] of Object.entries(colorKeywords)) {
      if (ft.includes(keyword)) {
        parsed.implied_color = color;
        console.log(`[MatchingAgent] Regex fallback: extracted color="${color}" from fritext`);
        break;
      }
    }
  }

  if (input.fritext && !parsed.implied_country && !input.structuredFilters.country) {
    const ft = input.fritext.toLowerCase();
    const countryKeywords: Record<string, string> = {
      'frankrike': 'France', 'fransk': 'France', 'franskt': 'France', 'franska': 'France',
      'italia': 'Italy', 'italien': 'Italy', 'italiensk': 'Italy', 'italienskt': 'Italy', 'italienska': 'Italy',
      'spanien': 'Spain', 'spansk': 'Spain', 'spanskt': 'Spain', 'spanska': 'Spain',
      'argentina': 'Argentina', 'argentinsk': 'Argentina', 'argentinskt': 'Argentina',
      'chile': 'Chile', 'chilensk': 'Chile', 'chilenskt': 'Chile',
      'sydafrika': 'South Africa', 'sydafrikansk': 'South Africa', 'sydafrikanskt': 'South Africa',
      'australien': 'Australia', 'australisk': 'Australia', 'australiskt': 'Australia',
      'nya zeeland': 'New Zealand', 'nyzeeländsk': 'New Zealand',
      'portugal': 'Portugal', 'portugisisk': 'Portugal', 'portugisiskt': 'Portugal',
      'tyskland': 'Germany', 'tysk': 'Germany', 'tyskt': 'Germany', 'tyska': 'Germany',
      'österrike': 'Austria', 'österrikisk': 'Austria', 'österrikiskt': 'Austria',
      'grekland': 'Greece', 'grekisk': 'Greece', 'grekiskt': 'Greece', 'grekiska': 'Greece', 'greksikt': 'Greece',
      'libanon': 'Lebanon', 'libanesisk': 'Lebanon', 'libanesiskt': 'Lebanon',
      'usa': 'United States', 'amerikanskt': 'United States', 'amerikansk': 'United States',
      'ungern': 'Hungary', 'ungersk': 'Hungary', 'ungerskt': 'Hungary',
      'kroatien': 'Croatia', 'kroatisk': 'Croatia',
      'slovenien': 'Slovenia', 'slovensk': 'Slovenia',
      'georgien': 'Georgia', 'georgisk': 'Georgia', 'georgiskt': 'Georgia',
    };
    for (const [keyword, country] of Object.entries(countryKeywords)) {
      if (ft.includes(keyword)) {
        parsed.implied_country = country;
        console.log(`[MatchingAgent] Regex fallback: extracted country="${country}" from fritext`);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 1c: Regex fallback — extract food keywords from fritext
  // Scans against our food pairing tables so food scoring works without AI
  // -------------------------------------------------------------------------
  if (input.fritext && parsed.food_pairing.length === 0) {
    const ft = input.fritext.toLowerCase();
    // Import food keywords from our tables
    const foodKeys = Object.keys(FOOD_TO_WINE_STYLES);
    const matched: string[] = [];
    // Sort by length descending so "lammracks" matches before "lamm"
    for (const food of foodKeys.sort((a, b) => b.length - a.length)) {
      if (ft.includes(food) && !matched.some(m => m.includes(food) || food.includes(m))) {
        matched.push(food);
      }
    }
    if (matched.length > 0) {
      parsed.food_pairing = matched;
      console.log(`[MatchingAgent] Regex fallback: extracted food=${matched.join(', ')} from fritext`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 1d: Regex fallback — extract grape keywords + synonyms from fritext
  // -------------------------------------------------------------------------
  if (input.fritext && parsed.implied_grapes.length === 0 && !input.structuredFilters.grape) {
    const ft = input.fritext.toLowerCase();
    const grapeKeywords: Record<string, string> = {
      'shiraz': 'Syrah', 'syrah': 'Syrah',
      'cabernet sauvignon': 'Cabernet Sauvignon', 'cabernet': 'Cabernet Sauvignon', 'cab sauv': 'Cabernet Sauvignon',
      'cabernet franc': 'Cabernet Franc',
      'pinot noir': 'Pinot Noir', 'pinot': 'Pinot Noir',
      'merlot': 'Merlot',
      'malbec': 'Malbec',
      'nebbiolo': 'Nebbiolo', 'barolo': 'Nebbiolo', 'barbaresco': 'Nebbiolo',
      'sangiovese': 'Sangiovese', 'chianti': 'Sangiovese',
      'tempranillo': 'Tempranillo', 'rioja': 'Tempranillo',
      'grenache': 'Grenache', 'garnacha': 'Grenache',
      'gamay': 'Gamay', 'beaujolais': 'Gamay',
      'chardonnay': 'Chardonnay', 'chablis': 'Chardonnay',
      'sauvignon blanc': 'Sauvignon Blanc', 'sancerre': 'Sauvignon Blanc',
      'riesling': 'Riesling',
      'chenin blanc': 'Chenin Blanc',
      'pinot gris': 'Pinot Gris', 'pinot grigio': 'Pinot Gris',
      'gewürztraminer': 'Gewürztraminer', 'gewurztraminer': 'Gewürztraminer',
      'viognier': 'Viognier',
      'grüner veltliner': 'Grüner Veltliner',
      'albariño': 'Albariño', 'albarino': 'Albariño',
      'zinfandel': 'Zinfandel', 'primitivo': 'Zinfandel',
      'carignan': 'Carignan',
      'mourvèdre': 'Mourvèdre', 'mourvedre': 'Mourvèdre',
      'cinsault': 'Cinsault',
    };
    // Sort by key length descending so "cabernet sauvignon" matches before "cabernet"
    const sorted = Object.entries(grapeKeywords).sort((a, b) => b[0].length - a[0].length);
    for (const [keyword, grape] of sorted) {
      if (ft.includes(keyword) && !parsed.implied_grapes.includes(grape)) {
        parsed.implied_grapes.push(grape);
        console.log(`[MatchingAgent] Regex fallback: extracted grape="${grape}" from "${keyword}"`);
      }
    }
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

  // Extract cuisine types from restaurant context (e.g. "Kök: Italiensk, Nordisk")
  const cuisineTypes = parseCuisineFromContext(input.restaurantContext);
  if (cuisineTypes.length > 0) {
    preferences.cuisineTypes = cuisineTypes;
    console.log('[MatchingAgent] Cuisine types from restaurant profile:', cuisineTypes);
  }

  timing.lookup = Date.now() - tLookup;
  console.log('[MatchingAgent] Merged preferences:', JSON.stringify({
    colors: preferences.colors,
    countries: preferences.countries,
    regions: preferences.regions.slice(0, 3),
    grapes: preferences.grapes.slice(0, 3),
    food: preferences.food_pairing,
    occasion: preferences.occasion,
    cuisineTypes: preferences.cuisineTypes,
  }));

  // -------------------------------------------------------------------------
  // Step 3+4: Smart query (async, with fallback cascade)
  // -------------------------------------------------------------------------
  const tQuery = Date.now();
  const queryResult: SmartQueryResult = await runSmartQuery(input.structuredFilters, preferences, options);
  const wines = queryResult.wines;
  timing.query = Date.now() - tQuery;
  const totalDbMatches = wines.length;
  console.log(`[MatchingAgent] Query returned ${wines.length} wines in ${timing.query}ms${queryResult.relaxedFrom ? ` (relaxed: ${queryResult.relaxedFrom})` : ''}`);

  if (wines.length === 0) {
    return {
      wines: [],
      suppliersMap: {},
      parsed,
      preferences,
      timing: { ...timing, total: Date.now() - t0 },
      totalDbMatches: 0,
      relaxedFrom: queryResult.relaxedFrom,
    };
  }

  // -------------------------------------------------------------------------
  // Step 4a: Enrich wines with inferred style profiles (sync, <1ms)
  // If DB columns body/tannin/acidity are null, infer from grape+color
  // -------------------------------------------------------------------------
  let enrichedCount = 0;
  for (const wine of wines) {
    if (!wine.body || !wine.tannin || !wine.acidity) {
      const inferred = inferWineStyle(wine.grape || '', wine.color || '', wine.region || undefined, wine.description || undefined);
      if (!wine.body) wine.body = inferred.body;
      if (!wine.tannin) wine.tannin = inferred.tannin;
      if (!wine.acidity) wine.acidity = inferred.acidity;
      enrichedCount++;
    }
  }
  if (enrichedCount > 0) {
    console.log(`[MatchingAgent] Style inference: enriched ${enrichedCount}/${wines.length} wines`);
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
  // Step 4c: Build market context (async, fail-safe)
  // -------------------------------------------------------------------------
  let marketContext = '';
  let marketLeaderSubsidiaries: string[] = [];
  try {
    const tMarket = Date.now();
    [marketContext, marketLeaderSubsidiaries] = await Promise.all([
      buildMarketContext(),
      getMarketLeaderSubsidiaries(),
    ]);
    timing.marketContext = Date.now() - tMarket;
    if (marketContext) {
      console.log(`[MatchingAgent] Market context built in ${timing.marketContext}ms (${marketLeaderSubsidiaries.length} subsidiaries)`);
    }
  } catch (err: any) {
    console.warn('[MatchingAgent] Market context failed (non-critical):', err?.message);
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
      breakdown: { price: 10, color: 10, region: 8, grape: 10, food: 7, styleMatch: 8, availability: 5, certification: 0, goldenPair: 0, cuisineMatch: 0 },
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
  // Step 5c: Pre-fetch supplier names for AI context
  // -------------------------------------------------------------------------
  let supplierNamesMap: Record<string, string> = {};
  if (options.enableAIRerank && marketLeaderSubsidiaries.length > 0) {
    try {
      const supplierIds = [...new Set(scoredWines.map(sw => sw.wine.supplier_id).filter(Boolean))];
      if (supplierIds.length > 0) {
        const { data: suppliers } = await getSupabaseAdmin()
          .from('suppliers')
          .select('id, namn')
          .in('id', supplierIds);
        if (suppliers) {
          for (const s of suppliers) {
            supplierNamesMap[s.id] = s.namn;
          }
        }
      }
    } catch (err: any) {
      console.warn('[MatchingAgent] Supplier name pre-fetch failed (non-critical):', err?.message);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: AI re-rank (async, fallback to pre-score order)
  // -------------------------------------------------------------------------
  if (options.enableAIRerank) {
    const tRerank = Date.now();

    // Build search context for AI
    const searchContext = buildSearchContext(input, parsed);

    // Combine knowledge base context + RAG context + market context
    const combinedKnowledge = [knowledgeContext.promptContext, ragContext, marketContext]
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
        marketLeaderSubsidiaries,
        supplierNamesMap,
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
    relaxedFrom: queryResult.relaxedFrom,
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
    alcohol_free: 'alkoholfritt vin',
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
      .select('id, namn, kontakt_email, min_order_bottles, min_order_value_sek, provorder_enabled, provorder_fee_sek, payment_terms')
      .in('id', supplierIds);

    if (suppliers) {
      for (const s of suppliers) {
        suppliersMap[s.id] = {
          id: s.id,
          namn: s.namn,
          kontakt_email: s.kontakt_email,
          min_order_bottles: s.min_order_bottles,
          min_order_value_sek: s.min_order_value_sek ?? null,
          provorder_enabled: s.provorder_enabled || false,
          provorder_fee_sek: s.provorder_fee_sek || 500,
          payment_terms: s.payment_terms || null,
        };
      }
    }
  } catch (err: any) {
    console.warn('[MatchingAgent] Failed to fetch suppliers:', err?.message);
  }

  return suppliersMap;
}
