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
  'lammracks': { colors: ['red'], regions: ['bordeaux', 'rhône', 'rioja', 'barolo'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo'] },
  'lammstek': { colors: ['red'], regions: ['bordeaux', 'rhône', 'rioja', 'barolo'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo'] },
  'lammlägg': { colors: ['red'], regions: ['rhône', 'priorat', 'rioja'], grapes: ['Syrah', 'Grenache', 'Tempranillo'] },
  'nötkött': { colors: ['red'], regions: ['bordeaux', 'mendoza', 'barossa', 'dão', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Shiraz', 'Touriga Nacional'] },
  'biff': { colors: ['red'], regions: ['napa valley', 'bordeaux', 'ribera del duero', 'washington state'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Malbec'] },
  'vilt': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte', 'naoussa'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo', 'Xinomavro'] },
  'viltgryta': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo'] },
  'vildsvin': { colors: ['red'], regions: ['toscana', 'rhône', 'languedoc', 'umbria'], grapes: ['Sangiovese', 'Syrah', 'Grenache'] },
  'älg': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rhône', 'naoussa'], grapes: ['Pinot Noir', 'Nebbiolo', 'Syrah', 'Xinomavro'] },
  'hjort': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'priorat', 'dão'], grapes: ['Pinot Noir', 'Nebbiolo', 'Grenache', 'Touriga Nacional'] },
  'rådjur': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'beaujolais'], grapes: ['Pinot Noir', 'Nebbiolo', 'Gamay'] },
  'entrecote': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza', 'alentejo'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Touriga Nacional'] },
  'entrecôte': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza'], grapes: ['Cabernet Sauvignon', 'Malbec'] },
  'oxfilé': { colors: ['red'], regions: ['bordeaux', 'barolo', 'napa valley'], grapes: ['Cabernet Sauvignon', 'Nebbiolo', 'Merlot'] },
  'tartar': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'tartare': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'råbiff': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'carpaccio': { colors: ['red', 'rose'], regions: ['bourgogne', 'piemonte', 'loire'], grapes: ['Pinot Noir', 'Nebbiolo', 'Gamay'] },
  'köttbullar': { colors: ['red'], regions: ['toscana', 'languedoc', 'rioja'], grapes: ['Sangiovese', 'Grenache', 'Tempranillo'] },
  'gryta': { colors: ['red'], regions: ['rhône', 'languedoc', 'rioja'], grapes: ['Syrah', 'Grenache', 'Tempranillo'] },
  'grillat': { colors: ['red', 'rose'], regions: ['mendoza', 'barossa', 'alentejo', 'tavel'], grapes: ['Malbec', 'Shiraz', 'Touriga Nacional', 'Grenache'] },
  'pulled pork': { colors: ['red', 'rose'], regions: ['rhône', 'beaujolais', 'sicilia', 'alentejo'], grapes: ['Grenache', 'Gamay', 'Frappato', 'Castelão'] },
  'burger': { colors: ['red'], regions: ['washington state', 'mendoza', 'barossa', 'alentejo'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Shiraz', 'Castelão'] },
  'hamburgare': { colors: ['red'], regions: ['languedoc', 'mendoza', 'barossa'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },

  'steak': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Tempranillo'] },
  'pepparstek': { colors: ['red'], regions: ['bordeaux', 'rhône', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Tempranillo'] },
  'steak au poivre': { colors: ['red'], regions: ['bordeaux', 'rhône', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Tempranillo'] },
  'högrev': { colors: ['red'], regions: ['rhône', 'languedoc', 'mendoza', 'alentejo'], grapes: ['Syrah', 'Grenache', 'Malbec', 'Touriga Nacional'] },
  'flankstek': { colors: ['red'], regions: ['mendoza', 'barossa', 'ribera del duero'], grapes: ['Malbec', 'Shiraz', 'Tempranillo'] },
  'ryggbiff': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Merlot'] },
  'kotlett': { colors: ['red'], regions: ['bourgogne', 'beaujolais', 'rioja'], grapes: ['Pinot Noir', 'Gamay', 'Tempranillo'] },
  'rack': { colors: ['red'], regions: ['bordeaux', 'rioja', 'barolo'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Nebbiolo'] },
  'köttgryta': { colors: ['red'], regions: ['rhône', 'languedoc', 'rioja'], grapes: ['Syrah', 'Grenache', 'Tempranillo'] },

  // ========================================================================
  // White meats & poultry
  // ========================================================================
  'kyckling': { colors: ['white', 'red'], regions: ['bourgogne', 'loire', 'rioja', 'dão', 'friuli'], grapes: ['Chardonnay', 'Chenin Blanc', 'Pinot Noir', 'Friulano'] },
  'anka': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte', 'umbria'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo', 'Barbera'] },
  'ankbröst': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo'] },
  'anklever': { colors: ['white'], regions: ['alsace', 'sauternes', 'loire'], grapes: ['Gewürztraminer', 'Sémillon', 'Chenin Blanc'] },
  'foie gras': { colors: ['white'], regions: ['alsace', 'sauternes', 'loire'], grapes: ['Gewürztraminer', 'Sémillon', 'Chenin Blanc'] },
  'gås': { colors: ['red', 'white'], regions: ['alsace', 'bourgogne', 'loire'], grapes: ['Gewürztraminer', 'Pinot Noir', 'Chenin Blanc'] },
  'fläsk': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'loire', 'clare valley'], grapes: ['Riesling', 'Pinot Gris', 'Chenin Blanc'] },
  'fläskfilé': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Pinot Gris', 'Chenin Blanc'] },
  'kalv': { colors: ['white', 'red'], regions: ['bourgogne', 'piemonte', 'toscana', 'friuli'], grapes: ['Chardonnay', 'Nebbiolo', 'Sangiovese', 'Friulano'] },
  'kalvschnitzel': { colors: ['white', 'red'], regions: ['alsace', 'bourgogne', 'toscana'], grapes: ['Riesling', 'Chardonnay', 'Sangiovese'] },

  'kanin': { colors: ['red', 'white'], regions: ['bourgogne', 'loire', 'toscana'], grapes: ['Pinot Noir', 'Chenin Blanc', 'Sangiovese'] },
  'lever': { colors: ['red'], regions: ['bourgogne', 'beaujolais', 'piemonte'], grapes: ['Pinot Noir', 'Gamay', 'Barbera'] },

  // ========================================================================
  // Seafood
  // ========================================================================
  'fisk': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough', 'txakoli', 'vinho verde'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Albariño', 'Hondarrabi Zuri'] },
  'lax': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'oregon', 'clare valley'], grapes: ['Chardonnay', 'Pinot Gris', 'Pinot Noir', 'Riesling'] },
  'gravad lax': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'chablis'], grapes: ['Riesling', 'Chardonnay'] },
  'torsk': { colors: ['white'], regions: ['chablis', 'muscadet', 'vinho verde', 'txakoli'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'torskrygg': { colors: ['white'], regions: ['chablis', 'muscadet', 'bourgogne'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'piggvar': { colors: ['white'], regions: ['bourgogne', 'chablis', 'bordeaux'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Sémillon'] },
  'sjötunga': { colors: ['white'], regions: ['bourgogne', 'chablis', 'muscadet'], grapes: ['Chardonnay', 'Melon de Bourgogne'] },
  'abborre': { colors: ['white'], regions: ['chablis', 'loire', 'alsace'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Riesling'] },
  'gös': { colors: ['white'], regions: ['chablis', 'bourgogne', 'loire'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Chenin Blanc'] },
  'röding': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'provence'], grapes: ['Chardonnay', 'Pinot Gris'] },
  'hummer': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'chablis', 'friuli'], grapes: ['Chardonnay', 'Pinot Noir', 'Friulano'] },
  'skaldjur': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'rías baixas', 'txakoli'], grapes: ['Chardonnay', 'Albariño', 'Sauvignon Blanc', 'Hondarrabi Zuri'] },
  'räkor': { colors: ['white', 'rose'], regions: ['provence', 'chablis', 'rías baixas', 'txakoli'], grapes: ['Albariño', 'Chardonnay', 'Grenache'] },
  'musslor': { colors: ['white'], regions: ['muscadet', 'chablis', 'vinho verde', 'txakoli'], grapes: ['Melon de Bourgogne', 'Chardonnay', 'Hondarrabi Zuri'] },
  'ostron': { colors: ['white', 'sparkling'], regions: ['chablis', 'champagne', 'muscadet', 'txakoli'], grapes: ['Chardonnay', 'Melon de Bourgogne'] },
  'kräftor': { colors: ['white', 'sparkling'], regions: ['alsace', 'bourgogne', 'champagne'], grapes: ['Riesling', 'Chardonnay'] },
  'ceviche': { colors: ['white'], regions: ['txakoli', 'vinho verde', 'rías baixas', 'clare valley'], grapes: ['Albariño', 'Riesling', 'Hondarrabi Zuri'] },
  'tonfisk': { colors: ['red', 'rose', 'white'], regions: ['provence', 'tavel', 'sicilia', 'naoussa'], grapes: ['Grenache', 'Nerello Mascalese', 'Xinomavro'] },
  'havsöring': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'loire'], grapes: ['Chardonnay', 'Pinot Gris', 'Sauvignon Blanc'] },
  'skaldjursplatå': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'muscadet'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'calamari': { colors: ['white', 'sparkling'], regions: ['sicilia', 'champagne', 'vinho verde'], grapes: ['Grillo', 'Chardonnay', 'Albariño'] },
  'fish and chips': { colors: ['white', 'sparkling'], regions: ['muscadet', 'champagne', 'vinho verde'], grapes: ['Melon de Bourgogne', 'Chardonnay', 'Albariño'] },
  'löjrom': { colors: ['sparkling', 'white'], regions: ['champagne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Pinot Noir', 'Riesling'] },
  'kammusslor': { colors: ['white'], regions: ['bourgogne', 'champagne', 'chablis'], grapes: ['Chardonnay', 'Chenin Blanc', 'Viognier'] },
  'havskräfta': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'fiskgryta': { colors: ['white', 'rose'], regions: ['provence', 'chablis', 'rías baixas'], grapes: ['Grenache', 'Chardonnay', 'Albariño'] },
  'fisksoppa': { colors: ['white', 'rose'], regions: ['provence', 'cassis', 'chablis'], grapes: ['Marsanne', 'Chardonnay', 'Grenache'] },
  'skaldjursgryta': { colors: ['white'], regions: ['bourgogne', 'chablis', 'cassis'], grapes: ['Chardonnay', 'Marsanne', 'Roussanne'] },
  'grillad fisk': { colors: ['white', 'rose'], regions: ['provence', 'rías baixas', 'sicilia'], grapes: ['Vermentino', 'Albariño', 'Grenache'] },
  'grillad bläckfisk': { colors: ['white', 'rose'], regions: ['santorini', 'rías baixas', 'provence'], grapes: ['Assyrtiko', 'Albariño', 'Grenache'] },
  'bläckfisk': { colors: ['white', 'rose'], regions: ['santorini', 'rías baixas', 'provence'], grapes: ['Assyrtiko', 'Albariño', 'Grenache'] },

  'siklöja': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Riesling'] },
  'brax': { colors: ['white'], regions: ['chablis', 'muscadet', 'vinho verde'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },

  // ========================================================================
  // Vegetarian & pasta
  // ========================================================================
  'pasta': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'sicilia', 'umbria'], grapes: ['Sangiovese', 'Nebbiolo', 'Nero d\'Avola', 'Barbera'] },
  'pizza': { colors: ['red'], regions: ['toscana', 'sicilia', 'campania'], grapes: ['Sangiovese', 'Nero d\'Avola', 'Aglianico'] },
  'margherita': { colors: ['red'], regions: ['toscana', 'campania', 'sicilia'], grapes: ['Sangiovese', 'Aglianico', 'Nero d\'Avola'] },
  'calzone': { colors: ['red'], regions: ['toscana', 'campania', 'sicilia'], grapes: ['Sangiovese', 'Aglianico', 'Nero d\'Avola'] },
  'risotto': { colors: ['white', 'red'], regions: ['alto adige', 'piemonte', 'friuli', 'bourgogne'], grapes: ['Pinot Bianco', 'Nebbiolo', 'Friulano', 'Chardonnay'] },
  'svamp': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rioja', 'umbria'], grapes: ['Pinot Noir', 'Nebbiolo', 'Tempranillo', 'Barbera'] },
  'ost': { colors: ['red', 'white', 'fortified'], regions: ['bourgogne', 'douro', 'rioja', 'dão'], grapes: ['Pinot Noir', 'Chardonnay', 'Touriga Nacional'] },
  'chark': { colors: ['red', 'rose'], regions: ['beaujolais', 'loire', 'toscana'], grapes: ['Gamay', 'Cabernet Franc', 'Sangiovese'] },
  'charkuterier': { colors: ['red', 'white', 'sparkling'], regions: ['beaujolais', 'piemonte', 'cava', 'lambrusco'], grapes: ['Gamay', 'Barbera', 'Dolcetto', 'Lambrusco'] },
  'sallad': { colors: ['white', 'rose'], regions: ['provence', 'loire', 'rueda', 'vinho verde', 'txakoli'], grapes: ['Sauvignon Blanc', 'Verdejo', 'Grenache', 'Grüner Veltliner'] },
  'vegetariskt': { colors: ['white', 'red', 'orange'], regions: ['loire', 'friuli', 'alto adige', 'beaujolais'], grapes: ['Chenin Blanc', 'Friulano', 'Pinot Bianco', 'Gamay'] },
  'grönsaker': { colors: ['white', 'rose'], regions: ['loire', 'provence', 'alsace'], grapes: ['Sauvignon Blanc', 'Grenache', 'Riesling'] },
  'tryffel': { colors: ['red'], regions: ['piemonte', 'bourgogne', 'umbria'], grapes: ['Nebbiolo', 'Pinot Noir', 'Barbera'] },
  'hummus': { colors: ['white', 'rose', 'orange'], regions: ['santorini', 'loire', 'friuli'], grapes: ['Assyrtiko', 'Chenin Blanc', 'Friulano'] },
  'rotselleri': { colors: ['white', 'red'], regions: ['bourgogne', 'jura', 'loire'], grapes: ['Chardonnay', 'Savagnin', 'Chenin Blanc'] },
  'selleri': { colors: ['white'], regions: ['loire', 'alsace', 'bourgogne'], grapes: ['Chenin Blanc', 'Riesling', 'Chardonnay'] },
  'blomkål': { colors: ['white'], regions: ['bourgogne', 'alsace', 'loire'], grapes: ['Chardonnay', 'Riesling', 'Chenin Blanc'] },
  'broccoli': { colors: ['white'], regions: ['loire', 'alto adige', 'alsace'], grapes: ['Sauvignon Blanc', 'Pinot Bianco', 'Riesling'] },
  'aubergine': { colors: ['red', 'rose'], regions: ['sicilia', 'provence', 'toscana'], grapes: ['Nero d\'Avola', 'Grenache', 'Sangiovese'] },
  'pumpa': { colors: ['white', 'red'], regions: ['alsace', 'bourgogne', 'rhône'], grapes: ['Pinot Gris', 'Chardonnay', 'Viognier'] },
  'rödbeta': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'sötpotatis': { colors: ['white', 'red'], regions: ['alsace', 'rhône', 'languedoc'], grapes: ['Gewürztraminer', 'Viognier', 'Grenache'] },
  'halloumi': { colors: ['rose', 'white'], regions: ['provence', 'santorini', 'rías baixas'], grapes: ['Grenache', 'Assyrtiko', 'Albariño'] },
  'tofu': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'loire'], grapes: ['Riesling', 'Gamay', 'Chenin Blanc'] },
  'linser': { colors: ['red', 'white'], regions: ['rhône', 'languedoc', 'loire'], grapes: ['Syrah', 'Grenache', 'Chenin Blanc'] },
  'bönor': { colors: ['red', 'white'], regions: ['toscana', 'languedoc', 'rioja'], grapes: ['Sangiovese', 'Grenache', 'Tempranillo'] },
  'avokado': { colors: ['white', 'rose'], regions: ['loire', 'marlborough', 'vinho verde'], grapes: ['Sauvignon Blanc', 'Grüner Veltliner', 'Albariño'] },
  'kronärtskocka': { colors: ['white', 'rose'], regions: ['provence', 'sardinia', 'sicilia'], grapes: ['Vermentino', 'Grenache', 'Grillo'] },
  'svartrot': { colors: ['white'], regions: ['bourgogne', 'alsace', 'loire'], grapes: ['Chardonnay', 'Riesling', 'Chenin Blanc'] },
  'jordärtskocka': { colors: ['white'], regions: ['bourgogne', 'jura', 'alsace'], grapes: ['Chardonnay', 'Savagnin', 'Riesling'] },
  'poke': { colors: ['white', 'rose'], regions: ['txakoli', 'marlborough', 'provence'], grapes: ['Sauvignon Blanc', 'Albariño', 'Grenache'] },
  'bowl': { colors: ['white', 'rose'], regions: ['loire', 'provence', 'marlborough'], grapes: ['Sauvignon Blanc', 'Grenache', 'Chenin Blanc'] },

  // ========================================================================
  // Asian & fusion
  // ========================================================================
  'sushi': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'marlborough', 'txakoli'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner'] },
  'sashimi': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Riesling', 'Grüner Veltliner'] },
  'thai': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough', 'clare valley'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'pad thai': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'indisk': { colors: ['white'], regions: ['alsace', 'mosel', 'stellenbosch'], grapes: ['Riesling', 'Gewürztraminer', 'Chenin Blanc'] },
  'curry': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'koreanskt': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'mosel'], grapes: ['Riesling', 'Gamay', 'Gewürztraminer'] },
  'koreansk': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'languedoc'], grapes: ['Riesling', 'Gamay', 'Grenache'] },
  'korean bbq': { colors: ['red', 'white'], regions: ['beaujolais', 'alsace', 'languedoc'], grapes: ['Gamay', 'Riesling', 'Grenache'] },
  'kimchi': { colors: ['white', 'sparkling', 'orange'], regions: ['alsace', 'jura', 'friuli'], grapes: ['Riesling', 'Savagnin', 'Friulano'] },
  'dim sum': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'txakoli'], grapes: ['Riesling', 'Chardonnay', 'Grüner Veltliner'] },
  'ramen': { colors: ['white', 'red'], regions: ['beaujolais', 'alsace', 'mosel'], grapes: ['Gamay', 'Riesling', 'Pinot Gris'] },
  'pho': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Gewürztraminer', 'Chenin Blanc'] },
  'bao buns': { colors: ['sparkling', 'white'], regions: ['champagne', 'alsace', 'mosel'], grapes: ['Chardonnay', 'Riesling', 'Pinot Noir'] },
  'gyoza': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'marlborough'], grapes: ['Riesling', 'Chardonnay', 'Sauvignon Blanc'] },
  'dumplings': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'mosel'], grapes: ['Riesling', 'Chardonnay', 'Pinot Gris'] },
  'tempura': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'chablis'], grapes: ['Chardonnay', 'Riesling', 'Sauvignon Blanc'] },
  'yakitori': { colors: ['white', 'red'], regions: ['beaujolais', 'alsace', 'loire'], grapes: ['Gamay', 'Riesling', 'Chenin Blanc'] },
  'vietnamesiskt': { colors: ['white'], regions: ['alsace', 'loire', 'vinho verde'], grapes: ['Riesling', 'Chenin Blanc', 'Grüner Veltliner'] },
  'wok': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'clare valley'], grapes: ['Riesling', 'Gamay', 'Grüner Veltliner'] },
  'tikka masala': { colors: ['white'], regions: ['alsace', 'mosel', 'stellenbosch'], grapes: ['Gewürztraminer', 'Riesling', 'Chenin Blanc'] },
  'butter chicken': { colors: ['white'], regions: ['alsace', 'mosel', 'stellenbosch'], grapes: ['Gewürztraminer', 'Riesling', 'Chenin Blanc'] },
  'biryani': { colors: ['white'], regions: ['alsace', 'mosel', 'clare valley'], grapes: ['Riesling', 'Gewürztraminer', 'Grüner Veltliner'] },
  'naan': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'tandoori': { colors: ['white', 'rose'], regions: ['alsace', 'provence', 'mosel'], grapes: ['Gewürztraminer', 'Grenache', 'Riesling'] },
  'katsu': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'bourgogne'], grapes: ['Riesling', 'Gamay', 'Pinot Noir'] },
  'teriyaki': { colors: ['red', 'white'], regions: ['beaujolais', 'alsace', 'oregon'], grapes: ['Gamay', 'Riesling', 'Pinot Noir'] },
  'bibimbap': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'mosel'], grapes: ['Riesling', 'Gamay', 'Gewürztraminer'] },
  'udon': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Chenin Blanc', 'Grüner Veltliner'] },
  'miso': { colors: ['white'], regions: ['alsace', 'jura', 'mosel'], grapes: ['Riesling', 'Savagnin', 'Grüner Veltliner'] },
  'spring rolls': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'vinho verde'], grapes: ['Riesling', 'Chardonnay', 'Albariño'] },
  'vårrullar': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'vinho verde'], grapes: ['Riesling', 'Chardonnay', 'Albariño'] },
  'satay': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'pekinganka': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo'] },

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
  // Italian
  // ========================================================================
  'vitello tonnato': { colors: ['white', 'rose'], regions: ['piemonte', 'soave', 'provence'], grapes: ['Verdicchio', 'Vermentino', 'Garganega'] },
  'burrata': { colors: ['white', 'rose', 'sparkling'], regions: ['puglia', 'campania', 'provence'], grapes: ['Fiano', 'Chardonnay', 'Ribolla Gialla'] },
  'osso buco': { colors: ['red'], regions: ['piemonte', 'toscana', 'lombardia'], grapes: ['Nebbiolo', 'Sangiovese', 'Barbera'] },
  'saltimbocca': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'bourgogne'], grapes: ['Sangiovese', 'Nebbiolo', 'Chardonnay'] },
  'bruschetta': { colors: ['white', 'rose', 'red'], regions: ['toscana', 'campania', 'sicilia'], grapes: ['Vermentino', 'Sangiovese', 'Nero d\'Avola'] },
  'antipasti': { colors: ['white', 'red', 'sparkling'], regions: ['piemonte', 'sicilia', 'friuli', 'lambrusco'], grapes: ['Barbera', 'Nero d\'Avola', 'Friulano', 'Lambrusco'] },
  'arancini': { colors: ['white', 'red'], regions: ['sicilia', 'campania', 'toscana'], grapes: ['Nero d\'Avola', 'Grillo', 'Sangiovese'] },
  'porchetta': { colors: ['red', 'white'], regions: ['toscana', 'umbria', 'piemonte'], grapes: ['Sangiovese', 'Sagrantino', 'Barbera'] },
  'tagliata': { colors: ['red'], regions: ['toscana', 'piemonte', 'bordeaux'], grapes: ['Sangiovese', 'Nebbiolo', 'Cabernet Sauvignon'] },
  'carbonara': { colors: ['white', 'red'], regions: ['lazio', 'campania', 'toscana'], grapes: ['Frascati', 'Fiano', 'Sangiovese'] },
  'vongole': { colors: ['white'], regions: ['campania', 'sicilia', 'liguria'], grapes: ['Falanghina', 'Vermentino', 'Grillo'] },
  'bolognese': { colors: ['red'], regions: ['toscana', 'emilia-romagna', 'sicilia'], grapes: ['Sangiovese', 'Lambrusco', 'Nero d\'Avola'] },
  'lasagne': { colors: ['red'], regions: ['toscana', 'emilia-romagna', 'piemonte'], grapes: ['Sangiovese', 'Barbera', 'Nebbiolo'] },
  'gnocchi': { colors: ['white', 'red'], regions: ['piemonte', 'toscana', 'veneto'], grapes: ['Barbera', 'Sangiovese', 'Garganega'] },
  'focaccia': { colors: ['white', 'rose'], regions: ['liguria', 'provence', 'toscana'], grapes: ['Vermentino', 'Grenache', 'Sangiovese'] },
  'minestrone': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'sicilia'], grapes: ['Sangiovese', 'Barbera', 'Vermentino'] },

  // ========================================================================
  // French
  // ========================================================================
  'bouillabaisse': { colors: ['rose', 'white'], regions: ['provence', 'bandol', 'cassis'], grapes: ['Grenache', 'Clairette', 'Marsanne'] },
  'coq au vin': { colors: ['red'], regions: ['bourgogne', 'beaujolais', 'rhône'], grapes: ['Pinot Noir', 'Gamay', 'Syrah'] },
  'confit': { colors: ['red'], regions: ['sud-ouest', 'cahors', 'madiran'], grapes: ['Malbec', 'Tannat', 'Cabernet Franc'] },
  'ankconfit': { colors: ['red'], regions: ['sud-ouest', 'cahors', 'bourgogne'], grapes: ['Malbec', 'Tannat', 'Pinot Noir'] },
  'cassoulet': { colors: ['red'], regions: ['madiran', 'cahors', 'languedoc'], grapes: ['Tannat', 'Malbec', 'Syrah'] },
  'escargot': { colors: ['white'], regions: ['bourgogne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Aligoté', 'Riesling'] },
  'steak frites': { colors: ['red'], regions: ['bordeaux', 'saint-émilion', 'languedoc'], grapes: ['Merlot', 'Cabernet Sauvignon', 'Syrah'] },
  'moules frites': { colors: ['white'], regions: ['muscadet', 'alsace', 'loire'], grapes: ['Melon de Bourgogne', 'Riesling', 'Sauvignon Blanc'] },
  'boeuf bourguignon': { colors: ['red'], regions: ['bourgogne', 'rhône', 'languedoc'], grapes: ['Pinot Noir', 'Syrah', 'Grenache'] },
  'ratatouille': { colors: ['rose', 'red'], regions: ['provence', 'languedoc', 'rhône'], grapes: ['Grenache', 'Syrah', 'Cinsault'] },
  'niçoise': { colors: ['rose', 'white'], regions: ['provence', 'bandol', 'loire'], grapes: ['Grenache', 'Cinsault', 'Sauvignon Blanc'] },
  'gratin': { colors: ['white', 'red'], regions: ['bourgogne', 'rhône', 'alsace'], grapes: ['Chardonnay', 'Grenache', 'Riesling'] },
  'béarnaise': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Cabernet Sauvignon', 'Pinot Noir', 'Syrah'] },
  'quiche': { colors: ['white', 'rose'], regions: ['alsace', 'loire', 'bourgogne'], grapes: ['Pinot Gris', 'Sauvignon Blanc', 'Chardonnay'] },

  // ========================================================================
  // Spanish & tapas
  // ========================================================================
  'paella': { colors: ['white', 'rose'], regions: ['valencia', 'rías baixas', 'penedès'], grapes: ['Albariño', 'Verdejo', 'Grenache'] },
  'patatas bravas': { colors: ['red', 'rose'], regions: ['rioja', 'navarra', 'priorat'], grapes: ['Tempranillo', 'Grenache', 'Monastrell'] },
  'jamón': { colors: ['red', 'fortified'], regions: ['rioja', 'jerez', 'ribera del duero'], grapes: ['Tempranillo', 'Palomino', 'Grenache'] },
  'gambas al ajillo': { colors: ['white'], regions: ['rías baixas', 'rueda', 'penedès'], grapes: ['Albariño', 'Verdejo', 'Xarel·lo'] },
  'tortilla española': { colors: ['white', 'rose'], regions: ['rueda', 'rías baixas', 'navarra'], grapes: ['Verdejo', 'Albariño', 'Grenache'] },
  'manchego': { colors: ['red', 'white'], regions: ['rioja', 'rueda', 'la mancha'], grapes: ['Tempranillo', 'Verdejo', 'Garnacha'] },

  // ========================================================================
  // Charcuterie & Aperitivo
  // ========================================================================
  'prosciutto': { colors: ['red', 'sparkling'], regions: ['lambrusco', 'beaujolais', 'piemonte'], grapes: ['Lambrusco', 'Gamay', 'Dolcetto'] },
  'charkuteribricka': { colors: ['red', 'white', 'sparkling'], regions: ['beaujolais', 'piemonte', 'cava', 'lambrusco'], grapes: ['Gamay', 'Barbera', 'Dolcetto', 'Lambrusco'] },

  // ========================================================================
  // Street food, modern & global
  // ========================================================================
  'kebab': { colors: ['red', 'rose'], regions: ['rhône', 'languedoc', 'naoussa'], grapes: ['Syrah', 'Grenache', 'Xinomavro'] },
  'shawarma': { colors: ['red', 'rose'], regions: ['rhône', 'languedoc', 'naoussa'], grapes: ['Syrah', 'Grenache', 'Xinomavro'] },
  'wrap': { colors: ['white', 'rose'], regions: ['provence', 'loire', 'marlborough'], grapes: ['Sauvignon Blanc', 'Grenache', 'Chenin Blanc'] },
  'nachos': { colors: ['red', 'rose'], regions: ['rioja', 'beaujolais', 'mendoza'], grapes: ['Tempranillo', 'Gamay', 'Malbec'] },
  'quesadilla': { colors: ['red', 'rose', 'white'], regions: ['rioja', 'beaujolais', 'rueda'], grapes: ['Tempranillo', 'Gamay', 'Verdejo'] },
  'sandwich': { colors: ['white', 'red', 'rose'], regions: ['beaujolais', 'loire', 'provence'], grapes: ['Gamay', 'Sauvignon Blanc', 'Grenache'] },
  'caesar': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'caesarsallad': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'croque monsieur': { colors: ['white', 'red'], regions: ['bourgogne', 'beaujolais', 'alsace'], grapes: ['Chardonnay', 'Gamay', 'Riesling'] },
  'eggs benedict': { colors: ['sparkling', 'white'], regions: ['champagne', 'bourgogne', 'alsace'], grapes: ['Chardonnay', 'Pinot Noir', 'Riesling'] },
  'pannkakor': { colors: ['sparkling', 'white'], regions: ['champagne', 'alsace', 'mosel'], grapes: ['Chardonnay', 'Riesling'] },
  'pancakes': { colors: ['sparkling', 'white'], regions: ['champagne', 'asti', 'mosel'], grapes: ['Chardonnay', 'Muscat', 'Riesling'] },
  'tacos': { colors: ['red', 'rose', 'white'], regions: ['valle de guadalupe', 'rioja', 'beaujolais'], grapes: ['Tempranillo', 'Grenache', 'Gamay'] },
  'bbq': { colors: ['red', 'rose'], regions: ['barossa', 'mendoza', 'alentejo', 'tavel'], grapes: ['Shiraz', 'Malbec', 'Touriga Nacional', 'Grenache'] },
  'revbensspjäll': { colors: ['red'], regions: ['mendoza', 'barossa', 'languedoc'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },
  'spareribs': { colors: ['red'], regions: ['mendoza', 'barossa', 'languedoc'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },
  'brisket': { colors: ['red'], regions: ['barossa', 'mendoza', 'rhône'], grapes: ['Shiraz', 'Malbec', 'Syrah'] },

  // ========================================================================
  // Soppor
  // ========================================================================
  'soppa': { colors: ['white', 'red'], regions: ['loire', 'beaujolais', 'dão', 'vinho verde'], grapes: ['Chenin Blanc', 'Gamay', 'Touriga Nacional'] },
  'svampsoppa': { colors: ['white', 'red'], regions: ['bourgogne', 'jura', 'alsace'], grapes: ['Chardonnay', 'Savagnin', 'Pinot Noir'] },
  'hummersoppa': { colors: ['white'], regions: ['bourgogne', 'champagne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'löksoppa': { colors: ['white', 'red'], regions: ['bourgogne', 'jura', 'alsace'], grapes: ['Chardonnay', 'Savagnin', 'Riesling'] },
  'tomatsoppa': { colors: ['rose', 'red'], regions: ['provence', 'toscana', 'rioja'], grapes: ['Grenache', 'Sangiovese', 'Tempranillo'] },
  'sparrissoppa': { colors: ['white'], regions: ['alsace', 'loire', 'bourgogne'], grapes: ['Sauvignon Blanc', 'Riesling', 'Chardonnay'] },

  // ========================================================================
  // Förrätter & ostar
  // ========================================================================
  'crostini': { colors: ['white', 'rose', 'red'], regions: ['toscana', 'provence', 'sicilia'], grapes: ['Vermentino', 'Sangiovese', 'Grenache'] },
  'getost': { colors: ['white'], regions: ['sancerre', 'loire', 'languedoc'], grapes: ['Sauvignon Blanc', 'Chenin Blanc', 'Viognier'] },
  'chèvre': { colors: ['white'], regions: ['sancerre', 'loire', 'languedoc'], grapes: ['Sauvignon Blanc', 'Chenin Blanc', 'Viognier'] },
  'lagrad ost': { colors: ['red', 'fortified'], regions: ['rioja', 'douro', 'bourgogne'], grapes: ['Tempranillo', 'Touriga Nacional', 'Pinot Noir'] },
  'ostbricka': { colors: ['red', 'white', 'fortified'], regions: ['bourgogne', 'douro', 'rioja'], grapes: ['Pinot Noir', 'Chardonnay', 'Touriga Nacional'] },
  'sparris': { colors: ['white'], regions: ['alsace', 'loire', 'niederösterreich'], grapes: ['Sauvignon Blanc', 'Riesling', 'Grüner Veltliner'] },

  // ========================================================================
  // Svenska klassiker
  // ========================================================================
  'köttfärssås': { colors: ['red'], regions: ['toscana', 'languedoc', 'rioja'], grapes: ['Sangiovese', 'Grenache', 'Tempranillo'] },
  'husmanskost': { colors: ['red', 'white'], regions: ['bourgogne', 'languedoc', 'rioja'], grapes: ['Pinot Noir', 'Grenache', 'Tempranillo'] },
  'julbord': { colors: ['red', 'white', 'sparkling'], regions: ['alsace', 'bourgogne', 'champagne'], grapes: ['Riesling', 'Pinot Noir', 'Chardonnay'] },
  'sill': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'chablis'], grapes: ['Riesling', 'Chardonnay'] },
  'toast skagen': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'sancerre'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'wallenbergare': { colors: ['white', 'red'], regions: ['bourgogne', 'loire', 'alsace'], grapes: ['Chardonnay', 'Chenin Blanc', 'Riesling'] },
  'pytt i panna': { colors: ['red', 'white'], regions: ['beaujolais', 'languedoc', 'alsace'], grapes: ['Gamay', 'Grenache', 'Riesling'] },
  'isterband': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'loire'], grapes: ['Riesling', 'Gamay', 'Cabernet Franc'] },
  'strömming': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'muscadet'], grapes: ['Riesling', 'Chardonnay', 'Melon de Bourgogne'] },
  'raggmunk': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'bourgogne'], grapes: ['Riesling', 'Gamay', 'Pinot Noir'] },
  'ärtsoppa': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'loire'], grapes: ['Riesling', 'Gamay', 'Chenin Blanc'] },
  'kroppkakor': { colors: ['white', 'red'], regions: ['alsace', 'bourgogne', 'beaujolais'], grapes: ['Riesling', 'Pinot Noir', 'Gamay'] },
  'smörgåsbord': { colors: ['white', 'sparkling', 'rose'], regions: ['alsace', 'champagne', 'provence'], grapes: ['Riesling', 'Chardonnay', 'Pinot Noir'] },
  'janssons frestelse': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'alsace'], grapes: ['Chardonnay', 'Riesling'] },
  'blodpudding': { colors: ['red'], regions: ['beaujolais', 'languedoc', 'rhône'], grapes: ['Gamay', 'Grenache', 'Syrah'] },
  'palt': { colors: ['red', 'white'], regions: ['bourgogne', 'alsace', 'beaujolais'], grapes: ['Pinot Noir', 'Riesling', 'Gamay'] },
  'renstek': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rhône'], grapes: ['Pinot Noir', 'Nebbiolo', 'Syrah'] },
  'renskav': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'beaujolais'], grapes: ['Pinot Noir', 'Nebbiolo', 'Gamay'] },
  'renkött': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rhône'], grapes: ['Pinot Noir', 'Nebbiolo', 'Syrah'] },
  'dillkött': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'bourgogne'], grapes: ['Riesling', 'Gamay', 'Pinot Noir'] },
  'kalops': { colors: ['red'], regions: ['bourgogne', 'beaujolais', 'languedoc'], grapes: ['Pinot Noir', 'Gamay', 'Grenache'] },
  'pannbiff': { colors: ['red'], regions: ['languedoc', 'beaujolais', 'rioja'], grapes: ['Grenache', 'Gamay', 'Tempranillo'] },
  'oxrulad': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo'] },
  'sjömansbiff': { colors: ['red'], regions: ['beaujolais', 'languedoc', 'rioja'], grapes: ['Gamay', 'Grenache', 'Tempranillo'] },
  'inlagd sill': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'chablis'], grapes: ['Riesling', 'Chardonnay'] },
  'matjesill': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'muscadet'], grapes: ['Riesling', 'Chardonnay', 'Melon de Bourgogne'] },

  // ========================================================================
  // Kött & bistro
  // ========================================================================
  'schnitzel': { colors: ['white', 'red'], regions: ['alsace', 'niederösterreich', 'bourgogne'], grapes: ['Riesling', 'Grüner Veltliner', 'Pinot Noir'] },
  'planka': { colors: ['red'], regions: ['bordeaux', 'rioja', 'toscana'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Sangiovese'] },
  'oxbringa': { colors: ['red'], regions: ['rhône', 'languedoc', 'mendoza'], grapes: ['Syrah', 'Grenache', 'Malbec'] },
  'oxsvans': { colors: ['red'], regions: ['rhône', 'ribera del duero', 'barossa'], grapes: ['Syrah', 'Tempranillo', 'Shiraz'] },
  'fläskkarré': { colors: ['red', 'white'], regions: ['bourgogne', 'alsace', 'beaujolais'], grapes: ['Pinot Noir', 'Riesling', 'Gamay'] },
  'fläskkotlett': { colors: ['red', 'white'], regions: ['bourgogne', 'alsace', 'beaujolais'], grapes: ['Pinot Noir', 'Riesling', 'Gamay'] },
  'korv': { colors: ['red', 'white', 'rose'], regions: ['beaujolais', 'alsace', 'languedoc'], grapes: ['Gamay', 'Riesling', 'Grenache'] },

  // ========================================================================
  // Dessert & Sweet
  // ========================================================================
  'dessert': { colors: ['white', 'fortified'], regions: ['sauternes', 'mosel', 'tokaj', 'douro'], grapes: ['Sémillon', 'Riesling', 'Furmint', 'Muscat'] },
  'crème brûlée': { colors: ['white', 'fortified'], regions: ['sauternes', 'alsace', 'tokaj'], grapes: ['Sémillon', 'Gewürztraminer', 'Furmint'] },
  'cheesecake': { colors: ['white', 'sparkling'], regions: ['mosel', 'asti', 'champagne'], grapes: ['Riesling', 'Muscat', 'Chardonnay'] },
  'tårta': { colors: ['sparkling', 'white'], regions: ['champagne', 'asti', 'sauternes'], grapes: ['Chardonnay', 'Muscat', 'Sémillon'] },
  'choklad': { colors: ['red', 'fortified'], regions: ['douro', 'banyuls', 'barossa'], grapes: ['Touriga Nacional', 'Grenache', 'Shiraz'] },
  'frukt': { colors: ['white', 'sparkling'], regions: ['mosel', 'asti', 'tokaj'], grapes: ['Riesling', 'Muscat', 'Furmint'] },
  'kladdkaka': { colors: ['red', 'fortified'], regions: ['douro', 'banyuls', 'maury'], grapes: ['Touriga Nacional', 'Grenache', 'Muscat'] },
  'äppelkaka': { colors: ['white'], regions: ['alsace', 'loire', 'mosel'], grapes: ['Riesling', 'Chenin Blanc', 'Gewürztraminer'] },
  'affogato': { colors: ['fortified'], regions: ['jerez', 'douro', 'sicilia'], grapes: ['Pedro Ximénez', 'Touriga Nacional', 'Muscat'] },
  'sorbet': { colors: ['sparkling', 'white'], regions: ['champagne', 'mosel', 'piemonte'], grapes: ['Chardonnay', 'Riesling', 'Moscato'] },
  'panna cotta': { colors: ['white', 'sparkling'], regions: ['piemonte', 'veneto', 'mosel'], grapes: ['Moscato', 'Riesling', 'Muscat'] },
  'tiramisu': { colors: ['fortified'], regions: ['toscana', 'veneto', 'sicilia'], grapes: ['Vin Santo', 'Muscat', 'Nero d\'Avola'] },

  // ==========================================================================
  // AUTO-GENERATED — AI sommelier pairings (168 dishes)
  // Generated: 2026-02-22
  // ==========================================================================
  'pitepalt': { colors: ['white'], regions: ['alsace', 'chablis'], grapes: ['Pinot Gris', 'Chardonnay'] },
  'rotmos': { colors: ['white'], regions: ['bourgogne', 'loire'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'bruna bönor': { colors: ['red'], regions: ['rioja', 'priorat'], grapes: ['Tempranillo', 'Grenache'] },
  'falukorv': { colors: ['red'], regions: ['rhône', 'beaujolais'], grapes: ['Syrah', 'Gamay'] },
  'prinskorv': { colors: ['red'], regions: ['chianti', 'montepulciano'], grapes: ['Sangiovese'] },
  'sylta': { colors: ['red'], regions: ['bourgogne', 'chianti'], grapes: ['Pinot Noir', 'Sangiovese'] },
  'lutfisk': { colors: ['white'], regions: ['loire', 'alsace'], grapes: ['Chenin Blanc', 'Riesling'] },
  'laxpudding': { colors: ['white'], regions: ['chablis', 'sancerre'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'räksmörgås': { colors: ['white'], regions: ['chablis', 'sancerre'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'skagenröra': { colors: ['white'], regions: ['chablis', 'sancerre'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'krabba': { colors: ['white'], regions: ['chablis', 'sancerre'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'älgstek': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Cabernet Sauvignon', 'Merlot', 'Syrah', 'Pinot Noir'] },
  'viltfärslimpa': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Cabernet Sauvignon', 'Merlot', 'Syrah', 'Pinot Noir'] },
  'hjortfilé': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Cabernet Sauvignon', 'Merlot', 'Syrah', 'Pinot Noir'] },
  'fasan': { colors: ['red'], regions: ['bourgogne', 'rhône'], grapes: ['Pinot Noir', 'Syrah'] },
  'rapphöna': { colors: ['red'], regions: ['bourgogne', 'rhône'], grapes: ['Pinot Noir', 'Syrah'] },
  'tjäder': { colors: ['red'], regions: ['bourgogne', 'rhône'], grapes: ['Pinot Noir', 'Syrah'] },
  'korv stroganoff': { colors: ['red'], regions: ['bordeaux', 'rioja'], grapes: ['Merlot', 'Tempranillo'] },
  'antipasto': { colors: ['white', 'rose'], regions: ['toscana', 'lazio', 'provence'], grapes: ['Sangiovese', 'Vermentino'] },
  'ravioli': { colors: ['white'], regions: ['emilia-romagna', 'lombardia'], grapes: ['Pignoletto', 'Lugana'] },
  'tortellini': { colors: ['white'], regions: ['emilia-romagna', 'lombardia'], grapes: ['Pignoletto', 'Lugana'] },
  'pappardelle': { colors: ['red'], regions: ['toscana', 'umbria'], grapes: ['Sangiovese', 'Montepulciano'] },
  'tagliatelle': { colors: ['white'], regions: ['emilia-romagna', 'marche'], grapes: ['Albana', 'Verdicchio'] },
  'caprese': { colors: ['white', 'rose'], regions: ['campania', 'sicilia'], grapes: ['Falanghina', 'Catarratto'] },
  'ribollita': { colors: ['red'], regions: ['toscana'], grapes: ['Sangiovese'] },
  'piccata': { colors: ['white'], regions: ['toscana', 'piemonte', 'sicilien'], grapes: ['Verdicchio', 'Arneis', 'Grillo'] },
  'parmigiana': { colors: ['white', 'red'], regions: ['toscana', 'sicilien', 'piemonte'], grapes: ['Sangiovese', 'Nero d\'Avola', 'Barbera'] },
  'cacciatore': { colors: ['red'], regions: ['toscana', 'piemonte', 'umbrien'], grapes: ['Chianti', 'Barolo', 'Montepulciano'] },
  'arrabiata': { colors: ['red'], regions: ['toscana', 'abruzzo', 'sicilien'], grapes: ['Sangiovese', 'Montepulciano', 'Nero d\'Avola'] },
  'puttanesca': { colors: ['white', 'red'], regions: ['toscana', 'sicilien', 'kampanien'], grapes: ['Fiano', 'Aglianico', 'Primitivo'] },
  'amatriciana': { colors: ['white', 'red'], regions: ['lazio', 'umbrien', 'abruzzo'], grapes: ['Verdicchio', 'Sangiovese', 'Montepulciano'] },
  'cacio e pepe': { colors: ['white', 'red'], regions: ['lazio', 'umbrien', 'abruzzo'], grapes: ['Frascati', 'Montepulciano', 'Sangiovese'] },
  'aglio olio': { colors: ['white'], regions: ['lazio', 'umbrien', 'abruzzo'], grapes: ['Pecorino', 'Verdicchio', 'Passerina'] },
  'primavera': { colors: ['white'], regions: ['lazio', 'toscana', 'abruzzo'], grapes: ['Pecorino', 'Verdicchio', 'Passerina'] },
  'frutti di mare': { colors: ['white', 'sparkling'], regions: ['ligurien', 'toscana', 'sicilien'], grapes: ['Vermentino', 'Albariño', 'Arneis'] },
  'confit de canard': { colors: ['red'], regions: ['southwest france', 'bordeaux', 'rhône'], grapes: ['Malbec', 'Cabernet Sauvignon', 'Syrah'] },
  'magret de canard': { colors: ['red'], regions: ['southwest france', 'bordeaux', 'rhône'], grapes: ['Malbec', 'Cabernet Sauvignon', 'Syrah'] },
  'quiche lorraine': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'loire'], grapes: ['Chardonnay', 'Pinot Blanc', 'Chenin Blanc'] },
  'oignon': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Cabernet Sauvignon', 'Merlot', 'Syrah'] },
  'blanquette de veau': { colors: ['white'], regions: ['bourgogne', 'alsace', 'chablis'], grapes: ['Chardonnay', 'Pinot Blanc', 'Riesling'] },
  'pot-au-feu': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Merlot', 'Cabernet Sauvignon', 'Syrah'] },
  'navarin': { colors: ['red'], regions: ['bordeaux', 'bourgogne', 'rhône'], grapes: ['Merlot', 'Cabernet Sauvignon', 'Syrah'] },
  'tarte tatin': { colors: ['white', 'sparkling'], regions: ['loire', 'champagne', 'alsace'], grapes: ['Chenin Blanc', 'Riesling', 'Chardonnay'] },
  'gratin dauphinois': { colors: ['white', 'red'], regions: ['bourgogne', 'rhône'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'salade niçoise': { colors: ['white', 'rose'], regions: ['provence', 'languedoc'], grapes: ['Grenache', 'Rolle'] },
  'hollandaise': { colors: ['white'], regions: ['alsace', 'champagne'], grapes: ['Riesling', 'Chardonnay'] },
  'gazpacho': { colors: ['white', 'rose'], regions: ['andalucia', 'extremadura'], grapes: ['Airén', 'Palomino'] },
  'jamón ibérico': { colors: ['red'], regions: ['rioja', 'extremadura'], grapes: ['Tempranillo', 'Cabernet Sauvignon'] },
  'chorizo': { colors: ['red'], regions: ['rioja', 'extremadura'], grapes: ['Tempranillo', 'Garnacha'] },
  'pulpo a la gallega': { colors: ['white'], regions: ['rías baixas', 'vinho verde'], grapes: ['Albariño', 'Loureiro'] },
  'pimientos de padrón': { colors: ['white', 'rose'], regions: ['galicia', 'vinho verde'], grapes: ['Albariño', 'Loureiro'] },
  'croquetas': { colors: ['white', 'red'], regions: ['rioja', 'navarra'], grapes: ['Tempranillo', 'Garnacha'] },
  'albondigas': { colors: ['red'], regions: ['rioja', 'navarra'], grapes: ['Tempranillo', 'Garnacha'] },
  'souvlaki': { colors: ['white', 'rose'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Agiorgitiko'] },
  'gyros': { colors: ['white', 'rose'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Agiorgitiko'] },
  'tzatziki': { colors: ['white'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Malagousia'] },
  'spanakopita': { colors: ['white'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Malagousia'] },
  'dolma': { colors: ['white'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Malagousia'] },
  'kleftiko': { colors: ['red'], regions: ['naoussa', 'peloponnese'], grapes: ['Xinomavro', 'Agiorgitiko'] },
  'pastitsio': { colors: ['red'], regions: ['naoussa', 'peloponnese'], grapes: ['Xinomavro', 'Agiorgitiko'] },
  'saganaki': { colors: ['white'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Malagousia'] },
  'horiatiki': { colors: ['white', 'rose'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Agiorgitiko'] },
  'baba ganoush': { colors: ['white'], regions: ['naoussa', 'peloponnese'], grapes: ['Assyrtiko', 'Malagousia'] },
  'shakshuka': { colors: ['red'], regions: ['rhône'], grapes: ['Syrah', 'Grenache', 'Carignan', 'Mourvèdre'] },
  'fattoush': { colors: ['white'], regions: ['rhône'], grapes: ['Sauvignon Blanc', 'Chardonnay', 'Viognier', 'Grüner Veltliner'] },
  'tabbouleh': { colors: ['white'], regions: ['rhône'], grapes: ['Sauvignon Blanc', 'Chardonnay', 'Viognier', 'Grüner Veltliner'] },
  'kibbeh': { colors: ['red'], regions: ['rhône'], grapes: ['Syrah', 'Grenache', 'Carignan', 'Mourvèdre'] },
  'phở': { colors: ['white'], regions: ['mosel', 'alsace', 'sancerre'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'dumpling': { colors: ['white', 'sparkling'], regions: ['alsace', 'languedoc', 'cava', 'prosecco'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Chenin Blanc'] },
  'wonton': { colors: ['white', 'sparkling'], regions: ['alsace', 'languedoc', 'cava', 'prosecco'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Chenin Blanc'] },
  'peking duck': { colors: ['white', 'rose'], regions: ['alsace', 'mosel', 'provence'], grapes: ['Riesling', 'Gewürztraminer', 'Pinot Gris', 'Syrah'] },
  'kung pao': { colors: ['white', 'rose'], regions: ['alsace', 'provence'], grapes: ['Riesling', 'Gewürztraminer', 'Pinot Gris', 'Syrah'] },
  'sweet and sour': { colors: ['white', 'rose'], regions: ['alsace', 'provence'], grapes: ['Riesling', 'Gewürztraminer', 'Pinot Gris', 'Syrah'] },
  'mapo tofu': { colors: ['red', 'white'], regions: ['alsace', 'rioja', 'ribera del duero'], grapes: ['Tempranillo', 'Garnacha', 'Monastrell', 'Malbec'] },
  'char siu': { colors: ['white', 'rose'], regions: ['alsace', 'provence'], grapes: ['Riesling', 'Gewürztraminer', 'Pinot Gris', 'Syrah'] },
  'green curry': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'red curry': { colors: ['white', 'rose'], regions: ['alsace', 'mosel', 'loire', 'provence'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'massaman curry': { colors: ['red', 'white'], regions: ['alsace', 'rioja', 'ribera del duero'], grapes: ['Tempranillo', 'Garnacha', 'Monastrell', 'Malbec'] },
  'tom yum': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'tom kha': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'larb': { colors: ['white'], regions: ['loire', 'alsace', 'mosel'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'som tam': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'rendang': { colors: ['red', 'white'], regions: ['rhône', 'barossa', 'mendoza', 'rioja', 'ribera del duero'], grapes: ['Tempranillo', 'Garnacha', 'Monastrell', 'Malbec'] },
  'nasi goreng': { colors: ['white', 'rose'], regions: ['rhône', 'barossa', 'mclaren vale'], grapes: ['Sauvignon Blanc', 'Semillon', 'Chardonnay', 'Grenache'] },
  'laksa': { colors: ['white'], regions: ['mosel', 'alsace', 'loire'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner', 'Chenin Blanc'] },
  'bulgogi': { colors: ['red'], regions: ['bourgogne', 'beaujolais', 'ribera del duero'], grapes: ['Pinot Noir', 'Tempranillo'] },
  'kimchi jjigae': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'japchae': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Pinot Gris'] },
  'okonomiyaki': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'edamame': { colors: ['white'], regions: ['sancerre', 'marlborough'], grapes: ['Sauvignon Blanc'] },
  'miso soup': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'vindaloo': { colors: ['red'], regions: ['ribera del duero', 'douro'], grapes: ['Tempranillo', 'Touriga Nacional'] },
  'korma': { colors: ['white', 'red'], regions: ['alsace', 'willamette', 'cotes du rhône'], grapes: ['Riesling', 'Gewürztraminer', 'Grenache'] },
  'dal': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'palak paneer': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'samosa': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'pakora': { colors: ['white'], regions: ['alsace', 'willamette'], grapes: ['Riesling', 'Gewürztraminer'] },
  'burrito': { colors: ['red'], regions: ['ribera del duero', 'napa valley'], grapes: ['Tempranillo', 'Cabernet Sauvignon'] },
  'enchiladas': { colors: ['red'], regions: ['ribera del duero', 'napa valley'], grapes: ['Tempranillo', 'Cabernet Sauvignon'] },
  'tamales': { colors: ['red'], regions: ['ribera del duero', 'napa valley'], grapes: ['Tempranillo', 'Cabernet Sauvignon'] },
  'mole': { colors: ['red'], regions: ['ribera del duero', 'napa valley'], grapes: ['Tempranillo', 'Cabernet Sauvignon'] },
  'empanadas': { colors: ['red'], regions: ['mendoza', 'ribera del duero'], grapes: ['Malbec', 'Tempranillo'] },
  'arepas': { colors: ['white'], regions: ['alentejo', 'mendoza'], grapes: ['Albarino', 'Torrontes'] },
  'chimichurri': { colors: ['red'], regions: ['mendoza', 'ribera del duero', 'priorat'], grapes: ['Malbec', 'Cabernet Sauvignon'] },
  'bbq ribs': { colors: ['red'], regions: ['rhône', 'barossa', 'sonoma'], grapes: ['Syrah', 'Zinfandel'] },
  'mac and cheese': { colors: ['white', 'red'], regions: ['bourgogne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'clam chowder': { colors: ['white'], regions: ['chablis', 'sancerre', 'vouvray'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'lobster roll': { colors: ['white'], regions: ['bourgogne', 'alsace', 'loire'], grapes: ['Chardonnay', 'Riesling', 'Sauvignon Blanc'] },
  'chicken wings': { colors: ['white', 'red'], regions: ['rhône', 'loire', 'naoussa'], grapes: ['Grenache', 'Syrah', 'Xinomavro'] },
  'caesar salad': { colors: ['white'], regions: ['sancerre', 'chablis', 'vouvray'], grapes: ['Sauvignon Blanc', 'Chardonnay'] },
  'cobb salad': { colors: ['white'], regions: ['sancerre', 'chablis', 'napa valley'], grapes: ['Sauvignon Blanc', 'Chardonnay'] },
  'poke bowl': { colors: ['white'], regions: ['marlborough', 'napa valley', 'alsace'], grapes: ['Sauvignon Blanc', 'Riesling', 'Pinot Gris'] },
  'pilgrimsmussla': { colors: ['white'], regions: ['bourgogne', 'alsace', 'chablis'], grapes: ['Chardonnay', 'Riesling'] },
  'svärdfisk': { colors: ['white'], regions: ['napa valley', 'mendoza', 'ribera del duero'], grapes: ['Chardonnay', 'Cabernet Sauvignon', 'Tempranillo'] },
  'havskatt': { colors: ['white'], regions: ['chablis', 'sancerre', 'bourgogne'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'kolja': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'öring': { colors: ['white'], regions: ['bourgogne', 'sancerre', 'chablis'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'sardiner': { colors: ['white', 'rose'], regions: ['loire', 'provence', 'alentejo'], grapes: ['Sauvignon Blanc', 'Rosé'] },
  'ansjovis': { colors: ['white', 'rose'], regions: ['provence', 'languedoc', 'sicilien'], grapes: ['Rosé', 'Sauvignon Blanc', 'Vermentino'] },
  'vegansk bowl': { colors: ['white'], regions: ['alsace', 'provence'], grapes: ['Riesling', 'Vermentino'] },
  'quinoa': { colors: ['white'], regions: ['mendoza', 'willamette'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'edamame bowl': { colors: ['white'], regions: ['marlborough', 'napa valley'], grapes: ['Sauvignon Blanc', 'Chardonnay'] },
  'portobello': { colors: ['red'], regions: ['ribera del duero', 'douro'], grapes: ['Tempranillo', 'Touriga Nacional'] },
  'grillad aubergine': { colors: ['red', 'rose'], regions: ['provence', 'languedoc'], grapes: ['Grenache', 'Syrah'] },
  'rostad blomkål': { colors: ['white'], regions: ['loire', 'chablis'], grapes: ['Chenin Blanc', 'Chardonnay'] },
  'rostade rödbetor': { colors: ['red', 'white'], regions: ['bourgogne', 'piemonte'], grapes: ['Pinot Noir', 'Nebbiolo'] },
  'zucchinipasta': { colors: ['white', 'rose'], regions: ['sicilien', 'provence'], grapes: ['Vermentino', 'Grenache'] },
  'linssoppa': { colors: ['red'], regions: ['rhône', 'mendoza'], grapes: ['Syrah', 'Malbec'] },
  'daal': { colors: ['white'], regions: ['alsace', 'vouvray'], grapes: ['Riesling', 'Chenin Blanc'] },
  'grönkålssallad': { colors: ['white'], regions: ['sancerre', 'chablis'], grapes: ['Sauvignon Blanc', 'Chardonnay'] },
  'svamp risotto': { colors: ['white', 'red'], regions: ['barolo', 'chianti'], grapes: ['Nebbiolo', 'Sangiovese'] },
  'fondue': { colors: ['red', 'white'], regions: ['mosel', 'beaujolais'], grapes: ['Riesling', 'Gamay'] },
  'raclette': { colors: ['red', 'white'], regions: ['valais', 'savoie'], grapes: ['Pinot Noir', 'Chasselas'] },
  'gratinerad getost': { colors: ['red'], regions: ['provence', 'languedoc'], grapes: ['Grenache', 'Syrah'] },
  'mozzarella': { colors: ['white', 'rose'], regions: ['campania', 'puglia'], grapes: ['Fiano', 'Nero d\'Avola'] },
  'gorgonzola': { colors: ['red'], regions: ['piemonte', 'toscana'], grapes: ['Nebbiolo', 'Sangiovese'] },
  'pecorino': { colors: ['white', 'red'], regions: ['toscana', 'sicilien'], grapes: ['Vermentino', 'Nero d\'Avola'] },
  'comté': { colors: ['red', 'white'], regions: ['jura', 'bourgogne'], grapes: ['Poulsard', 'Chardonnay'] },
  'brie': { colors: ['red', 'white'], regions: ['bourgogne', 'champagne'], grapes: ['Pinot Noir', 'Chardonnay'] },
  'roquefort': { colors: ['red'], regions: ['cahors', 'madiran'], grapes: ['Malbec', 'Tannat'] },
  'stilton': { colors: ['red'], regions: ['douro'], grapes: ['Touriga Nacional', 'Tinta Roriz'] },
  'parmesan': { colors: ['red'], regions: ['emilia-romagna', 'toscana'], grapes: ['Lambrusco', 'Sangiovese'] },
  'smörrebröd': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'bordeaux'], grapes: ['Riesling', 'Pinot Noir'] },
  'plättar': { colors: ['white'], regions: ['vouvray', 'loire'], grapes: ['Chenin Blanc'] },
  'french toast': { colors: ['white'], regions: ['vouvray', 'sancerre'], grapes: ['Chenin Blanc'] },
  'avokado toast': { colors: ['white'], regions: ['sancerre', 'chablis'], grapes: ['Sauvignon Blanc'] },
  'bagel med lax': { colors: ['white'], regions: ['chablis', 'alsace'], grapes: ['Chardonnay', 'Riesling'] },
  'chokladfondant': { colors: ['red'], regions: ['piemonte', 'barolo'], grapes: ['Nebbiolo'] },
  'fruktpaj': { colors: ['white', 'rose'], regions: ['loire', 'provence'], grapes: ['Chenin Blanc', 'Pinot Noir'] },
  'äppelpaj': { colors: ['white'], regions: ['vouvray', 'alsace'], grapes: ['Chenin Blanc', 'Riesling'] },
  'mousse au chocolat': { colors: ['red'], regions: ['bordeaux', 'piemonte'], grapes: ['Merlot', 'Nebbiolo'] },
  'tarte au citron': { colors: ['white'], regions: ['sancerre', 'chablis'], grapes: ['Sauvignon Blanc'] },
  'profiteroles': { colors: ['white'], regions: ['alsace', 'mosel'], grapes: ['Riesling'] },
  'pannacotta': { colors: ['white'], regions: ['piemonte'], grapes: ['Moscato'] },
  'crêpes': { colors: ['white'], regions: ['loire', 'vouvray'], grapes: ['Chenin Blanc'] },
  'banh mi': { colors: ['white'], regions: ['willamette', 'alsace'], grapes: ['Pinot Gris'] },
  'grillat kött': { colors: ['red'], regions: ['barossa', 'napa valley'], grapes: ['Cabernet Sauvignon'] },
  'rökt fisk': { colors: ['white'], regions: ['chablis', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'friterad kyckling': { colors: ['white'], regions: ['alsace', 'vouvray'], grapes: ['Riesling', 'Chenin Blanc'] },
  'stekt fläsk': { colors: ['white', 'red'], regions: ['rioja'], grapes: ['Tempranillo'] },
  'ugnsrostad kyckling': { colors: ['white'], regions: ['bourgogne', 'loire', 'alsace'], grapes: ['Chardonnay', 'Riesling', 'Pinot Gris'] },
  'confiterat': { colors: ['white', 'red'], regions: ['bordeaux', 'rhône'], grapes: ['Cabernet Sauvignon', 'Syrah'] },
  'sous vide': { colors: ['white'], regions: ['chablis', 'sancerre', 'vouvray', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc'] },
  'surströmming': { colors: ['white'], regions: ['alsace', 'mosel'], grapes: ['Riesling', 'Gewürztraminer'] },
  'gravlax': { colors: ['white', 'sparkling'], regions: ['chablis', 'champagne', 'alsace'], grapes: ['Chardonnay', 'Riesling', 'Pinot Noir'] },
  'smörgåstårta': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'alsace'], grapes: ['Chardonnay', 'Pinot Noir', 'Riesling'] },
  'västerbottenpaj': { colors: ['white'], regions: ['bourgogne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Riesling'] },

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

/** Find food pairing preferences from food keywords (checks runtime overrides first, with fuzzy fallback) */
export function lookupFoodPairing(foods: string[]): FoodWinePreference {
  const merged: FoodWinePreference = { colors: [], regions: [], grapes: [] };

  for (const food of foods) {
    const key = food.toLowerCase().trim();
    // Check runtime overrides (from DB) before static table, then fuzzy fallback
    const pref = RUNTIME_OVERRIDES[key] || FOOD_TO_WINE_STYLES[key] || fuzzyFoodMatch(key);
    if (pref) {
      merged.colors.push(...pref.colors);
      merged.regions.push(...pref.regions);
      merged.grapes.push(...pref.grapes);
    } else {
      console.warn(`[FoodPairing] Unmapped food: "${key}" — no match found`);
    }
  }

  return {
    colors: [...new Set(merged.colors)],
    regions: [...new Set(merged.regions)],
    grapes: [...new Set(merged.grapes)],
  };
}

/**
 * Fuzzy match: tries to find a base food word inside the input.
 * E.g. "torskrygg" contains "torsk", "lammracks" contains "lamm".
 */
function fuzzyFoodMatch(input: string): FoodWinePreference | null {
  // Try to find a known food word that is a substring of the input
  // Sort by length descending so "nötkött" matches before "ost"
  const knownFoods = Object.keys(FOOD_TO_WINE_STYLES).sort((a, b) => b.length - a.length);

  for (const known of knownFoods) {
    if (known.length >= 3 && input.includes(known)) {
      console.log(`[FoodPairing] Fuzzy match: "${input}" → "${known}"`);
      return FOOD_TO_WINE_STYLES[known];
    }
  }

  // Try the reverse: does a known food contain our input?
  // E.g. input "kött" is inside "nötkött"
  if (input.length >= 3) {
    for (const known of knownFoods) {
      if (known.includes(input)) {
        console.log(`[FoodPairing] Reverse fuzzy: "${input}" → "${known}"`);
        return FOOD_TO_WINE_STYLES[known];
      }
    }
  }

  return null;
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
