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

export interface FoodWinePreference {
  colors: string[];
  regions: string[];
  grapes: string[];
}

// Runtime overrides from DB (set by pairing-loader, checked before static table)
let RUNTIME_OVERRIDES: Record<string, FoodWinePreference> = {};

export function setRuntimeOverrides(overrides: Record<string, FoodWinePreference>): void {
  RUNTIME_OVERRIDES = overrides;
}

/**
 * Maps food keywords to wine styles that traditionally pair well.
 * Swedish keywords since that's what users type.
 */
export const FOOD_TO_WINE_STYLES: Record<string, FoodWinePreference> = {
  // ========================================================================
  // Red meats
  // ========================================================================
  'lamm': { colors: ['red'], regions: ['bordeaux', 'rhône', 'rioja', 'barolo', 'naoussa', 'alentejo'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo', 'Xinomavro', 'Touriga Nacional'] },
  'nötkött': { colors: ['red'], regions: ['bordeaux', 'mendoza', 'barossa', 'dão', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Shiraz', 'Touriga Nacional'] },
  'biff': { colors: ['red'], regions: ['napa valley', 'bordeaux', 'ribera del duero', 'washington state'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Malbec'] },
  'vilt': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte', 'naoussa'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo', 'Xinomavro'] },
  'vildsvin': { colors: ['red'], regions: ['toscana', 'rhône', 'languedoc', 'umbria'], grapes: ['Sangiovese', 'Syrah', 'Grenache'] },
  'älg': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rhône', 'naoussa'], grapes: ['Pinot Noir', 'Nebbiolo', 'Syrah', 'Xinomavro'] },
  'hjort': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'priorat', 'dão'], grapes: ['Pinot Noir', 'Nebbiolo', 'Grenache', 'Touriga Nacional'] },
  'entrecote': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza', 'alentejo'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Touriga Nacional'] },
  'oxfilé': { colors: ['red'], regions: ['bordeaux', 'barolo', 'napa valley'], grapes: ['Cabernet Sauvignon', 'Nebbiolo', 'Merlot'] },
  'grillat': { colors: ['red', 'rose'], regions: ['mendoza', 'barossa', 'alentejo', 'tavel'], grapes: ['Malbec', 'Shiraz', 'Touriga Nacional', 'Grenache'] },
  'pulled pork': { colors: ['red', 'rose'], regions: ['rhône', 'beaujolais', 'sicilia', 'alentejo'], grapes: ['Grenache', 'Gamay', 'Frappato', 'Castelão'] },

  // ========================================================================
  // White meats & poultry
  // ========================================================================
  'kyckling': { colors: ['white', 'red'], regions: ['bourgogne', 'loire', 'rioja', 'dão', 'friuli'], grapes: ['Chardonnay', 'Chenin Blanc', 'Pinot Noir', 'Friulano'] },
  'anka': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte', 'umbria'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo', 'Barbera'] },
  'gås': { colors: ['red', 'white'], regions: ['alsace', 'bourgogne', 'loire'], grapes: ['Gewürztraminer', 'Pinot Noir', 'Chenin Blanc'] },
  'fläsk': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'loire', 'clare valley'], grapes: ['Riesling', 'Pinot Gris', 'Chenin Blanc'] },
  'kalv': { colors: ['white', 'red'], regions: ['bourgogne', 'piemonte', 'toscana', 'friuli'], grapes: ['Chardonnay', 'Nebbiolo', 'Sangiovese', 'Friulano'] },

  // ========================================================================
  // Seafood
  // ========================================================================
  'fisk': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough', 'txakoli', 'vinho verde'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Albariño', 'Hondarrabi Zuri'] },
  'lax': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'oregon', 'clare valley'], grapes: ['Chardonnay', 'Pinot Gris', 'Pinot Noir', 'Riesling'] },
  'torsk': { colors: ['white'], regions: ['chablis', 'muscadet', 'vinho verde', 'txakoli'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'hummer': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'chablis', 'friuli'], grapes: ['Chardonnay', 'Pinot Noir', 'Friulano'] },
  'skaldjur': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'rías baixas', 'txakoli'], grapes: ['Chardonnay', 'Albariño', 'Sauvignon Blanc', 'Hondarrabi Zuri'] },
  'räkor': { colors: ['white', 'rose'], regions: ['provence', 'chablis', 'rías baixas', 'txakoli'], grapes: ['Albariño', 'Chardonnay', 'Grenache'] },
  'musslor': { colors: ['white'], regions: ['muscadet', 'chablis', 'vinho verde', 'txakoli'], grapes: ['Melon de Bourgogne', 'Chardonnay', 'Hondarrabi Zuri'] },
  'ostron': { colors: ['white', 'sparkling'], regions: ['chablis', 'champagne', 'muscadet', 'txakoli'], grapes: ['Chardonnay', 'Melon de Bourgogne'] },
  'kräftor': { colors: ['white', 'sparkling'], regions: ['alsace', 'bourgogne', 'champagne'], grapes: ['Riesling', 'Chardonnay'] },
  'ceviche': { colors: ['white'], regions: ['txakoli', 'vinho verde', 'rías baixas', 'clare valley'], grapes: ['Albariño', 'Riesling', 'Hondarrabi Zuri'] },
  'tonfisk': { colors: ['red', 'rose', 'white'], regions: ['provence', 'tavel', 'sicilia', 'naoussa'], grapes: ['Grenache', 'Nerello Mascalese', 'Xinomavro'] },

  // ========================================================================
  // Vegetarian & Plant-based
  // ========================================================================
  'pasta': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'sicilia', 'umbria'], grapes: ['Sangiovese', 'Nebbiolo', 'Nero d\'Avola', 'Barbera'] },
  'pizza': { colors: ['red'], regions: ['toscana', 'sicilia', 'campania'], grapes: ['Sangiovese', 'Nero d\'Avola', 'Aglianico'] },
  'svamp': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rioja', 'umbria'], grapes: ['Pinot Noir', 'Nebbiolo', 'Tempranillo', 'Barbera'] },
  'ost': { colors: ['red', 'white', 'fortified'], regions: ['bourgogne', 'douro', 'rioja', 'dão'], grapes: ['Pinot Noir', 'Chardonnay', 'Touriga Nacional'] },
  'sallad': { colors: ['white', 'rose'], regions: ['provence', 'loire', 'rueda', 'vinho verde', 'txakoli'], grapes: ['Sauvignon Blanc', 'Verdejo', 'Grenache', 'Grüner Veltliner'] },
  'risotto': { colors: ['white', 'red'], regions: ['alto adige', 'piemonte', 'friuli', 'bourgogne'], grapes: ['Pinot Bianco', 'Nebbiolo', 'Friulano', 'Chardonnay'] },
  'vegetariskt': { colors: ['white', 'red', 'orange'], regions: ['loire', 'friuli', 'alto adige', 'beaujolais'], grapes: ['Chenin Blanc', 'Friulano', 'Pinot Bianco', 'Gamay'] },
  'tryffel': { colors: ['red'], regions: ['piemonte', 'bourgogne', 'umbria'], grapes: ['Nebbiolo', 'Pinot Noir', 'Barbera'] },
  'soppa': { colors: ['white', 'red'], regions: ['loire', 'beaujolais', 'dão', 'vinho verde'], grapes: ['Chenin Blanc', 'Gamay', 'Touriga Nacional'] },
  'hummus': { colors: ['white', 'rose', 'orange'], regions: ['santorini', 'loire', 'friuli'], grapes: ['Assyrtiko', 'Chenin Blanc', 'Friulano'] },

  // ========================================================================
  // Asian
  // ========================================================================
  'sushi': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'marlborough', 'txakoli'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner'] },
  'thai': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough', 'clare valley'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'indisk': { colors: ['white'], regions: ['alsace', 'mosel', 'stellenbosch'], grapes: ['Riesling', 'Gewürztraminer', 'Chenin Blanc'] },
  'koreanskt': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'mosel'], grapes: ['Riesling', 'Gamay', 'Gewürztraminer'] },
  'kimchi': { colors: ['white', 'sparkling', 'orange'], regions: ['alsace', 'jura', 'friuli'], grapes: ['Riesling', 'Savagnin', 'Friulano'] },
  'dim sum': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'txakoli'], grapes: ['Riesling', 'Chardonnay', 'Grüner Veltliner'] },
  'ramen': { colors: ['white', 'red'], regions: ['beaujolais', 'alsace', 'mosel'], grapes: ['Gamay', 'Riesling', 'Pinot Gris'] },
  'vietnamesiskt': { colors: ['white'], regions: ['alsace', 'loire', 'vinho verde'], grapes: ['Riesling', 'Chenin Blanc', 'Grüner Veltliner'] },
  'wok': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'clare valley'], grapes: ['Riesling', 'Gamay', 'Grüner Veltliner'] },

  // ========================================================================
  // Mediterranean & Middle Eastern
  // ========================================================================
  'tapas': { colors: ['red', 'white', 'sparkling'], regions: ['rioja', 'txakoli', 'cava', 'priorat'], grapes: ['Tempranillo', 'Grenache', 'Hondarrabi Zuri'] },
  'mezze': { colors: ['white', 'rose', 'orange'], regions: ['santorini', 'naoussa', 'loire', 'friuli'], grapes: ['Assyrtiko', 'Xinomavro', 'Chenin Blanc'] },
  'grekiskt': { colors: ['white', 'red'], regions: ['santorini', 'naoussa', 'kreta'], grapes: ['Assyrtiko', 'Xinomavro', 'Vidiano'] },
  'moussaka': { colors: ['red'], regions: ['naoussa', 'sicilia', 'rhône'], grapes: ['Xinomavro', 'Nerello Mascalese', 'Grenache'] },
  'falafel': { colors: ['white', 'rose'], regions: ['santorini', 'loire', 'provence'], grapes: ['Assyrtiko', 'Chenin Blanc', 'Grenache'] },
  'lamm tagine': { colors: ['red'], regions: ['rhône', 'naoussa', 'alentejo'], grapes: ['Grenache', 'Xinomavro', 'Touriga Nacional'] },

  // ========================================================================
  // Charcuterie & Aperitivo
  // ========================================================================
  'charkuterier': { colors: ['red', 'white', 'sparkling'], regions: ['beaujolais', 'piemonte', 'cava', 'lambrusco'], grapes: ['Gamay', 'Barbera', 'Dolcetto', 'Lambrusco'] },
  'antipasti': { colors: ['white', 'red', 'sparkling'], regions: ['piemonte', 'sicilia', 'friuli', 'lambrusco'], grapes: ['Barbera', 'Nero d\'Avola', 'Friulano', 'Lambrusco'] },
  'prosciutto': { colors: ['red', 'sparkling'], regions: ['lambrusco', 'beaujolais', 'piemonte'], grapes: ['Lambrusco', 'Gamay', 'Dolcetto'] },
  'charkuteribricka': { colors: ['red', 'white', 'sparkling'], regions: ['beaujolais', 'piemonte', 'cava', 'lambrusco'], grapes: ['Gamay', 'Barbera', 'Dolcetto', 'Lambrusco'] },

  // ========================================================================
  // BBQ & Street food
  // ========================================================================
  'tacos': { colors: ['red', 'rose', 'white'], regions: ['valle de guadalupe', 'rioja', 'beaujolais'], grapes: ['Tempranillo', 'Grenache', 'Gamay'] },
  'burger': { colors: ['red'], regions: ['washington state', 'mendoza', 'barossa', 'alentejo'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Shiraz', 'Castelão'] },
  'bbq': { colors: ['red', 'rose'], regions: ['barossa', 'mendoza', 'alentejo', 'tavel'], grapes: ['Shiraz', 'Malbec', 'Touriga Nacional', 'Grenache'] },

  // ========================================================================
  // Dessert & Sweet
  // ========================================================================
  'dessert': { colors: ['white', 'fortified'], regions: ['sauternes', 'mosel', 'tokaj', 'douro'], grapes: ['Sémillon', 'Riesling', 'Furmint', 'Muscat'] },
  'crème brûlée': { colors: ['white', 'fortified'], regions: ['sauternes', 'alsace', 'tokaj'], grapes: ['Sémillon', 'Gewürztraminer', 'Furmint'] },
  'cheesecake': { colors: ['white', 'sparkling'], regions: ['mosel', 'asti', 'champagne'], grapes: ['Riesling', 'Muscat', 'Chardonnay'] },
  'tårta': { colors: ['sparkling', 'white'], regions: ['champagne', 'asti', 'sauternes'], grapes: ['Chardonnay', 'Muscat', 'Sémillon'] },
  'choklad': { colors: ['red', 'fortified'], regions: ['douro', 'banyuls', 'barossa'], grapes: ['Touriga Nacional', 'Grenache', 'Shiraz'] },
  'frukt': { colors: ['white', 'sparkling'], regions: ['mosel', 'asti', 'tokaj'], grapes: ['Riesling', 'Muscat', 'Furmint'] },
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
  'naturvin': { regions: ['loire', 'jura', 'beaujolais', 'sicilia', 'languedoc'], grapes: ['Gamay', 'Chenin Blanc', 'Grenache', 'Nerello Mascalese'], organic: true, biodynamic: false },
  'naturligt': { regions: ['loire', 'jura', 'beaujolais'], grapes: ['Gamay', 'Chenin Blanc'], organic: true, biodynamic: false },
  'elegant': { regions: ['bourgogne', 'piemonte', 'champagne', 'mosel', 'naoussa', 'alto adige'], grapes: ['Pinot Noir', 'Nebbiolo', 'Chardonnay', 'Riesling', 'Xinomavro', 'Pinot Bianco'], organic: false, biodynamic: false },
  'kraftig': { regions: ['barossa', 'napa valley', 'priorat', 'mendoza', 'alentejo'], grapes: ['Shiraz', 'Cabernet Sauvignon', 'Malbec', 'Grenache', 'Touriga Nacional'], organic: false, biodynamic: false },
  'fruktig': { regions: ['marlborough', 'chile', 'australia', 'sicilia', 'stellenbosch'], grapes: ['Sauvignon Blanc', 'Malbec', 'Shiraz', 'Chenin Blanc'], organic: false, biodynamic: false },
  'mineralisk': { regions: ['chablis', 'sancerre', 'mosel', 'santorini', 'txakoli', 'alto adige'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Assyrtiko', 'Pinot Bianco'], organic: false, biodynamic: false },
  'lätt': { regions: ['loire', 'beaujolais', 'alsace', 'vinho verde', 'txakoli'], grapes: ['Gamay', 'Pinot Noir', 'Riesling', 'Frappato', 'Zweigelt'], organic: false, biodynamic: false },
  'torr': { regions: ['chablis', 'sancerre', 'rueda', 'santorini'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Verdejo', 'Assyrtiko'], organic: false, biodynamic: false },
  'söt': { regions: ['sauternes', 'mosel', 'tokaj'], grapes: ['Sémillon', 'Riesling', 'Furmint'], organic: false, biodynamic: false },
  'biodynamisk': { regions: ['loire', 'alsace', 'bourgogne'], grapes: [], organic: true, biodynamic: true },
  'ekologisk': { regions: [], grapes: [], organic: true, biodynamic: false },
  // 2026 trends
  'fräsch': { regions: ['txakoli', 'vinho verde', 'clare valley', 'alto adige', 'beaujolais'], grapes: ['Grüner Veltliner', 'Riesling', 'Gamay', 'Frappato', 'Zweigelt'], organic: false, biodynamic: false },
  'autentisk': { regions: ['naoussa', 'dão', 'umbria', 'alto adige', 'txakoli'], grapes: ['Xinomavro', 'Touriga Nacional', 'Lagrein', 'Pinot Bianco', 'Nerello Mascalese'], organic: false, biodynamic: false },
  'heritage': { regions: ['naoussa', 'dão', 'lisboa', 'umbria', 'piemonte'], grapes: ['Xinomavro', 'Touriga Nacional', 'Castelão', 'Barbera', 'Dolcetto'], organic: false, biodynamic: false },
  'gastronomisk': { regions: ['tavel', 'bourgogne', 'piemonte', 'friuli', 'naoussa'], grapes: ['Grenache', 'Pinot Noir', 'Nebbiolo', 'Friulano', 'Xinomavro'], organic: false, biodynamic: false },
  'kylbar': { regions: ['beaujolais', 'sicilia', 'loire', 'niederösterreich'], grapes: ['Gamay', 'Frappato', 'Zweigelt', 'Nerello Mascalese'], organic: false, biodynamic: false },
};

// ============================================================================
// Lookup Functions
// ============================================================================

/** Find food pairing preferences from food keywords (checks runtime overrides first) */
export function lookupFoodPairing(foods: string[]): FoodWinePreference {
  const merged: FoodWinePreference = { colors: [], regions: [], grapes: [] };

  for (const food of foods) {
    const key = food.toLowerCase().trim();
    // Check runtime overrides (from DB) before static table
    const pref = RUNTIME_OVERRIDES[key] || FOOD_TO_WINE_STYLES[key];
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
