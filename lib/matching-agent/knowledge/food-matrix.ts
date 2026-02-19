/**
 * ENHANCED FOOD-WINE MATRIX
 *
 * Extends the basic food-pairing lookup with:
 * - Cooking method awareness (grillat ≠ kokt ≠ rått)
 * - Intensity matching (lätt rätt → lätt vin)
 * - Nordic/Swedish dishes
 * - Seasonal pairings
 * - Sauce/preparation awareness
 *
 * Used by: pre-scorer, AI re-ranker prompt, food-pairing module
 */

export interface FoodWineMatch {
  /** Foods/keywords that trigger this match (Swedish) */
  keywords: string[];
  /** Intensity of the dish (determines wine weight) */
  intensity: 'light' | 'medium' | 'full';
  /** Best wine colors */
  colors: ('red' | 'white' | 'rosé' | 'sparkling' | 'orange' | 'alcohol_free')[];
  /** Ideal grape varieties */
  grapes: string[];
  /** Ideal regions */
  regions: string[];
  /** Wine characteristics that pair well */
  wineStyle: string[];
  /** Serving temp preference */
  servingTemp: 'cold' | 'cool' | 'cellar' | 'room';
  /** Swedish sommelier tip */
  tip: string;
}

// ═══════════════════════════════════════════
// PROTEIN-BASED PAIRINGS
// ═══════════════════════════════════════════

export const PROTEIN_PAIRINGS: FoodWineMatch[] = [
  // RED MEAT
  {
    keywords: ['biff', 'entrecôte', 'ryggbiff', 'oxfilé', 'nötkött'],
    intensity: 'full',
    colors: ['red'],
    grapes: ['Cabernet Sauvignon', 'Malbec', 'Syrah', 'Nebbiolo'],
    regions: ['Bordeaux', 'Mendoza', 'Barossa Valley', 'Napa Valley'],
    wineStyle: ['kraftig', 'tanninrik', 'eklagrad'],
    servingTemp: 'room',
    tip: 'Tannin klipper igenom fett och gör köttet saftigare. Ju fetare stycke, desto mer tannin.'
  },
  {
    keywords: ['lamm', 'lammkotlett', 'lammkarré', 'lammstek'],
    intensity: 'full',
    colors: ['red'],
    grapes: ['Cabernet Sauvignon', 'Syrah', 'Nebbiolo', 'Tempranillo', 'Mourvèdre'],
    regions: ['Bordeaux', 'Rhône', 'Barolo', 'Rioja', 'Bandol'],
    wineStyle: ['kraftig', 'kryddig', 'tanninrik'],
    servingTemp: 'room',
    tip: 'Lamm med rosmarin → Rhône-Syrah. Lamm med mintgelé → lättare Cabernet Franc.'
  },
  {
    keywords: ['vilt', 'älg', 'hjort', 'rådjur', 'vildsvin', 'renstek', 'ren'],
    intensity: 'full',
    colors: ['red'],
    grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo', 'Sangiovese', 'Blaufränkisch'],
    regions: ['Bourgogne', 'Rhône', 'Barolo', 'Toscana'],
    wineStyle: ['jordig', 'svamp', 'komplex', 'kryddig'],
    servingTemp: 'room',
    tip: 'Vilt har intensiv smak men är magert. Pinot Noir med jordiga toner är klassiskt. Renstek → norra Rhône Syrah.'
  },
  {
    keywords: ['fläsk', 'fläskfilé', 'fläskkotlett', 'pulled pork', 'griskött'],
    intensity: 'medium',
    colors: ['red', 'white'],
    grapes: ['Pinot Noir', 'Grenache', 'Riesling', 'Chenin Blanc', 'Zweigelt'],
    regions: ['Bourgogne', 'Rhône', 'Alsace', 'Loire'],
    wineStyle: ['fruktig', 'medellång', 'balanserad'],
    servingTemp: 'cellar',
    tip: 'Fläsk är neutralt — matcha sås/tillagning. BBQ pulled pork → Zinfandel. Fläskfilé i svampsås → Pinot Noir.'
  },
  {
    keywords: ['kalv', 'kalvfilé', 'kalvkotlett', 'vitello tonnato'],
    intensity: 'medium',
    colors: ['red', 'white'],
    grapes: ['Pinot Noir', 'Barbera', 'Dolcetto', 'Chardonnay'],
    regions: ['Bourgogne', 'Piemonte', 'Toscana'],
    wineStyle: ['elegant', 'medellång', 'fin syra'],
    servingTemp: 'cellar',
    tip: 'Kalv är delikat. Undvik för kraftiga viner. Vitello tonnato → Arneis eller Vermentino.'
  },

  // POULTRY
  {
    keywords: ['kyckling', 'kycklingfilé', 'kycklinglår', 'grillad kyckling'],
    intensity: 'medium',
    colors: ['white', 'red', 'rosé'],
    grapes: ['Chardonnay', 'Pinot Noir', 'Grenache', 'Viognier'],
    regions: ['Bourgogne', 'Rhône', 'Languedoc'],
    wineStyle: ['mångsidig', 'fruktig', 'medellång'],
    servingTemp: 'cool',
    tip: 'Kyckling tar smak av tillagning. Grillad → rosé/Grenache. I gräddsås → Chardonnay. Citron/örter → Sauvignon Blanc.'
  },
  {
    keywords: ['anka', 'ankbröst', 'confit', 'anka confit'],
    intensity: 'full',
    colors: ['red'],
    grapes: ['Pinot Noir', 'Syrah', 'Nebbiolo', 'Cabernet Franc'],
    regions: ['Bourgogne', 'Rhône', 'Loire'],
    wineStyle: ['komplex', 'jordig', 'medellång till kraftig'],
    servingTemp: 'cellar',
    tip: 'Ankans fett kräver antingen hög syra (Pinot Noir, Nebbiolo) eller fruktig kryddighet (Syrah).'
  },

  // SEAFOOD
  {
    keywords: ['lax', 'grillad lax', 'gravlax', 'rökt lax'],
    intensity: 'medium',
    colors: ['white', 'rosé', 'red'],
    grapes: ['Pinot Noir', 'Chardonnay', 'Pinot Gris', 'Grüner Veltliner'],
    regions: ['Bourgogne', 'Alsace', 'Oregon'],
    wineStyle: ['mångsidig', 'fin syra', 'medelfyllig'],
    servingTemp: 'cool',
    tip: 'Lax tål rött vin! Pinot Noir är fantastiskt. Gravlax → torr Riesling med dillens smak.'
  },
  {
    keywords: ['torsk', 'kolja', 'vitfisk', 'gös', 'abborre', 'sej'],
    intensity: 'light',
    colors: ['white'],
    grapes: ['Chablis', 'Muscadet', 'Albariño', 'Vermentino', 'Grüner Veltliner'],
    regions: ['Chablis', 'Loire', 'Rías Baixas'],
    wineStyle: ['fräsch', 'mineralisk', 'lätt'],
    servingTemp: 'cold',
    tip: 'Mild vitfisk vill ha neutral, mineralisk vit. Chablis eller Muscadet sur lie är klassiker.'
  },
  {
    keywords: ['hummer', 'kräftor', 'kräftskiva'],
    intensity: 'medium',
    colors: ['white', 'sparkling'],
    grapes: ['Chardonnay', 'Viognier', 'Riesling'],
    regions: ['Bourgogne', 'Champagne', 'Condrieu'],
    wineStyle: ['fyllig', 'smörig', 'elegant'],
    servingTemp: 'cool',
    tip: 'Hummer i smör → vit Bourgogne. Kräftskiva → Riesling eller mousserande. Lyxig skaldjur förtjänar lyxigt vin.'
  },
  {
    keywords: ['skaldjur', 'räkor', 'musslor', 'blåmusslor', 'pilgrimsmusslor'],
    intensity: 'light',
    colors: ['white', 'sparkling'],
    grapes: ['Muscadet', 'Albariño', 'Sauvignon Blanc', 'Vermentino'],
    regions: ['Loire', 'Rías Baixas', 'Provence'],
    wineStyle: ['fräsch', 'salt', 'mineralisk'],
    servingTemp: 'cold',
    tip: 'Salt vin till salt skaldjur. Albariño från Rías Baixas har havets smak — perfekt.'
  },
  {
    keywords: ['ostron'],
    intensity: 'light',
    colors: ['white', 'sparkling'],
    grapes: ['Muscadet', 'Chablis', 'Champagne'],
    regions: ['Loire', 'Chablis', 'Champagne'],
    wineStyle: ['stål', 'mineral', 'skarp syra'],
    servingTemp: 'cold',
    tip: 'Muscadet sur lie — kalk möter kalk. Champagne Blanc de Blancs fungerar också magnifikt.'
  },

  // VEGETARIAN
  {
    keywords: ['svamp', 'tryffel', 'kantareller', 'karl-johan'],
    intensity: 'medium',
    colors: ['red', 'white'],
    grapes: ['Pinot Noir', 'Nebbiolo', 'Chardonnay'],
    regions: ['Bourgogne', 'Barolo', 'Oregon'],
    wineStyle: ['jordig', 'komplex', 'mogen'],
    servingTemp: 'cellar',
    tip: 'Svamp och Pinot Noir delar umami och jordighet. Tryffel → Barolo. Kantareller → vit Bourgogne.'
  },
  {
    keywords: ['vegetariskt', 'veganskt', 'grönsaker', 'rotfrukter'],
    intensity: 'light',
    colors: ['white', 'rosé', 'orange'],
    grapes: ['Sauvignon Blanc', 'Grüner Veltliner', 'Pinot Noir', 'Gamay'],
    regions: ['Loire', 'Wachau', 'Beaujolais'],
    wineStyle: ['fräsch', 'örtigt', 'lätt'],
    servingTemp: 'cool',
    tip: 'Matcha vinets intensitet med rättens. Grillade grönsaker → mer kropp. Rå sallad → allra lättaste.'
  },

  // CHEESE
  {
    keywords: ['ost', 'ostbricka', 'ostar'],
    intensity: 'medium',
    colors: ['red', 'white'],
    grapes: ['Riesling', 'Chenin Blanc', 'Pinot Noir', 'Sauternes'],
    regions: ['Alsace', 'Loire', 'Bourgogne', 'Sauternes'],
    wineStyle: ['balanserad', 'fin syra'],
    servingTemp: 'cellar',
    tip: 'Söt+salt-regeln: söt vin + stark ost är fantastiskt. Comté → Jura. Roquefort → Sauternes.'
  },
  {
    keywords: ['getost', 'chèvre'],
    intensity: 'light',
    colors: ['white'],
    grapes: ['Sauvignon Blanc', 'Chenin Blanc'],
    regions: ['Sancerre', 'Loire'],
    wineStyle: ['fräsch', 'syradriven', 'mineralisk'],
    servingTemp: 'cold',
    tip: 'Sancerre och chèvre — samma region, perfekt match. Syra mot fett.'
  },
];

// ═══════════════════════════════════════════
// COOKING METHOD MODIFIERS
// ═══════════════════════════════════════════

export interface CookingMethodModifier {
  keywords: string[];
  /** How this modifies the pairing */
  intensityShift: -1 | 0 | 1;  // lighter, same, heavier
  /** Additional wine preferences */
  preferStyles: string[];
  /** Grapes that work especially well */
  bonusGrapes: string[];
  tip: string;
}

export const COOKING_METHODS: CookingMethodModifier[] = [
  {
    keywords: ['grillat', 'grillad', 'grill', 'bbq'],
    intensityShift: 1,
    preferStyles: ['kraftig', 'rökig', 'fruktdriven'],
    bonusGrapes: ['Malbec', 'Zinfandel', 'Syrah', 'Grenache'],
    tip: 'Grillning ger rökighet och karamellisering → vin med liknande toner.'
  },
  {
    keywords: ['stekt', 'panstekt', 'steka'],
    intensityShift: 0,
    preferStyles: ['fruktig', 'medellång'],
    bonusGrapes: [],
    tip: 'Stekning ger Maillard-reaktion och nötig smak. Smör → fylligare vin.'
  },
  {
    keywords: ['kokt', 'ångkokt', 'pocherad'],
    intensityShift: -1,
    preferStyles: ['fräsch', 'lätt', 'mineralisk'],
    bonusGrapes: ['Muscadet', 'Chablis', 'Albariño'],
    tip: 'Kokt protein är delikat. Välj lättare vin som inte överskuggar.'
  },
  {
    keywords: ['braserat', 'långkokt', 'gryta', 'slow-cooked'],
    intensityShift: 1,
    preferStyles: ['kraftig', 'komplex', 'jordig'],
    bonusGrapes: ['Nebbiolo', 'Syrah', 'Mourvèdre', 'Tempranillo'],
    tip: 'Långkok utvecklar djupa smaker. Kräver vin med komplexitet att matcha.'
  },
  {
    keywords: ['rått', 'tartare', 'ceviche', 'crudo', 'sashimi'],
    intensityShift: -1,
    preferStyles: ['fräsch', 'syradriven', 'citrus'],
    bonusGrapes: ['Albariño', 'Sauvignon Blanc', 'Muscadet', 'Assyrtiko'],
    tip: 'Rå protein behöver syra som kontrast. Citrustoner i vinet förstärker.'
  },
  {
    keywords: ['rökt', 'rökning'],
    intensityShift: 0,
    preferStyles: ['rökig', 'kryddig'],
    bonusGrapes: ['Syrah', 'Pinotage', 'Riesling'],
    tip: 'Rökta rätter fungerar med rökiga viner (Syrah) ELLER kontrasterar med fräsch Riesling.'
  },
  {
    keywords: ['friterad', 'friterat', 'tempura'],
    intensityShift: 0,
    preferStyles: ['fräsch', 'syradriven', 'mousserande'],
    bonusGrapes: ['Champagne', 'Cava', 'Sauvignon Blanc'],
    tip: 'Bubbel och friterat — kolsyra klipper fett. Champagne + pommes frites = oväntad magi.'
  },
];

// ═══════════════════════════════════════════
// SAUCE/PREPARATION MODIFIERS
// ═══════════════════════════════════════════

export interface SauceModifier {
  keywords: string[];
  /** Override colors */
  preferColors: ('red' | 'white' | 'rosé')[];
  bonusGrapes: string[];
  tip: string;
}

export const SAUCE_MODIFIERS: SauceModifier[] = [
  {
    keywords: ['smörsås', 'beurre blanc', 'gräddsås', 'grädde'],
    preferColors: ['white'],
    bonusGrapes: ['Chardonnay', 'Viognier', 'Marsanne'],
    tip: 'Smör och grädde vill ha fyllig vit med liknande textur. Ekad Chardonnay.'
  },
  {
    keywords: ['tomatsås', 'tomat', 'pomodoro', 'arrabbiata'],
    preferColors: ['red'],
    bonusGrapes: ['Sangiovese', 'Barbera', 'Nerello Mascalese'],
    tip: 'Tomatens syra matchar italienska druvor med naturligt hög syra.'
  },
  {
    keywords: ['rödvinssås', 'rödvinsreducering', 'bordelaise'],
    preferColors: ['red'],
    bonusGrapes: ['Cabernet Sauvignon', 'Merlot', 'Syrah'],
    tip: 'Samma druva i glaset som i såsen — matcha vinet med matlagningsvinet.'
  },
  {
    keywords: ['asiatisk sås', 'soja', 'teriyaki', 'miso'],
    preferColors: ['red', 'white'],
    bonusGrapes: ['Pinot Noir', 'Riesling', 'Gamay'],
    tip: 'Umami i soja/miso älskar lätt röd med fin frukt, eller off-dry Riesling.'
  },
  {
    keywords: ['curry', 'kokosmjölk', 'thai', 'indisk'],
    preferColors: ['white'],
    bonusGrapes: ['Gewürztraminer', 'Riesling', 'Torrontés', 'Viognier'],
    tip: 'Hetta och kryddor kräver aromatisk vit med viss sötma. Off-dry Riesling är guldstandard.'
  },
  {
    keywords: ['pesto', 'basilika'],
    preferColors: ['white'],
    bonusGrapes: ['Vermentino', 'Sauvignon Blanc', 'Arneis'],
    tip: 'Pestos örtighet matchar gröna, örtiga vita viner. Ligurisk Vermentino är lokalt val.'
  },
  {
    keywords: ['vitlök', 'aioli', 'vitlökssås'],
    preferColors: ['white', 'rosé'],
    bonusGrapes: ['Albariño', 'Verdejo', 'Vermentino'],
    tip: 'Vitlök förstärker och behöver fräscht vin som balanserar.'
  },
];

// ═══════════════════════════════════════════
// SWEDISH / NORDIC SPECIALTIES
// ═══════════════════════════════════════════

export const NORDIC_DISHES: FoodWineMatch[] = [
  {
    keywords: ['toast skagen', 'skagenröra', 'räksmörgås'],
    intensity: 'light',
    colors: ['white', 'sparkling'],
    grapes: ['Chardonnay', 'Champagne', 'Riesling'],
    regions: ['Bourgogne', 'Champagne', 'Chablis'],
    wineStyle: ['elegant', 'fin syra', 'medelfyllig'],
    servingTemp: 'cold',
    tip: 'Klassisk kombination: fina skaldjur med vit Bourgogne eller Champagne.'
  },
  {
    keywords: ['köttbullar', 'svenska köttbullar'],
    intensity: 'medium',
    colors: ['red'],
    grapes: ['Pinot Noir', 'Gamay', 'Zweigelt'],
    regions: ['Bourgogne', 'Beaujolais', 'Österrike'],
    wineStyle: ['fruktig', 'lätt till medellång'],
    servingTemp: 'cellar',
    tip: 'Lingonsyltens sötma och gräddsåsens fett → medelkroppad röd med bra syra.'
  },
  {
    keywords: ['sill', 'matjessill', 'inlagd sill', 'midsommar'],
    intensity: 'light',
    colors: ['white', 'sparkling'],
    grapes: ['Muscadet', 'Grüner Veltliner', 'Riesling'],
    regions: ['Loire', 'Wachau', 'Mosel'],
    wineStyle: ['fräsch', 'torr', 'mineralisk'],
    servingTemp: 'cold',
    tip: 'Nubbe eller öl är klassiskt, men torr Riesling eller Grüner Veltliner fungerar utmärkt.'
  },
  {
    keywords: ['julbord', 'julmat', 'julskinka'],
    intensity: 'medium',
    colors: ['red', 'white', 'sparkling'],
    grapes: ['Pinot Noir', 'Riesling', 'Gamay', 'Champagne'],
    regions: ['Bourgogne', 'Alsace', 'Beaujolais', 'Champagne'],
    wineStyle: ['mångsidig', 'fin syra', 'fruktig'],
    servingTemp: 'cool',
    tip: 'Julbordets variation kräver mångsidigt vin. Beaujolais cru eller Bourgogne rouge hanterar allt.'
  },
  {
    keywords: ['surströmming'],
    intensity: 'full',
    colors: ['white', 'sparkling'],
    grapes: ['Muscadet', 'Champagne'],
    regions: ['Loire', 'Champagne'],
    wineStyle: ['skarp syra', 'mineralisk'],
    servingTemp: 'cold',
    tip: 'Tunnbrödsrulle med surströmming → iskallt mousserande. Kolsyra tvättar gommen.'
  },
  {
    keywords: ['kräftskiva', 'kräftmingel'],
    intensity: 'light',
    colors: ['white', 'sparkling', 'rosé'],
    grapes: ['Sauvignon Blanc', 'Riesling', 'Cava'],
    regions: ['Sancerre', 'Alsace', 'Penedès'],
    wineStyle: ['fräsch', 'festlig', 'lätt'],
    servingTemp: 'cold',
    tip: 'Kräftskiva handlar om fest och sällskap. Fräsch vit eller bubbel — inte för allvarligt.'
  },
  {
    keywords: ['gravlax', 'dillstuvad', 'dill'],
    intensity: 'light',
    colors: ['white'],
    grapes: ['Riesling', 'Grüner Veltliner', 'Sauvignon Blanc'],
    regions: ['Mosel', 'Wachau', 'Sancerre'],
    wineStyle: ['fräsch', 'örtigt', 'mineralisk'],
    servingTemp: 'cold',
    tip: 'Dill har stark örtsmak som matchar Sauvignon Blancs gröna toner eller Rieslings citrus.'
  },
  {
    keywords: ['janssons frestelse', 'jansson'],
    intensity: 'medium',
    colors: ['white'],
    grapes: ['Chardonnay', 'Chenin Blanc', 'Riesling'],
    regions: ['Bourgogne', 'Loire', 'Alsace'],
    wineStyle: ['medelfyllig', 'fin syra'],
    servingTemp: 'cool',
    tip: 'Grädde + ansjovis = salt och fett. Behöver vin med syra som klipper igenom.'
  },
  {
    keywords: ['älgstek', 'älggryta', 'älg'],
    intensity: 'full',
    colors: ['red'],
    grapes: ['Syrah', 'Nebbiolo', 'Pinot Noir', 'Blaufränkisch'],
    regions: ['Rhône', 'Barolo', 'Bourgogne'],
    wineStyle: ['jordig', 'kryddig', 'komplex'],
    servingTemp: 'room',
    tip: 'Älgkött är magert med viltsmak. Norra Rhône Syrah (svartpeppar) eller mogen Pinot Noir (svamp).'
  },
];

// ═══════════════════════════════════════════
// SEASONAL PAIRING GUIDE
// ═══════════════════════════════════════════

export interface SeasonalGuide {
  season: 'vår' | 'sommar' | 'höst' | 'vinter';
  months: string[];
  preferColors: string[];
  preferStyles: string[];
  typicalDishes: string[];
  grapeHighlights: string[];
  tip: string;
}

export const SEASONAL_GUIDE: SeasonalGuide[] = [
  {
    season: 'vår',
    months: ['mars', 'april', 'maj'],
    preferColors: ['white', 'rosé', 'sparkling'],
    preferStyles: ['fräsch', 'lätt', 'blommig', 'mineralisk'],
    typicalDishes: ['sparris', 'vårlök', 'lammkotlett', 'rödspätta', 'ärtrisotto'],
    grapeHighlights: ['Sauvignon Blanc', 'Grüner Veltliner', 'Gamay', 'Pinot Noir'],
    tip: 'Vår = övergång från tung till lätt. Sparris med Grüner Veltliner är perfekt.'
  },
  {
    season: 'sommar',
    months: ['juni', 'juli', 'augusti'],
    preferColors: ['rosé', 'white', 'sparkling'],
    preferStyles: ['fräsch', 'lätt', 'fruktig', 'iskall'],
    typicalDishes: ['grillat', 'sallad', 'skaldjur', 'kräftor', 'jordgubbar'],
    grapeHighlights: ['Albariño', 'Vermentino', 'Cinsault', 'Grenache'],
    tip: 'Rosé och fräscha vita dominerar. Serveras iskallt. Provence-rosé till grillmiddagar.'
  },
  {
    season: 'höst',
    months: ['september', 'oktober', 'november'],
    preferColors: ['red', 'white', 'orange'],
    preferStyles: ['jordig', 'svampig', 'komplex', 'mogen'],
    typicalDishes: ['svamp', 'vilt', 'tryffel', 'rotfrukter', 'anka'],
    grapeHighlights: ['Pinot Noir', 'Nebbiolo', 'Chardonnay', 'Chenin Blanc'],
    tip: 'Höst = svamp, vilt och tryffel. Bourgogne-säsong — Pinot Noir och Chardonnay.'
  },
  {
    season: 'vinter',
    months: ['december', 'januari', 'februari'],
    preferColors: ['red', 'sparkling'],
    preferStyles: ['kraftig', 'värmande', 'kryddig', 'festlig'],
    typicalDishes: ['julbord', 'braser', 'grytor', 'vilt', 'chokladdesserter'],
    grapeHighlights: ['Syrah', 'Tempranillo', 'Cabernet Sauvignon', 'Champagne'],
    tip: 'Vinter kräver kroppsrika viner. Julbord = mångsidiga viner. Nyår = Champagne.'
  },
];

// ═══════════════════════════════════════════
// LOOKUP FUNCTIONS
// ═══════════════════════════════════════════

/** Find best food-wine pairings for a dish description */
export function findFoodPairings(text: string): FoodWineMatch[] {
  const normalized = text.toLowerCase();
  const matches: FoodWineMatch[] = [];

  // Check protein pairings
  for (const pairing of PROTEIN_PAIRINGS) {
    if (pairing.keywords.some(k => normalized.includes(k))) {
      matches.push(pairing);
    }
  }

  // Check Nordic specialties
  for (const pairing of NORDIC_DISHES) {
    if (pairing.keywords.some(k => normalized.includes(k))) {
      matches.push(pairing);
    }
  }

  return matches;
}

/** Find cooking method modifier */
export function findCookingMethod(text: string): CookingMethodModifier | null {
  const normalized = text.toLowerCase();
  for (const method of COOKING_METHODS) {
    if (method.keywords.some(k => normalized.includes(k))) {
      return method;
    }
  }
  return null;
}

/** Find sauce/preparation modifier */
export function findSauceModifier(text: string): SauceModifier | null {
  const normalized = text.toLowerCase();
  for (const sauce of SAUCE_MODIFIERS) {
    if (sauce.keywords.some(k => normalized.includes(k))) {
      return sauce;
    }
  }
  return null;
}

/** Get current season based on date */
export function getCurrentSeason(): SeasonalGuide {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return SEASONAL_GUIDE[0]; // vår
  if (month >= 5 && month <= 7) return SEASONAL_GUIDE[1]; // sommar
  if (month >= 8 && month <= 10) return SEASONAL_GUIDE[2]; // höst
  return SEASONAL_GUIDE[3]; // vinter
}

/** Get comprehensive pairing advice for a text description */
export function getComprehensivePairing(text: string): {
  foodMatches: FoodWineMatch[];
  cookingMethod: CookingMethodModifier | null;
  sauceModifier: SauceModifier | null;
  season: SeasonalGuide;
  combinedGrapes: string[];
  combinedRegions: string[];
  intensity: 'light' | 'medium' | 'full';
} {
  const foodMatches = findFoodPairings(text);
  const cookingMethod = findCookingMethod(text);
  const sauceModifier = findSauceModifier(text);
  const season = getCurrentSeason();

  // Combine grapes from all sources (deduplicated)
  const grapeSet = new Set<string>();
  for (const match of foodMatches) {
    match.grapes.forEach(g => grapeSet.add(g));
  }
  if (cookingMethod) {
    cookingMethod.bonusGrapes.forEach(g => grapeSet.add(g));
  }
  if (sauceModifier) {
    sauceModifier.bonusGrapes.forEach(g => grapeSet.add(g));
  }

  // Combine regions
  const regionSet = new Set<string>();
  for (const match of foodMatches) {
    match.regions.forEach(r => regionSet.add(r));
  }

  // Calculate effective intensity
  let baseIntensity: number = foodMatches.length > 0
    ? Math.max(...foodMatches.map(m => m.intensity === 'full' ? 3 : m.intensity === 'medium' ? 2 : 1))
    : 2;
  if (cookingMethod) baseIntensity += cookingMethod.intensityShift;
  baseIntensity = Math.max(1, Math.min(3, baseIntensity));

  const intensity: 'light' | 'medium' | 'full' =
    baseIntensity === 1 ? 'light' : baseIntensity === 2 ? 'medium' : 'full';

  return {
    foodMatches,
    cookingMethod,
    sauceModifier,
    season,
    combinedGrapes: Array.from(grapeSet),
    combinedRegions: Array.from(regionSet),
    intensity,
  };
}
