/**
 * Matching Agent — Food Pairing & Style Lookup Tables
 *
 * Static tables mapping food, occasions, and styles to wine preferences.
 * No AI, no cost — pure deterministic lookup.
 */

import { MergedPreferences, ParsedFritext, EMPTY_PARSED } from './types';

// ============================================================================
// Food → Wine Style Preferences
// ============================================================================

interface FoodWinePreference {
  colors: string[];
  regions: string[];
  grapes: string[];
}

/**
 * Maps food keywords to wine styles that traditionally pair well.
 * Swedish keywords since that's what users type.
 */
export const FOOD_TO_WINE_STYLES: Record<string, FoodWinePreference> = {
  // Red meats
  'lamm': { colors: ['red'], regions: ['bordeaux', 'rhône', 'rioja', 'barolo'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo'] },
  'nötkött': { colors: ['red'], regions: ['bordeaux', 'mendoza', 'barossa'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Shiraz'] },
  'biff': { colors: ['red'], regions: ['napa valley', 'bordeaux', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Malbec'] },
  'vilt': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo'] },
  'vildsvin': { colors: ['red'], regions: ['toscana', 'rhône', 'languedoc'], grapes: ['Sangiovese', 'Syrah', 'Grenache'] },
  'älg': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rhône'], grapes: ['Pinot Noir', 'Nebbiolo', 'Syrah'] },
  'hjort': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'priorat'], grapes: ['Pinot Noir', 'Nebbiolo', 'Grenache'] },
  'entrecote': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza'], grapes: ['Cabernet Sauvignon', 'Malbec'] },
  'oxfilé': { colors: ['red'], regions: ['bordeaux', 'barolo', 'napa valley'], grapes: ['Cabernet Sauvignon', 'Nebbiolo', 'Merlot'] },

  // White meats & poultry
  'kyckling': { colors: ['white', 'red'], regions: ['bourgogne', 'loire', 'rioja'], grapes: ['Chardonnay', 'Chenin Blanc', 'Pinot Noir'] },
  'anka': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo'] },
  'gås': { colors: ['red', 'white'], regions: ['alsace', 'bourgogne', 'loire'], grapes: ['Gewürztraminer', 'Pinot Noir', 'Chenin Blanc'] },
  'fläsk': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Pinot Gris', 'Chenin Blanc'] },
  'kalv': { colors: ['white', 'red'], regions: ['bourgogne', 'piemonte', 'toscana'], grapes: ['Chardonnay', 'Nebbiolo', 'Sangiovese'] },

  // Seafood
  'fisk': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Albariño'] },
  'lax': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'oregon'], grapes: ['Chardonnay', 'Pinot Gris', 'Pinot Noir'] },
  'torsk': { colors: ['white'], regions: ['chablis', 'muscadet', 'vinho verde'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'hummer': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'skaldjur': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'rías baixas'], grapes: ['Chardonnay', 'Albariño', 'Sauvignon Blanc'] },
  'räkor': { colors: ['white', 'rose'], regions: ['provence', 'chablis', 'rías baixas'], grapes: ['Albariño', 'Chardonnay', 'Grenache'] },
  'musslor': { colors: ['white'], regions: ['muscadet', 'chablis', 'vinho verde'], grapes: ['Melon de Bourgogne', 'Chardonnay'] },
  'ostron': { colors: ['white', 'sparkling'], regions: ['chablis', 'champagne', 'muscadet'], grapes: ['Chardonnay', 'Melon de Bourgogne'] },
  'kräftor': { colors: ['white', 'sparkling'], regions: ['alsace', 'bourgogne', 'champagne'], grapes: ['Riesling', 'Chardonnay'] },

  // Vegetarian
  'pasta': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'sicilia'], grapes: ['Sangiovese', 'Nebbiolo', 'Nero d\'Avola'] },
  'pizza': { colors: ['red'], regions: ['toscana', 'sicilia', 'campania'], grapes: ['Sangiovese', 'Nero d\'Avola', 'Aglianico'] },
  'svamp': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rioja'], grapes: ['Pinot Noir', 'Nebbiolo', 'Tempranillo'] },
  'ost': { colors: ['red', 'white', 'fortified'], regions: ['bourgogne', 'douro', 'rioja'], grapes: ['Pinot Noir', 'Chardonnay'] },
  'sallad': { colors: ['white', 'rose'], regions: ['provence', 'loire', 'rueda'], grapes: ['Sauvignon Blanc', 'Verdejo', 'Grenache'] },

  // Asian
  'sushi': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'marlborough'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner'] },
  'thai': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'indisk': { colors: ['white'], regions: ['alsace', 'mosel'], grapes: ['Riesling', 'Gewürztraminer'] },
};

// ============================================================================
// Occasion → Wine Preferences
// ============================================================================

interface OccasionPreference {
  colors: string[];
  price_sensitivity: 'budget' | 'premium' | 'any';
  style_hint: string;
}

export const OCCASION_TO_WINE: Record<string, OccasionPreference> = {
  'nyårsfest': { colors: ['sparkling'], price_sensitivity: 'premium', style_hint: 'celebration' },
  'nyår': { colors: ['sparkling'], price_sensitivity: 'premium', style_hint: 'celebration' },
  'fest': { colors: ['sparkling', 'red', 'white'], price_sensitivity: 'any', style_hint: 'crowd-pleaser' },
  'bröllop': { colors: ['sparkling', 'white', 'rose'], price_sensitivity: 'premium', style_hint: 'elegant' },
  'brunch': { colors: ['sparkling', 'rose', 'white'], price_sensitivity: 'budget', style_hint: 'light' },
  'mingel': { colors: ['sparkling', 'white', 'rose'], price_sensitivity: 'budget', style_hint: 'accessible' },
  'vardagsvin': { colors: ['red', 'white'], price_sensitivity: 'budget', style_hint: 'everyday' },
  'vinprovning': { colors: ['red', 'white'], price_sensitivity: 'premium', style_hint: 'distinctive' },
  'middag': { colors: ['red', 'white'], price_sensitivity: 'any', style_hint: 'versatile' },
  'julbord': { colors: ['red', 'white', 'sparkling'], price_sensitivity: 'any', style_hint: 'nordic-food' },
  'midsommar': { colors: ['white', 'rose', 'sparkling'], price_sensitivity: 'any', style_hint: 'summer' },
  'sommar': { colors: ['white', 'rose', 'sparkling'], price_sensitivity: 'any', style_hint: 'refreshing' },
  'vinter': { colors: ['red'], price_sensitivity: 'any', style_hint: 'warming' },
};

// ============================================================================
// Style → Wine Characteristics
// ============================================================================

interface StylePreference {
  regions: string[];
  grapes: string[];
  organic: boolean;
  biodynamic: boolean;
}

export const STYLE_TO_CHARACTERISTICS: Record<string, StylePreference> = {
  'naturvin': { regions: ['loire', 'jura', 'beaujolais', 'sicilia', 'languedoc'], grapes: ['Gamay', 'Chenin Blanc', 'Grenache'], organic: true, biodynamic: false },
  'naturligt': { regions: ['loire', 'jura', 'beaujolais'], grapes: ['Gamay', 'Chenin Blanc'], organic: true, biodynamic: false },
  'elegant': { regions: ['bourgogne', 'piemonte', 'champagne', 'mosel'], grapes: ['Pinot Noir', 'Nebbiolo', 'Chardonnay', 'Riesling'], organic: false, biodynamic: false },
  'kraftig': { regions: ['barossa', 'napa valley', 'priorat', 'mendoza'], grapes: ['Shiraz', 'Cabernet Sauvignon', 'Malbec', 'Grenache'], organic: false, biodynamic: false },
  'fruktig': { regions: ['marlborough', 'chile', 'australia', 'sicilia'], grapes: ['Sauvignon Blanc', 'Malbec', 'Shiraz'], organic: false, biodynamic: false },
  'mineralisk': { regions: ['chablis', 'sancerre', 'mosel', 'santorini'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Assyrtiko'], organic: false, biodynamic: false },
  'lätt': { regions: ['loire', 'beaujolais', 'alsace', 'vinho verde'], grapes: ['Gamay', 'Pinot Noir', 'Riesling'], organic: false, biodynamic: false },
  'torr': { regions: ['chablis', 'sancerre', 'rueda'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Verdejo'], organic: false, biodynamic: false },
  'söt': { regions: ['sauternes', 'mosel', 'tokaj'], grapes: ['Sémillon', 'Riesling', 'Furmint'], organic: false, biodynamic: false },
  'biodynamisk': { regions: ['loire', 'alsace', 'bourgogne'], grapes: [], organic: true, biodynamic: true },
  'ekologisk': { regions: [], grapes: [], organic: true, biodynamic: false },
};

// ============================================================================
// Lookup Functions
// ============================================================================

/** Find food pairing preferences from food keywords */
export function lookupFoodPairing(foods: string[]): FoodWinePreference {
  const merged: FoodWinePreference = { colors: [], regions: [], grapes: [] };

  for (const food of foods) {
    const key = food.toLowerCase().trim();
    const pref = FOOD_TO_WINE_STYLES[key];
    if (pref) {
      merged.colors.push(...pref.colors);
      merged.regions.push(...pref.regions);
      merged.grapes.push(...pref.grapes);
    }
  }

  return {
    colors: [...new Set(merged.colors)],
    regions: [...new Set(merged.regions)],
    grapes: [...new Set(merged.grapes)],
  };
}

/** Find occasion preferences */
export function lookupOccasion(occasion: string | null): OccasionPreference | null {
  if (!occasion) return null;
  const key = occasion.toLowerCase().trim();
  return OCCASION_TO_WINE[key] || null;
}

/** Find style preferences */
export function lookupStyle(styles: string[]): StylePreference {
  const merged: StylePreference = { regions: [], grapes: [], organic: false, biodynamic: false };

  for (const style of styles) {
    const key = style.toLowerCase().trim();
    const pref = STYLE_TO_CHARACTERISTICS[key];
    if (pref) {
      merged.regions.push(...pref.regions);
      merged.grapes.push(...pref.grapes);
      if (pref.organic) merged.organic = true;
      if (pref.biodynamic) merged.biodynamic = true;
    }
  }

  return {
    regions: [...new Set(merged.regions)],
    grapes: [...new Set(merged.grapes)],
    organic: merged.organic,
    biodynamic: merged.biodynamic,
  };
}

/**
 * Merge all preferences: parsed fritext + food lookup + occasion + style + structured filters.
 * Structured filters (UI chips) take priority over AI-parsed values.
 */
export function mergePreferences(
  parsed: ParsedFritext,
  structuredColor?: string,
  structuredCountry?: string,
  structuredGrape?: string,
): MergedPreferences {
  const foodPref = lookupFoodPairing(parsed.food_pairing);
  const occasionPref = lookupOccasion(parsed.occasion);
  const stylePref = lookupStyle(parsed.style);

  // Collect all color hints, but UI chip overrides
  const allColors: string[] = [];
  if (structuredColor && structuredColor !== 'all') {
    allColors.push(structuredColor);
  } else {
    if (parsed.implied_color) allColors.push(parsed.implied_color);
    allColors.push(...foodPref.colors);
    if (occasionPref) allColors.push(...occasionPref.colors);
  }

  // Countries: structured filter > parsed
  const allCountries: string[] = [];
  if (structuredCountry && structuredCountry !== 'all' && structuredCountry !== 'other') {
    allCountries.push(structuredCountry);
  } else {
    if (parsed.implied_country) allCountries.push(parsed.implied_country);
  }

  // Regions from parsed + food + style
  const allRegions: string[] = [];
  if (parsed.implied_region) allRegions.push(parsed.implied_region);
  allRegions.push(...foodPref.regions);
  allRegions.push(...stylePref.regions);

  // Grapes: structured filter > parsed + food + style
  const allGrapes: string[] = [];
  if (structuredGrape && structuredGrape !== 'all' && structuredGrape !== 'other') {
    allGrapes.push(structuredGrape);
  } else {
    allGrapes.push(...parsed.implied_grapes);
    allGrapes.push(...foodPref.grapes);
    allGrapes.push(...stylePref.grapes);
  }

  // Organic/biodynamic: true from any source
  const organic = parsed.organic || stylePref.organic;
  const biodynamic = parsed.biodynamic || stylePref.biodynamic;

  // Price sensitivity: occasion > parsed > default
  const price_sensitivity = occasionPref?.price_sensitivity || parsed.price_sensitivity || 'any';

  return {
    colors: [...new Set(allColors)],
    countries: [...new Set(allCountries)],
    regions: [...new Set(allRegions)],
    grapes: [...new Set(allGrapes)],
    food_pairing: parsed.food_pairing,
    occasion: parsed.occasion,
    style: parsed.style,
    organic,
    biodynamic,
    price_sensitivity,
  };
}
