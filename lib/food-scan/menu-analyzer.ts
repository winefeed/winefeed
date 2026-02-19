/**
 * Food Scan Agent — Menu Analyzer
 *
 * 4-step matching for dish names against FOOD_TO_WINE_STYLES:
 * 1. Exact match (O(1) lookup)
 * 2. Fuzzy substring match
 * 3. Compound-word decomposition ("kycklingpasta" → "kyckling")
 * 4. Wolt category mapping ("Sushi" → sushi)
 *
 * AI fallback is NOT in this module — handled by food-scan-service for batch.
 */

import { FOOD_TO_WINE_STYLES } from '../matching-agent/food-pairing';
import { WoltMenuItem, DishAnalysis } from './types';

/** All known food keys from the static table */
const FOOD_KEYS = Object.keys(FOOD_TO_WINE_STYLES);

/** Wolt category name → food key mapping */
const CATEGORY_MAP: Record<string, string> = {
  'sushi': 'sushi',
  'pizza': 'pizza',
  'pasta': 'pasta',
  'fish': 'fisk',
  'fisk': 'fisk',
  'seafood': 'skaldjur',
  'skaldjur': 'skaldjur',
  'chicken': 'kyckling',
  'kyckling': 'kyckling',
  'burgers': 'nötkött',
  'hamburgare': 'nötkött',
  'thai': 'thai',
  'indian': 'indisk',
  'indiskt': 'indisk',
  'salads': 'sallad',
  'sallad': 'sallad',
  'meat': 'nötkött',
  'kött': 'nötkött',
};

/**
 * Normalize a dish name for matching.
 * Lowercase, strip common suffixes/filler words, trim.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')   // Remove parentheticals
    .replace(/\d+\s*(cl|ml|g|st|kr)\b/gi, '') // Remove measurements
    .replace(/[,.:;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Step 1: Exact match against FOOD_TO_WINE_STYLES keys */
function tryExactMatch(normalized: string): { key: string; confidence: number } | null {
  if (FOOD_TO_WINE_STYLES[normalized]) {
    return { key: normalized, confidence: 1.0 };
  }
  return null;
}

/** Step 2: Fuzzy substring — check if any food key is contained in the dish name */
function tryFuzzyMatch(normalized: string): { key: string; confidence: number } | null {
  // Sort by length descending to prefer longer (more specific) matches
  const sorted = [...FOOD_KEYS].sort((a, b) => b.length - a.length);

  for (const key of sorted) {
    if (key.length >= 3 && normalized.includes(key)) {
      return { key, confidence: 0.8 };
    }
  }
  return null;
}

/** Step 3: Compound-word decomposition — split compound words and try each part */
function tryDecompose(normalized: string): { key: string; confidence: number } | null {
  const words = normalized.split(/\s+/);

  for (const word of words) {
    if (word.length < 4) continue;

    // Try matching each food key as a prefix of the compound word
    for (const key of FOOD_KEYS) {
      if (key.length >= 3 && word.startsWith(key) && word.length > key.length) {
        return { key, confidence: 0.6 };
      }
    }

    // Try matching each food key as a suffix
    for (const key of FOOD_KEYS) {
      if (key.length >= 3 && word.endsWith(key) && word.length > key.length) {
        return { key, confidence: 0.5 };
      }
    }
  }

  return null;
}

/** Step 4: Wolt category mapping */
function tryCategoryMatch(category: string | undefined): { key: string; confidence: number } | null {
  if (!category) return null;
  const cat = category.toLowerCase().trim();

  // Direct category match
  if (CATEGORY_MAP[cat]) {
    return { key: CATEGORY_MAP[cat], confidence: 0.4 };
  }

  // Substring in category name
  for (const [catKey, foodKey] of Object.entries(CATEGORY_MAP)) {
    if (cat.includes(catKey)) {
      return { key: foodKey, confidence: 0.3 };
    }
  }

  return null;
}

/**
 * Analyze a list of menu items against the food pairing table.
 * Returns per-dish analysis with match status and method.
 */
export function analyzeDishes(items: WoltMenuItem[]): DishAnalysis[] {
  return items.map(item => {
    const normalized = normalize(item.name);
    const original = item.name;

    // Try each step in order
    const exact = tryExactMatch(normalized);
    if (exact) {
      const pref = FOOD_TO_WINE_STYLES[exact.key];
      return {
        dish_name: normalized,
        dish_name_original: original,
        matched: true,
        match_key: exact.key,
        colors: pref.colors,
        regions: pref.regions,
        grapes: pref.grapes,
        confidence: exact.confidence,
        method: 'exact' as const,
      };
    }

    const fuzzy = tryFuzzyMatch(normalized);
    if (fuzzy) {
      const pref = FOOD_TO_WINE_STYLES[fuzzy.key];
      return {
        dish_name: normalized,
        dish_name_original: original,
        matched: true,
        match_key: fuzzy.key,
        colors: pref.colors,
        regions: pref.regions,
        grapes: pref.grapes,
        confidence: fuzzy.confidence,
        method: 'fuzzy' as const,
      };
    }

    const decomposed = tryDecompose(normalized);
    if (decomposed) {
      const pref = FOOD_TO_WINE_STYLES[decomposed.key];
      return {
        dish_name: normalized,
        dish_name_original: original,
        matched: true,
        match_key: decomposed.key,
        colors: pref.colors,
        regions: pref.regions,
        grapes: pref.grapes,
        confidence: decomposed.confidence,
        method: 'decompose' as const,
      };
    }

    const category = tryCategoryMatch(item.category);
    if (category) {
      const pref = FOOD_TO_WINE_STYLES[category.key];
      return {
        dish_name: normalized,
        dish_name_original: original,
        matched: true,
        match_key: category.key,
        colors: pref.colors,
        regions: pref.regions,
        grapes: pref.grapes,
        confidence: category.confidence,
        method: 'category' as const,
      };
    }

    // No match
    return {
      dish_name: normalized,
      dish_name_original: original,
      matched: false,
      colors: [],
      regions: [],
      grapes: [],
      confidence: 0,
      method: 'none' as const,
    };
  });
}
