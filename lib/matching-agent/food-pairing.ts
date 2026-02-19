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
  'lammracks': { colors: ['red'], regions: ['bordeaux', 'rhône', 'rioja', 'barolo'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo'] },
  'lammstek': { colors: ['red'], regions: ['bordeaux', 'rhône', 'rioja', 'barolo'], grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo'] },
  'nötkött': { colors: ['red'], regions: ['bordeaux', 'mendoza', 'barossa'], grapes: ['Cabernet Sauvignon', 'Malbec', 'Shiraz'] },
  'biff': { colors: ['red'], regions: ['napa valley', 'bordeaux', 'ribera del duero'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Malbec'] },
  'vilt': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo'] },
  'viltgryta': { colors: ['red'], regions: ['bourgogne', 'rhône', 'piemonte'], grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo'] },
  'vildsvin': { colors: ['red'], regions: ['toscana', 'rhône', 'languedoc'], grapes: ['Sangiovese', 'Syrah', 'Grenache'] },
  'älg': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rhône'], grapes: ['Pinot Noir', 'Nebbiolo', 'Syrah'] },
  'hjort': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'priorat'], grapes: ['Pinot Noir', 'Nebbiolo', 'Grenache'] },
  'entrecote': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza'], grapes: ['Cabernet Sauvignon', 'Malbec'] },
  'entrecôte': { colors: ['red'], regions: ['bordeaux', 'napa valley', 'mendoza'], grapes: ['Cabernet Sauvignon', 'Malbec'] },
  'oxfilé': { colors: ['red'], regions: ['bordeaux', 'barolo', 'napa valley'], grapes: ['Cabernet Sauvignon', 'Nebbiolo', 'Merlot'] },
  'tartar': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'tartare': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'råbiff': { colors: ['red', 'rose'], regions: ['bourgogne', 'loire', 'beaujolais'], grapes: ['Pinot Noir', 'Gamay', 'Cabernet Franc'] },
  'carpaccio': { colors: ['red', 'rose'], regions: ['bourgogne', 'piemonte', 'loire'], grapes: ['Pinot Noir', 'Nebbiolo', 'Gamay'] },
  'köttbullar': { colors: ['red'], regions: ['toscana', 'languedoc', 'rioja'], grapes: ['Sangiovese', 'Grenache', 'Tempranillo'] },
  'gryta': { colors: ['red'], regions: ['rhône', 'languedoc', 'rioja'], grapes: ['Syrah', 'Grenache', 'Tempranillo'] },
  'pulled pork': { colors: ['red', 'rose'], regions: ['languedoc', 'rhône', 'mendoza'], grapes: ['Grenache', 'Syrah', 'Malbec'] },
  'burger': { colors: ['red'], regions: ['languedoc', 'mendoza', 'barossa'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },
  'hamburgare': { colors: ['red'], regions: ['languedoc', 'mendoza', 'barossa'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },

  // White meats & poultry
  'kyckling': { colors: ['white', 'red'], regions: ['bourgogne', 'loire', 'rioja'], grapes: ['Chardonnay', 'Chenin Blanc', 'Pinot Noir'] },
  'anka': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo'] },
  'ankbröst': { colors: ['red'], regions: ['bourgogne', 'alsace', 'piemonte'], grapes: ['Pinot Noir', 'Pinot Gris', 'Nebbiolo'] },
  'anklever': { colors: ['white'], regions: ['alsace', 'sauternes', 'loire'], grapes: ['Gewürztraminer', 'Sémillon', 'Chenin Blanc'] },
  'foie gras': { colors: ['white'], regions: ['alsace', 'sauternes', 'loire'], grapes: ['Gewürztraminer', 'Sémillon', 'Chenin Blanc'] },
  'gås': { colors: ['red', 'white'], regions: ['alsace', 'bourgogne', 'loire'], grapes: ['Gewürztraminer', 'Pinot Noir', 'Chenin Blanc'] },
  'fläsk': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Pinot Gris', 'Chenin Blanc'] },
  'fläskfilé': { colors: ['white', 'red'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Pinot Gris', 'Chenin Blanc'] },
  'kalv': { colors: ['white', 'red'], regions: ['bourgogne', 'piemonte', 'toscana'], grapes: ['Chardonnay', 'Nebbiolo', 'Sangiovese'] },
  'kalvschnitzel': { colors: ['white', 'red'], regions: ['alsace', 'bourgogne', 'toscana'], grapes: ['Riesling', 'Chardonnay', 'Sangiovese'] },

  // Seafood
  'fisk': { colors: ['white'], regions: ['chablis', 'sancerre', 'marlborough'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Albariño'] },
  'lax': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'oregon'], grapes: ['Chardonnay', 'Pinot Gris', 'Pinot Noir'] },
  'gravad lax': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'chablis'], grapes: ['Riesling', 'Chardonnay'] },
  'torsk': { colors: ['white'], regions: ['chablis', 'muscadet', 'vinho verde'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'torskrygg': { colors: ['white'], regions: ['chablis', 'muscadet', 'bourgogne'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'piggvar': { colors: ['white'], regions: ['bourgogne', 'chablis', 'bordeaux'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Sémillon'] },
  'sjötunga': { colors: ['white'], regions: ['bourgogne', 'chablis', 'muscadet'], grapes: ['Chardonnay', 'Melon de Bourgogne'] },
  'abborre': { colors: ['white'], regions: ['chablis', 'loire', 'alsace'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Riesling'] },
  'gös': { colors: ['white'], regions: ['chablis', 'bourgogne', 'loire'], grapes: ['Chardonnay', 'Sauvignon Blanc', 'Chenin Blanc'] },
  'röding': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'provence'], grapes: ['Chardonnay', 'Pinot Gris'] },
  'hummer': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'skaldjur': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'rías baixas'], grapes: ['Chardonnay', 'Albariño', 'Sauvignon Blanc'] },
  'räkor': { colors: ['white', 'rose'], regions: ['provence', 'chablis', 'rías baixas'], grapes: ['Albariño', 'Chardonnay', 'Grenache'] },
  'musslor': { colors: ['white'], regions: ['muscadet', 'chablis', 'vinho verde'], grapes: ['Melon de Bourgogne', 'Chardonnay'] },
  'ostron': { colors: ['white', 'sparkling'], regions: ['chablis', 'champagne', 'muscadet'], grapes: ['Chardonnay', 'Melon de Bourgogne'] },
  'kräftor': { colors: ['white', 'sparkling'], regions: ['alsace', 'bourgogne', 'champagne'], grapes: ['Riesling', 'Chardonnay'] },
  'ceviche': { colors: ['white', 'sparkling'], regions: ['marlborough', 'rías baixas', 'vinho verde'], grapes: ['Sauvignon Blanc', 'Albariño'] },

  // Vegetarian & pasta
  'pasta': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'sicilia'], grapes: ['Sangiovese', 'Nebbiolo', 'Nero d\'Avola'] },
  'pizza': { colors: ['red'], regions: ['toscana', 'sicilia', 'campania'], grapes: ['Sangiovese', 'Nero d\'Avola', 'Aglianico'] },
  'risotto': { colors: ['white', 'red'], regions: ['bourgogne', 'piemonte', 'toscana'], grapes: ['Chardonnay', 'Nebbiolo', 'Sangiovese'] },
  'svamp': { colors: ['red'], regions: ['bourgogne', 'piemonte', 'rioja'], grapes: ['Pinot Noir', 'Nebbiolo', 'Tempranillo'] },
  'ost': { colors: ['red', 'white', 'fortified'], regions: ['bourgogne', 'douro', 'rioja'], grapes: ['Pinot Noir', 'Chardonnay'] },
  'chark': { colors: ['red', 'rose'], regions: ['beaujolais', 'loire', 'toscana'], grapes: ['Gamay', 'Cabernet Franc', 'Sangiovese'] },
  'charkuterier': { colors: ['red', 'rose'], regions: ['beaujolais', 'loire', 'toscana'], grapes: ['Gamay', 'Cabernet Franc', 'Sangiovese'] },
  'sallad': { colors: ['white', 'rose'], regions: ['provence', 'loire', 'rueda'], grapes: ['Sauvignon Blanc', 'Verdejo', 'Grenache'] },
  'vegetariskt': { colors: ['white', 'red', 'rose'], regions: ['loire', 'alsace', 'toscana'], grapes: ['Chenin Blanc', 'Riesling', 'Sangiovese'] },
  'grönsaker': { colors: ['white', 'rose'], regions: ['loire', 'provence', 'alsace'], grapes: ['Sauvignon Blanc', 'Grenache', 'Riesling'] },

  // Asian & fusion
  'sushi': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'marlborough'], grapes: ['Riesling', 'Sauvignon Blanc', 'Grüner Veltliner'] },
  'sashimi': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Riesling', 'Grüner Veltliner'] },
  'thai': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'pad thai': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'indisk': { colors: ['white'], regions: ['alsace', 'mosel'], grapes: ['Riesling', 'Gewürztraminer'] },
  'curry': { colors: ['white'], regions: ['alsace', 'mosel', 'marlborough'], grapes: ['Riesling', 'Gewürztraminer', 'Sauvignon Blanc'] },
  'koreansk': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'languedoc'], grapes: ['Riesling', 'Gamay', 'Grenache'] },
  'korean bbq': { colors: ['red', 'white'], regions: ['beaujolais', 'alsace', 'languedoc'], grapes: ['Gamay', 'Riesling', 'Grenache'] },
  'wok': { colors: ['white', 'rose'], regions: ['alsace', 'loire', 'marlborough'], grapes: ['Riesling', 'Sauvignon Blanc', 'Chenin Blanc'] },
  'ramen': { colors: ['white', 'red'], regions: ['alsace', 'beaujolais', 'loire'], grapes: ['Riesling', 'Gamay', 'Chenin Blanc'] },
  'pho': { colors: ['white'], regions: ['alsace', 'mosel', 'loire'], grapes: ['Riesling', 'Gewürztraminer', 'Chenin Blanc'] },
  'bao buns': { colors: ['sparkling', 'white'], regions: ['champagne', 'alsace', 'mosel'], grapes: ['Chardonnay', 'Riesling', 'Pinot Noir'] },
  'dim sum': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'mosel'], grapes: ['Riesling', 'Chardonnay', 'Grüner Veltliner'] },
  'gyoza': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'marlborough'], grapes: ['Riesling', 'Chardonnay', 'Sauvignon Blanc'] },
  'dumplings': { colors: ['white', 'sparkling'], regions: ['alsace', 'champagne', 'mosel'], grapes: ['Riesling', 'Chardonnay', 'Pinot Gris'] },
  'tempura': { colors: ['white', 'sparkling'], regions: ['champagne', 'alsace', 'chablis'], grapes: ['Chardonnay', 'Riesling', 'Sauvignon Blanc'] },
  'kimchi': { colors: ['white', 'sparkling'], regions: ['alsace', 'mosel', 'champagne'], grapes: ['Riesling', 'Gewürztraminer', 'Chardonnay'] },
  'yakitori': { colors: ['white', 'red'], regions: ['beaujolais', 'alsace', 'loire'], grapes: ['Gamay', 'Riesling', 'Chenin Blanc'] },

  // Italian
  'vitello tonnato': { colors: ['white', 'rose'], regions: ['piemonte', 'soave', 'provence'], grapes: ['Verdicchio', 'Vermentino', 'Garganega'] },
  'burrata': { colors: ['white', 'rose', 'sparkling'], regions: ['puglia', 'campania', 'provence'], grapes: ['Fiano', 'Chardonnay', 'Ribolla Gialla'] },
  'osso buco': { colors: ['red'], regions: ['piemonte', 'toscana', 'lombardia'], grapes: ['Nebbiolo', 'Sangiovese', 'Barbera'] },
  'saltimbocca': { colors: ['red', 'white'], regions: ['toscana', 'piemonte', 'bourgogne'], grapes: ['Sangiovese', 'Nebbiolo', 'Chardonnay'] },
  'bruschetta': { colors: ['white', 'rose', 'red'], regions: ['toscana', 'campania', 'sicilia'], grapes: ['Vermentino', 'Sangiovese', 'Nero d\'Avola'] },
  'antipasti': { colors: ['white', 'rose', 'red'], regions: ['toscana', 'sicilia', 'campania'], grapes: ['Vermentino', 'Sangiovese', 'Fiano'] },
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
  'panna cotta': { colors: ['white', 'sparkling'], regions: ['piemonte', 'veneto', 'mosel'], grapes: ['Moscato', 'Riesling', 'Muscat'] },
  'tiramisu': { colors: ['fortified'], regions: ['toscana', 'veneto', 'sicilia'], grapes: ['Vin Santo', 'Muscat', 'Nero d\'Avola'] },

  // French
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
  'crème brûlée': { colors: ['fortified', 'white'], regions: ['douro', 'sauternes', 'tokaj'], grapes: ['Tawny Port', 'Sémillon', 'Furmint'] },

  // Spanish & tapas
  'tapas': { colors: ['red', 'white', 'rose'], regions: ['rioja', 'rías baixas', 'priorat'], grapes: ['Tempranillo', 'Albariño', 'Grenache'] },
  'paella': { colors: ['white', 'rose'], regions: ['valencia', 'rías baixas', 'penedès'], grapes: ['Albariño', 'Verdejo', 'Grenache'] },
  'patatas bravas': { colors: ['red', 'rose'], regions: ['rioja', 'navarra', 'priorat'], grapes: ['Tempranillo', 'Grenache', 'Monastrell'] },
  'jamón': { colors: ['red', 'fortified'], regions: ['rioja', 'jerez', 'ribera del duero'], grapes: ['Tempranillo', 'Palomino', 'Grenache'] },
  'gambas al ajillo': { colors: ['white'], regions: ['rías baixas', 'rueda', 'penedès'], grapes: ['Albariño', 'Verdejo', 'Xarel·lo'] },
  'tortilla española': { colors: ['white', 'rose'], regions: ['rueda', 'rías baixas', 'navarra'], grapes: ['Verdejo', 'Albariño', 'Grenache'] },
  'manchego': { colors: ['red', 'white'], regions: ['rioja', 'rueda', 'la mancha'], grapes: ['Tempranillo', 'Verdejo', 'Garnacha'] },

  // Grillat
  'grillat': { colors: ['red', 'rose'], regions: ['languedoc', 'mendoza', 'barossa'], grapes: ['Grenache', 'Malbec', 'Shiraz'] },
  'grillad fisk': { colors: ['white', 'rose'], regions: ['provence', 'rías baixas', 'sicilia'], grapes: ['Vermentino', 'Albariño', 'Grenache'] },
  'grillad bläckfisk': { colors: ['white', 'rose'], regions: ['santorini', 'rías baixas', 'provence'], grapes: ['Assyrtiko', 'Albariño', 'Grenache'] },
  'bläckfisk': { colors: ['white', 'rose'], regions: ['santorini', 'rías baixas', 'provence'], grapes: ['Assyrtiko', 'Albariño', 'Grenache'] },
  'revbensspjäll': { colors: ['red'], regions: ['mendoza', 'barossa', 'languedoc'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },
  'spareribs': { colors: ['red'], regions: ['mendoza', 'barossa', 'languedoc'], grapes: ['Malbec', 'Shiraz', 'Grenache'] },
  'brisket': { colors: ['red'], regions: ['barossa', 'mendoza', 'rhône'], grapes: ['Shiraz', 'Malbec', 'Syrah'] },

  // Fisk & skaldjur (extra)
  'skaldjursplatå': { colors: ['white', 'sparkling'], regions: ['champagne', 'chablis', 'muscadet'], grapes: ['Chardonnay', 'Melon de Bourgogne', 'Albariño'] },
  'calamari': { colors: ['white', 'sparkling'], regions: ['sicilia', 'champagne', 'vinho verde'], grapes: ['Grillo', 'Chardonnay', 'Albariño'] },
  'fish and chips': { colors: ['white', 'sparkling'], regions: ['muscadet', 'champagne', 'vinho verde'], grapes: ['Melon de Bourgogne', 'Chardonnay', 'Albariño'] },
  'löjrom': { colors: ['sparkling', 'white'], regions: ['champagne', 'chablis', 'alsace'], grapes: ['Chardonnay', 'Pinot Noir', 'Riesling'] },
  'kammusslor': { colors: ['white'], regions: ['bourgogne', 'champagne', 'chablis'], grapes: ['Chardonnay', 'Chenin Blanc', 'Viognier'] },
  'havskräfta': { colors: ['white', 'sparkling'], regions: ['champagne', 'bourgogne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'tonfisk': { colors: ['red', 'rose', 'white'], regions: ['provence', 'bourgogne', 'sicilia'], grapes: ['Pinot Noir', 'Grenache', 'Nero d\'Avola'] },
  'havsöring': { colors: ['white', 'rose'], regions: ['bourgogne', 'alsace', 'loire'], grapes: ['Chardonnay', 'Pinot Gris', 'Sauvignon Blanc'] },
  'fiskgryta': { colors: ['white', 'rose'], regions: ['provence', 'chablis', 'rías baixas'], grapes: ['Grenache', 'Chardonnay', 'Albariño'] },
  'fisksoppa': { colors: ['white', 'rose'], regions: ['provence', 'cassis', 'chablis'], grapes: ['Marsanne', 'Chardonnay', 'Grenache'] },
  'skaldjursgryta': { colors: ['white'], regions: ['bourgogne', 'chablis', 'cassis'], grapes: ['Chardonnay', 'Marsanne', 'Roussanne'] },

  // Soppor
  'soppa': { colors: ['white', 'red'], regions: ['loire', 'bourgogne', 'alsace'], grapes: ['Chenin Blanc', 'Chardonnay', 'Riesling'] },
  'svampsoppa': { colors: ['white', 'red'], regions: ['bourgogne', 'jura', 'alsace'], grapes: ['Chardonnay', 'Savagnin', 'Pinot Noir'] },
  'hummersoppa': { colors: ['white'], regions: ['bourgogne', 'champagne', 'chablis'], grapes: ['Chardonnay', 'Pinot Noir'] },
  'löksoppa': { colors: ['white', 'red'], regions: ['bourgogne', 'jura', 'alsace'], grapes: ['Chardonnay', 'Savagnin', 'Riesling'] },
  'tomatsoppa': { colors: ['rose', 'red'], regions: ['provence', 'toscana', 'rioja'], grapes: ['Grenache', 'Sangiovese', 'Tempranillo'] },
  'sparrissoppa': { colors: ['white'], regions: ['alsace', 'loire', 'bourgogne'], grapes: ['Sauvignon Blanc', 'Riesling', 'Chardonnay'] },

  // Förrätter & ostar
  'crostini': { colors: ['white', 'rose', 'red'], regions: ['toscana', 'provence', 'sicilia'], grapes: ['Vermentino', 'Sangiovese', 'Grenache'] },
  'getost': { colors: ['white'], regions: ['sancerre', 'loire', 'languedoc'], grapes: ['Sauvignon Blanc', 'Chenin Blanc', 'Viognier'] },
  'chèvre': { colors: ['white'], regions: ['sancerre', 'loire', 'languedoc'], grapes: ['Sauvignon Blanc', 'Chenin Blanc', 'Viognier'] },
  'lagrad ost': { colors: ['red', 'fortified'], regions: ['rioja', 'douro', 'bourgogne'], grapes: ['Tempranillo', 'Touriga Nacional', 'Pinot Noir'] },
  'ostbricka': { colors: ['red', 'white', 'fortified'], regions: ['bourgogne', 'douro', 'rioja'], grapes: ['Pinot Noir', 'Chardonnay', 'Touriga Nacional'] },
  'sparris': { colors: ['white'], regions: ['alsace', 'loire', 'niederösterreich'], grapes: ['Sauvignon Blanc', 'Riesling', 'Grüner Veltliner'] },

  // Svenska klassiker
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

  // Kött & bistro
  'schnitzel': { colors: ['white', 'red'], regions: ['alsace', 'niederösterreich', 'bourgogne'], grapes: ['Riesling', 'Grüner Veltliner', 'Pinot Noir'] },
  'planka': { colors: ['red'], regions: ['bordeaux', 'rioja', 'toscana'], grapes: ['Cabernet Sauvignon', 'Tempranillo', 'Sangiovese'] },
  'oxbringa': { colors: ['red'], regions: ['rhône', 'languedoc', 'mendoza'], grapes: ['Syrah', 'Grenache', 'Malbec'] },
  'oxsvans': { colors: ['red'], regions: ['rhône', 'ribera del duero', 'barossa'], grapes: ['Syrah', 'Tempranillo', 'Shiraz'] },
  'lammlägg': { colors: ['red'], regions: ['rhône', 'priorat', 'rioja'], grapes: ['Syrah', 'Grenache', 'Tempranillo'] },
  'fläskkarré': { colors: ['red', 'white'], regions: ['bourgogne', 'alsace', 'beaujolais'], grapes: ['Pinot Noir', 'Riesling', 'Gamay'] },
  'fläskkotlett': { colors: ['red', 'white'], regions: ['bourgogne', 'alsace', 'beaujolais'], grapes: ['Pinot Noir', 'Riesling', 'Gamay'] },
  'korv': { colors: ['red', 'white', 'rose'], regions: ['beaujolais', 'alsace', 'languedoc'], grapes: ['Gamay', 'Riesling', 'Grenache'] },

  // Dessert
  'choklad': { colors: ['red', 'fortified'], regions: ['douro', 'banyuls', 'barossa'], grapes: ['Touriga Nacional', 'Grenache', 'Shiraz'] },
  'dessert': { colors: ['white', 'fortified'], regions: ['sauternes', 'mosel', 'tokaj'], grapes: ['Sémillon', 'Riesling', 'Furmint'] },
  'kladdkaka': { colors: ['red', 'fortified'], regions: ['douro', 'banyuls', 'maury'], grapes: ['Touriga Nacional', 'Grenache', 'Muscat'] },
  'äppelkaka': { colors: ['white'], regions: ['alsace', 'loire', 'mosel'], grapes: ['Riesling', 'Chenin Blanc', 'Gewürztraminer'] },
  'affogato': { colors: ['fortified'], regions: ['jerez', 'douro', 'sicilia'], grapes: ['Pedro Ximénez', 'Touriga Nacional', 'Muscat'] },
  'sorbet': { colors: ['sparkling', 'white'], regions: ['champagne', 'mosel', 'piemonte'], grapes: ['Chardonnay', 'Riesling', 'Moscato'] },
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

/** Find food pairing preferences from food keywords (with fuzzy fallback) */
export function lookupFoodPairing(foods: string[]): FoodWinePreference {
  const merged: FoodWinePreference = { colors: [], regions: [], grapes: [] };

  for (const food of foods) {
    const key = food.toLowerCase().trim();
    const pref = FOOD_TO_WINE_STYLES[key] || fuzzyFoodMatch(key);
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
