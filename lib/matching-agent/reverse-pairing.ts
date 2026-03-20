/**
 * Reverse Pairing Engine
 *
 * Given a wine's profile (grape, color, region, body, tannin, acidity),
 * suggests foods that pair well. Reverses the food→wine lookup tables.
 *
 * Pure deterministic lookup — no AI calls, fast execution.
 */

import { FOOD_TO_WINE_STYLES } from './food-pairing';
import { FOOD_STYLE_PREFERENCES, StylePreference } from './food-style-preferences';
import { GOLDEN_PAIRS } from './golden-pairs';
import { inferWineStyle } from './style-inference';

// ============================================================================
// Types
// ============================================================================

export interface FoodSuggestion {
  food: string;           // Swedish food keyword (capitalized)
  score: number;          // 0-100 match quality
  isGoldenPair: boolean;  // True if this is an iconic pairing
  reason?: string;        // From golden pairs, if available
}

interface WineInput {
  grape: string | null;
  color: string | null;
  region: string | null;
  country: string | null;
  body: string | null;
  tannin: string | null;
  acidity: string | null;
  description?: string | null;
}

// ============================================================================
// In-memory cache (TTL: 1 hour)
// ============================================================================

interface CacheEntry {
  suggestions: FoodSuggestion[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

function getCacheKey(wine: WineInput): string {
  return [
    wine.grape ?? '',
    wine.color ?? '',
    wine.region ?? '',
    wine.country ?? '',
    wine.body ?? '',
    wine.tannin ?? '',
    wine.acidity ?? '',
  ].join('|');
}

// ============================================================================
// Helpers
// ============================================================================

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Check if wine's grape matches any grape in the list.
 * Handles blends like "Cabernet Sauvignon, Merlot".
 */
function grapeMatches(wineGrape: string | null, grapes: string[]): boolean {
  if (!wineGrape || grapes.length === 0) return false;
  const wineGrapeLower = wineGrape.toLowerCase();
  return grapes.some(g => wineGrapeLower.includes(g.toLowerCase()));
}

/**
 * Check if wine's region matches any region in the list.
 */
function regionMatches(wineRegion: string | null, regions: string[]): boolean {
  if (!wineRegion || regions.length === 0) return false;
  const wineRegionLower = wineRegion.toLowerCase();
  return regions.some(r => wineRegionLower.includes(r.toLowerCase()));
}

/**
 * Calculate style distance between wine and food preference.
 * Lower distance = better match. Returns 0-3.
 */
function styleDistance(
  wineBody: string,
  wineTannin: string,
  wineAcidity: string,
  foodPref: StylePreference,
): number {
  let distance = 0;
  if (!foodPref.body.includes(wineBody)) distance += 1;
  if (!foodPref.tannin.includes(wineTannin)) distance += 1;
  if (!foodPref.acidity.includes(wineAcidity)) distance += 1;
  return distance;
}

// ============================================================================
// Foods to exclude from suggestions (too generic or not useful)
// ============================================================================

const EXCLUDE_FOODS = new Set([
  'dessert', // too generic
]);

// ============================================================================
// Main engine
// ============================================================================

export function suggestFoodsForWine(wine: WineInput): FoodSuggestion[] {
  // Check cache
  const cacheKey = getCacheKey(wine);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.suggestions;
  }

  // Resolve wine style (body/tannin/acidity)
  const resolvedStyle = resolveWineStyle(wine);
  const { body, tannin, acidity } = resolvedStyle;

  // Accumulate scores per food keyword
  const scoreMap = new Map<string, { score: number; isGoldenPair: boolean; reason?: string }>();

  // --- Step 1: Golden pairs ---
  scanGoldenPairs(wine, scoreMap);

  // --- Step 2: FOOD_TO_WINE_STYLES reverse lookup ---
  scanFoodToWineStyles(wine, scoreMap);

  // --- Step 3: FOOD_STYLE_PREFERENCES style distance ---
  scanStylePreferences(body, tannin, acidity, scoreMap);

  // --- Step 4: Combine, deduplicate, sort ---
  const suggestions: FoodSuggestion[] = [];
  for (const [food, data] of scoreMap) {
    if (EXCLUDE_FOODS.has(food)) continue;
    if (data.score <= 0) continue;

    suggestions.push({
      food: capitalize(food),
      score: Math.min(100, Math.round(data.score)),
      isGoldenPair: data.isGoldenPair,
      reason: data.reason,
    });
  }

  // Sort by score descending
  suggestions.sort((a, b) => b.score - a.score);

  // Return top 8-12 suggestions
  const result = suggestions.slice(0, 12);

  // Cache result
  cache.set(cacheKey, { suggestions: result, timestamp: Date.now() });

  return result;
}

// ============================================================================
// Step 1: Golden pairs
// ============================================================================

function scanGoldenPairs(
  wine: WineInput,
  scoreMap: Map<string, { score: number; isGoldenPair: boolean; reason?: string }>,
): void {
  for (const pair of GOLDEN_PAIRS) {
    // Color check
    if (pair.color && wine.color && pair.color !== wine.color) continue;

    let matches = false;

    // Grape match
    if (pair.grape && grapeMatches(wine.grape, pair.grape)) {
      matches = true;
    }

    // Region match
    if (pair.region && regionMatches(wine.region, pair.region)) {
      matches = true;
    }

    if (!matches) continue;

    const food = pair.food.toLowerCase();
    const existing = scoreMap.get(food);
    const goldenScore = 50 + pair.score_boost * 3; // 50-95 range for golden pairs

    if (!existing || goldenScore > existing.score) {
      scoreMap.set(food, {
        score: goldenScore,
        isGoldenPair: true,
        reason: pair.reason,
      });
    }
  }
}

// ============================================================================
// Step 2: FOOD_TO_WINE_STYLES reverse lookup
// ============================================================================

function scanFoodToWineStyles(
  wine: WineInput,
  scoreMap: Map<string, { score: number; isGoldenPair: boolean; reason?: string }>,
): void {
  for (const [food, pref] of Object.entries(FOOD_TO_WINE_STYLES)) {
    let matchScore = 0;

    // Color match (required — if wine has a color, it must be in food's colors)
    if (wine.color) {
      if (!pref.colors.includes(wine.color)) continue;
      matchScore += 15;
    }

    // Grape match
    if (grapeMatches(wine.grape, pref.grapes)) {
      matchScore += 25;
    }

    // Region match
    if (regionMatches(wine.region, pref.regions)) {
      matchScore += 20;
    }

    // Need at least color + (grape OR region) to be relevant
    if (matchScore < 35) continue;

    const foodKey = food.toLowerCase();
    const existing = scoreMap.get(foodKey);
    if (!existing) {
      scoreMap.set(foodKey, { score: matchScore, isGoldenPair: false });
    } else if (!existing.isGoldenPair) {
      // Add to existing score (but don't override golden pair data)
      existing.score = Math.max(existing.score, matchScore);
    }
  }
}

// ============================================================================
// Step 3: FOOD_STYLE_PREFERENCES style distance
// ============================================================================

function scanStylePreferences(
  body: string,
  tannin: string,
  acidity: string,
  scoreMap: Map<string, { score: number; isGoldenPair: boolean; reason?: string }>,
): void {
  for (const [food, pref] of Object.entries(FOOD_STYLE_PREFERENCES)) {
    const distance = styleDistance(body, tannin, acidity, pref);

    // Perfect match (distance=0) → 40 points, 1 miss → 25, 2 miss → 10, 3 miss → skip
    let styleScore: number;
    if (distance === 0) styleScore = 40;
    else if (distance === 1) styleScore = 25;
    else if (distance === 2) styleScore = 10;
    else continue;

    const foodKey = food.toLowerCase();
    const existing = scoreMap.get(foodKey);
    if (!existing) {
      scoreMap.set(foodKey, { score: styleScore, isGoldenPair: false });
    } else if (!existing.isGoldenPair) {
      // Combine style score with table score
      existing.score = Math.min(100, existing.score + Math.round(styleScore * 0.5));
    } else {
      // Even golden pairs get a small boost from style match
      existing.score = Math.min(100, existing.score + Math.round(styleScore * 0.3));
    }
  }
}

// ============================================================================
// Wine style resolution
// ============================================================================

function resolveWineStyle(wine: WineInput): { body: string; tannin: string; acidity: string } {
  // If wine already has explicit style, use it
  if (wine.body && wine.tannin && wine.acidity) {
    return { body: wine.body, tannin: wine.tannin, acidity: wine.acidity };
  }

  // Infer from grape/color/description
  const inferred = inferWineStyle(
    wine.grape || '',
    wine.color || '',
    wine.region || undefined,
    wine.description || undefined,
  );

  return {
    body: wine.body || inferred.body,
    tannin: wine.tannin || inferred.tannin,
    acidity: wine.acidity || inferred.acidity,
  };
}
