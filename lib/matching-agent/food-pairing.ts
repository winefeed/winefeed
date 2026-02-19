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

  // ========================================================================
  // Vegetarian & pasta
  // ========================================================================
  'pasta': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'sicilia', 'umbria'], grapes: ['Sangiovese', 'Nebbiolo', 'Nero d\'Avola', 'Barbera'] },
  'pizza': { colors: ['red'], regions: ['toscana', 'sicilia', 'campania'], grapes: ['Sangiovese', 'Nero d\'Avola', 'Aglianico'] },
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
  // BBQ & Street food
  // ========================================================================
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
