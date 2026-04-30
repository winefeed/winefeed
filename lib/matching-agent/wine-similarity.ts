/**
 * Wine Similarity Engine
 *
 * Given a target wine, finds similar wines from a catalog.
 * Designed for cross-supplier discovery: when a restaurant likes a wine,
 * suggest alternatives from other suppliers.
 *
 * Pure deterministic scoring — no AI calls, fast execution.
 */

import { SupplierWineRow } from './types';
import { inferWineStyle, WineStyle } from './style-inference';
import { findGrape, type GrapeProfile } from './knowledge';

// ============================================================================
// Types
// ============================================================================

export interface SimilarWine {
  wine: SupplierWineRow;
  similarity: number;  // 0-100
  reasons: string[];   // Swedish: ["Samma druva (Pinot Noir)", "Liknande region"]
}

// ============================================================================
// In-memory cache (TTL: 1 hour)
// ============================================================================

interface CacheEntry {
  results: SimilarWine[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

function getCacheKey(wineId: string, catalogSize: number): string {
  return `${wineId}:${catalogSize}`;
}

// ============================================================================
// Grape synonym groups for matching blends and alternate names
// ============================================================================

const GRAPE_SYNONYM_GROUPS: string[][] = [
  ['pinot noir', 'spätburgunder', 'pinot nero', 'blauburgunder'],
  ['syrah', 'shiraz'],
  ['grenache', 'garnacha', 'cannonau'],
  ['tempranillo', 'tinta de toro', 'tinto fino', 'cencibel', 'aragonez'],
  ['sangiovese', 'brunello', 'morellino', 'prugnolo gentile'],
  ['cabernet sauvignon', 'cabernet', 'cab sav'],
  ['malbec', 'côt'],
  ['mourvèdre', 'monastrell', 'mataro'],
  ['carignan', 'cariñena', 'mazuelo'],
  ['cinsault', 'cinsaut'],
  ['zinfandel', 'primitivo'],
  ['mencía', 'mencia'],
  ['trousseau', 'bastardo'],
  ['poulsard', 'ploussard'],
  ['pinot grigio', 'pinot gris', 'grauburgunder', 'ruländer'],
  ['sauvignon blanc', 'fumé blanc'],
  ['chenin blanc', 'steen'],
  ['albariño', 'albarino', 'alvarinho'],
  ['gewürztraminer', 'gewurztraminer', 'traminer'],
  ['grüner veltliner', 'gruner veltliner'],
  ['vermentino', 'rolle'],
  ['trebbiano', 'ugni blanc'],
  ['glera', 'prosecco'],
  ['pinot blanc', 'pinot bianco', 'weissburgunder'],
  ['silvaner', 'sylvaner'],
  ['macabeo', 'viura'],
  ['chardonnay', 'morillon'],
  ['müller-thurgau', 'muller-thurgau', 'rivaner'],
  ['blaufränkisch', 'lemberger', 'kékfrankos'],
  ['zweigelt', 'blauer zweigelt'],
  ['carménère', 'carmenere'],
  ['greco', 'greco di tufo'],
  ['nebbiolo', 'spanna', 'chiavennasca'],
];

/** Map each synonym to its group index for fast lookup */
const synonymToGroup = new Map<string, number>();
GRAPE_SYNONYM_GROUPS.forEach((group, idx) => {
  group.forEach(name => synonymToGroup.set(name, idx));
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse grape field into individual grape names (lowercased, trimmed).
 * Handles "Cabernet Sauvignon, Merlot" and "Syrah / Grenache" etc.
 */
function parseGrapes(grape: string | null): string[] {
  if (!grape) return [];
  return grape
    .split(/[,/&+]/)
    .map(g => g.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Get the synonym group index for a grape name, or -1 if not in any group.
 */
function getSynonymGroup(grape: string): number {
  return synonymToGroup.get(grape) ?? -1;
}

/**
 * Check if two grape names are synonyms.
 */
function areSynonyms(a: string, b: string): boolean {
  if (a === b) return true;
  const groupA = getSynonymGroup(a);
  const groupB = getSynonymGroup(b);
  return groupA >= 0 && groupA === groupB;
}

/**
 * Score grape match between target and candidate.
 * Returns [score (0-30), reason or null]
 */
function scoreGrapeMatch(
  targetGrapes: string[],
  candidateGrapes: string[],
): [number, string | null] {
  if (targetGrapes.length === 0 || candidateGrapes.length === 0) return [0, null];

  // Check for exact match on primary grape
  const targetPrimary = targetGrapes[0];
  const candidatePrimary = candidateGrapes[0];

  if (targetPrimary === candidatePrimary) {
    return [30, `Samma druva (${capitalize(targetPrimary)})`];
  }

  // Check synonym match on primary grape
  if (areSynonyms(targetPrimary, candidatePrimary)) {
    return [25, `Samma druva (${capitalize(targetPrimary)} / ${capitalize(candidatePrimary)})`];
  }

  // Check exact match on any grape in blend
  for (const tg of targetGrapes) {
    for (const cg of candidateGrapes) {
      if (tg === cg) {
        return [15, `Gemensam druva i blend (${capitalize(tg)})`];
      }
      if (areSynonyms(tg, cg)) {
        return [15, `Gemensam druva i blend (${capitalize(tg)})`];
      }
    }
  }

  return [0, null];
}

/**
 * Score color match.
 * Returns [score (0-20), reason or null]
 */
function scoreColorMatch(
  targetColor: string | null,
  candidateColor: string | null,
): [number, string | null] {
  if (!targetColor || !candidateColor) return [0, null];
  if (targetColor.toLowerCase() === candidateColor.toLowerCase()) {
    return [20, null]; // Too obvious to state as reason
  }
  return [0, null];
}

/**
 * Resolve wine style, using explicit values or inferring from grape/color.
 */
function resolveStyle(wine: SupplierWineRow): WineStyle {
  if (wine.body && wine.tannin && wine.acidity) {
    return {
      body: wine.body as WineStyle['body'],
      tannin: wine.tannin as WineStyle['tannin'],
      acidity: wine.acidity as WineStyle['acidity'],
    };
  }
  return inferWineStyle(
    wine.grape || '',
    wine.color || '',
    wine.region || undefined,
    wine.description || undefined,
    wine.vintage ?? undefined,
  );
}

const BODY_ORDER: Record<string, number> = { light: 0, medium: 1, full: 2 };
const LEVEL_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

/**
 * Score style distance.
 * Returns [score (0-25), reason or null]
 */
function scoreStyleMatch(
  targetStyle: WineStyle,
  candidateStyle: WineStyle,
): [number, string | null] {
  let dimensionsOff = 0;

  if (targetStyle.body !== candidateStyle.body) dimensionsOff++;
  if (targetStyle.tannin !== candidateStyle.tannin) dimensionsOff++;
  if (targetStyle.acidity !== candidateStyle.acidity) dimensionsOff++;

  if (dimensionsOff === 0) return [25, 'Liknande stilprofil'];
  if (dimensionsOff === 1) return [15, 'Liknande stilprofil'];
  if (dimensionsOff === 2) return [5, null];
  return [0, null];
}

/**
 * Score region/country match.
 * Returns [score (0-15), reason or null]
 */
function scoreRegionMatch(
  target: SupplierWineRow,
  candidate: SupplierWineRow,
): [number, string | null] {
  // Same region
  if (
    target.region && candidate.region &&
    target.region.toLowerCase() === candidate.region.toLowerCase()
  ) {
    return [15, `Samma region (${target.region})`];
  }

  // Same country
  if (
    target.country && candidate.country &&
    target.country.toLowerCase() === candidate.country.toLowerCase()
  ) {
    return [10, `Samma land (${target.country})`];
  }

  return [0, null];
}

/**
 * Score price proximity.
 * Returns [score (0-10), reason or null]
 */
function scorePriceProximity(
  targetPrice: number,
  candidatePrice: number,
): [number, string | null] {
  if (!targetPrice || !candidatePrice) return [0, null];

  const diff = Math.abs(targetPrice - candidatePrice);
  const pctDiff = diff / targetPrice;

  if (pctDiff <= 0.20) return [10, 'Liknande prisklass'];
  if (pctDiff <= 0.50) return [5, null];
  return [0, null];
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Check if two wines are the "same wine" (should be skipped).
 */
function isSameWine(a: SupplierWineRow, b: SupplierWineRow): boolean {
  if (a.id === b.id) return true;

  // Same name + producer + vintage
  if (
    a.name && b.name && a.producer && b.producer &&
    a.name.toLowerCase() === b.name.toLowerCase() &&
    a.producer.toLowerCase() === b.producer.toLowerCase() &&
    a.vintage === b.vintage
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Find wines similar to the target wine from a catalog.
 *
 * Algorithm scores each candidate on:
 * - Grape match (0-30)
 * - Color match (0-20)
 * - Style distance (0-25)
 * - Region/country (0-15)
 * - Price proximity (0-10)
 * - Same supplier penalty: -20
 *
 * Returns top N results sorted by similarity descending.
 */
export function findSimilarWines(
  targetWine: SupplierWineRow,
  allWines: SupplierWineRow[],
  maxResults: number = 5,
): SimilarWine[] {
  // Check cache
  const cacheKey = getCacheKey(targetWine.id, allWines.length);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  const targetGrapes = parseGrapes(targetWine.grape);
  const targetStyle = resolveStyle(targetWine);
  const results: SimilarWine[] = [];

  for (const candidate of allWines) {
    // Skip same wine
    if (isSameWine(targetWine, candidate)) continue;

    // Skip inactive wines
    if (!candidate.is_active) continue;

    const reasons: string[] = [];
    let totalScore = 0;

    // 1. Grape match (0-30)
    const candidateGrapes = parseGrapes(candidate.grape);
    const [grapeScore, grapeReason] = scoreGrapeMatch(targetGrapes, candidateGrapes);
    totalScore += grapeScore;
    if (grapeReason) reasons.push(grapeReason);

    // 2. Color match (0-20)
    const [colorScore] = scoreColorMatch(targetWine.color, candidate.color);
    totalScore += colorScore;

    // 3. Style distance (0-25)
    const candidateStyle = resolveStyle(candidate);
    const [styleScore, styleReason] = scoreStyleMatch(targetStyle, candidateStyle);
    totalScore += styleScore;
    if (styleReason) reasons.push(styleReason);

    // 4. Region/country match (0-15)
    const [regionScore, regionReason] = scoreRegionMatch(targetWine, candidate);
    totalScore += regionScore;
    if (regionReason) reasons.push(regionReason);

    // 5. Price proximity (0-10)
    const [priceScore, priceReason] = scorePriceProximity(
      targetWine.price_ex_vat_sek,
      candidate.price_ex_vat_sek,
    );
    totalScore += priceScore;
    if (priceReason) reasons.push(priceReason);

    // 6. Same supplier penalty (-20)
    if (candidate.supplier_id === targetWine.supplier_id) {
      totalScore -= 20;
    }

    // Clamp to 0-100
    totalScore = Math.max(0, Math.min(100, totalScore));

    if (totalScore > 0) {
      results.push({
        wine: candidate,
        similarity: totalScore,
        reasons,
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  const topResults = results.slice(0, maxResults);

  // Cache result
  cache.set(cacheKey, { results: topResults, timestamp: Date.now() });

  return topResults;
}
