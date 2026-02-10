/**
 * Catalog Agent — Data Enrichment
 *
 * Enriches wine data using lookup tables (free, instant) with AI fallback.
 * Covers: region→country, region→grape, country aliases.
 */

import { RawWineRow } from '../validators/wine-import';
import { EnrichmentResult, EnrichedField } from './types';

// ============================================================================
// Lookup Tables — Region → Country
// ============================================================================

const REGION_TO_COUNTRY: Record<string, string> = {
  // France
  'bordeaux': 'France',
  'bourgogne': 'France',
  'burgundy': 'France',
  'champagne': 'France',
  'alsace': 'France',
  'loire': 'France',
  'vallée de la loire': 'France',
  'rhône': 'France',
  'rhone': 'France',
  'côtes du rhône': 'France',
  'cotes du rhone': 'France',
  'languedoc': 'France',
  'languedoc-roussillon': 'France',
  'roussillon': 'France',
  'provence': 'France',
  'jura': 'France',
  'savoie': 'France',
  'beaujolais': 'France',
  'cahors': 'France',
  'madiran': 'France',
  'bergerac': 'France',
  'sud-ouest': 'France',
  'south west france': 'France',
  'côtes de gascogne': 'France',
  'chablis': 'France',
  'saint-émilion': 'France',
  'pauillac': 'France',
  'margaux': 'France',
  'médoc': 'France',
  'pomerol': 'France',
  'sauternes': 'France',
  'graves': 'France',
  'entre-deux-mers': 'France',
  'côtes de provence': 'France',
  'bandol': 'France',
  'minervois': 'France',
  'corbières': 'France',
  'fitou': 'France',
  'pic saint-loup': 'France',
  'côtes du ventoux': 'France',
  'gigondas': 'France',
  'châteauneuf-du-pape': 'France',
  'chateauneuf-du-pape': 'France',
  'hermitage': 'France',
  'crozes-hermitage': 'France',
  'côte-rôtie': 'France',
  'condrieu': 'France',
  'vouvray': 'France',
  'sancerre': 'France',
  'muscadet': 'France',
  'pouilly-fumé': 'France',
  'meursault': 'France',
  'puligny-montrachet': 'France',
  'gevrey-chambertin': 'France',
  'nuits-saint-georges': 'France',
  'côte de nuits': 'France',
  'côte de beaune': 'France',
  'mâcon': 'France',
  'pouilly-fuissé': 'France',
  'crémant d\'alsace': 'France',
  'crémant de bourgogne': 'France',
  'crémant de loire': 'France',

  // Italy
  'toscana': 'Italy',
  'tuscany': 'Italy',
  'piemonte': 'Italy',
  'piedmont': 'Italy',
  'veneto': 'Italy',
  'sicilia': 'Italy',
  'sicily': 'Italy',
  'sardegna': 'Italy',
  'sardinia': 'Italy',
  'puglia': 'Italy',
  'apulia': 'Italy',
  'campania': 'Italy',
  'abruzzo': 'Italy',
  'umbria': 'Italy',
  'marche': 'Italy',
  'friuli': 'Italy',
  'friuli venezia giulia': 'Italy',
  'trentino': 'Italy',
  'trentino-alto adige': 'Italy',
  'alto adige': 'Italy',
  'südtirol': 'Italy',
  'lombardia': 'Italy',
  'lombardy': 'Italy',
  'emilia-romagna': 'Italy',
  'liguria': 'Italy',
  'basilicata': 'Italy',
  'calabria': 'Italy',
  'molise': 'Italy',
  'valle d\'aosta': 'Italy',
  'chianti': 'Italy',
  'brunello di montalcino': 'Italy',
  'barolo': 'Italy',
  'barbaresco': 'Italy',
  'amarone': 'Italy',
  'valpolicella': 'Italy',
  'soave': 'Italy',
  'prosecco': 'Italy',
  'franciacorta': 'Italy',
  'etna': 'Italy',
  'bolgheri': 'Italy',
  'montalcino': 'Italy',
  'montepulciano': 'Italy',
  'langhe': 'Italy',
  'roero': 'Italy',
  'gavi': 'Italy',
  'asti': 'Italy',

  // Spain
  'rioja': 'Spain',
  'ribera del duero': 'Spain',
  'priorat': 'Spain',
  'penedès': 'Spain',
  'penedes': 'Spain',
  'cava': 'Spain',
  'rueda': 'Spain',
  'rías baixas': 'Spain',
  'rias baixas': 'Spain',
  'galicia': 'Spain',
  'navarra': 'Spain',
  'toro': 'Spain',
  'jumilla': 'Spain',
  'la mancha': 'Spain',
  'valdepeñas': 'Spain',
  'valencia': 'Spain',
  'cataluña': 'Spain',
  'catalunya': 'Spain',
  'castilla y león': 'Spain',
  'castilla-la mancha': 'Spain',
  'andalucía': 'Spain',
  'jerez': 'Spain',
  'sherry': 'Spain',
  'mallorca': 'Spain',
  'bierzo': 'Spain',
  'terra alta': 'Spain',
  'montsant': 'Spain',
  'campo de borja': 'Spain',
  'calatayud': 'Spain',
  'somontano': 'Spain',

  // Germany
  'mosel': 'Germany',
  'rheinhessen': 'Germany',
  'pfalz': 'Germany',
  'rheingau': 'Germany',
  'baden': 'Germany',
  'württemberg': 'Germany',
  'franken': 'Germany',
  'nahe': 'Germany',
  'ahr': 'Germany',

  // Austria
  'wachau': 'Austria',
  'kamptal': 'Austria',
  'kremstal': 'Austria',
  'burgenland': 'Austria',
  'niederösterreich': 'Austria',
  'steiermark': 'Austria',
  'styria': 'Austria',
  'wien': 'Austria',
  'vienna': 'Austria',
  'neusiedlersee': 'Austria',

  // Portugal
  'douro': 'Portugal',
  'porto': 'Portugal',
  'alentejo': 'Portugal',
  'dão': 'Portugal',
  'dao': 'Portugal',
  'bairrada': 'Portugal',
  'vinho verde': 'Portugal',
  'lisboa': 'Portugal',
  'madeira': 'Portugal',
  'setúbal': 'Portugal',

  // South Africa
  'stellenbosch': 'South Africa',
  'swartland': 'South Africa',
  'franschhoek': 'South Africa',
  'paarl': 'South Africa',
  'constantia': 'South Africa',
  'elgin': 'South Africa',
  'walker bay': 'South Africa',
  'western cape': 'South Africa',

  // Argentina
  'mendoza': 'Argentina',
  'salta': 'Argentina',
  'patagonia': 'Argentina',
  'uco valley': 'Argentina',

  // Chile
  'maipo': 'Chile',
  'colchagua': 'Chile',
  'casablanca': 'Chile',
  'rapel': 'Chile',
  'aconcagua': 'Chile',
  'central valley': 'Chile',
  'maule': 'Chile',
  'bío bío': 'Chile',
  'itata': 'Chile',
  'leyda': 'Chile',

  // Australia
  'barossa valley': 'Australia',
  'barossa': 'Australia',
  'mclaren vale': 'Australia',
  'hunter valley': 'Australia',
  'margaret river': 'Australia',
  'yarra valley': 'Australia',
  'clare valley': 'Australia',
  'eden valley': 'Australia',
  'coonawarra': 'Australia',
  'adelaide hills': 'Australia',
  'south australia': 'Australia',

  // New Zealand
  'marlborough': 'New Zealand',
  'central otago': 'New Zealand',
  'hawke\'s bay': 'New Zealand',
  'hawkes bay': 'New Zealand',
  'martinborough': 'New Zealand',
  'wairarapa': 'New Zealand',

  // USA
  'napa valley': 'USA',
  'napa': 'USA',
  'sonoma': 'USA',
  'sonoma coast': 'USA',
  'russian river valley': 'USA',
  'paso robles': 'USA',
  'santa barbara': 'USA',
  'willamette valley': 'USA',
  'oregon': 'USA',
  'washington state': 'USA',
  'columbia valley': 'USA',
  'finger lakes': 'USA',

  // Greece
  'santorini': 'Greece',
  'naoussa': 'Greece',
  'nemea': 'Greece',
  'crete': 'Greece',
  'makedonia': 'Greece',
  'peloponnese': 'Greece',

  // Hungary
  'tokaj': 'Hungary',
  'villány': 'Hungary',
  'eger': 'Hungary',
  'szekszárd': 'Hungary',

  // Lebanon
  'bekaa valley': 'Lebanon',
  'bekaa': 'Lebanon',

  // Georgia
  'kakheti': 'Georgia',
  'kartli': 'Georgia',

  // Others
  'cape town': 'South Africa',
};

// ============================================================================
// Lookup Tables — Region → Typical Grapes
// ============================================================================

const REGION_TO_GRAPES: Record<string, string> = {
  // France
  'champagne': 'Chardonnay, Pinot Noir, Pinot Meunier',
  'chablis': 'Chardonnay',
  'sancerre': 'Sauvignon Blanc',
  'pouilly-fumé': 'Sauvignon Blanc',
  'muscadet': 'Melon de Bourgogne',
  'beaujolais': 'Gamay',
  'cahors': 'Malbec',
  'madiran': 'Tannat',
  'condrieu': 'Viognier',
  'vouvray': 'Chenin Blanc',

  // Italy
  'barolo': 'Nebbiolo',
  'barbaresco': 'Nebbiolo',
  'brunello di montalcino': 'Sangiovese',
  'chianti': 'Sangiovese',
  'valpolicella': 'Corvina, Rondinella, Molinara',
  'amarone': 'Corvina, Rondinella, Molinara',
  'soave': 'Garganega',
  'prosecco': 'Glera',
  'franciacorta': 'Chardonnay, Pinot Noir',
  'gavi': 'Cortese',

  // Spain
  'cava': 'Macabeo, Parellada, Xarel·lo',
  'rueda': 'Verdejo',
  'rías baixas': 'Albariño',
  'rias baixas': 'Albariño',
  'jerez': 'Palomino Fino',

  // Germany
  'mosel': 'Riesling',
  'rheingau': 'Riesling',

  // Argentina
  'mendoza': 'Malbec',

  // New Zealand
  'marlborough': 'Sauvignon Blanc',
  'central otago': 'Pinot Noir',

  // South Africa
  'stellenbosch': 'Cabernet Sauvignon, Chenin Blanc',
  'swartland': 'Chenin Blanc, Syrah',
};

// ============================================================================
// Lookup Tables — Country Aliases (multi-language)
// ============================================================================

const COUNTRY_ALIASES: Record<string, string> = {
  // French
  'italie': 'Italy',
  'espagne': 'Spain',
  'allemagne': 'Germany',
  'autriche': 'Austria',
  'afrique du sud': 'South Africa',
  'nouvelle-zélande': 'New Zealand',
  'états-unis': 'USA',
  'grèce': 'Greece',
  'hongrie': 'Hungary',
  'liban': 'Lebanon',
  'géorgie': 'Georgia',
  'chili': 'Chile',
  'argentine': 'Argentina',
  'australie': 'Australia',

  // German
  'frankreich': 'France',
  'italien': 'Italy',
  'spanien': 'Spain',
  'deutschland': 'Germany',
  'österreich': 'Austria',
  'südafrika': 'South Africa',
  'neuseeland': 'New Zealand',
  'griechenland': 'Greece',
  'ungarn': 'Hungary',
  'libanon': 'Lebanon',
  'georgien': 'Georgia',
  'argentinien': 'Argentina',
  'australien': 'Australia',

  // Swedish (unique entries not already covered by German)
  'frankrike': 'France',
  'tyskland': 'Germany',
  'sydafrika': 'South Africa',
  'nya zeeland': 'New Zealand',
  'grekland': 'Greece',
  'ungern': 'Hungary',

  // English variants
  'united states': 'USA',
  'us': 'USA',
  'u.s.a.': 'USA',
  'united kingdom': 'United Kingdom',
  'uk': 'United Kingdom',
  'south africa': 'South Africa',
  'new zealand': 'New Zealand',

  // Italian
  'francia': 'France',
  'spagna': 'Spain',
  'germania': 'Germany',
  'portogallo': 'Portugal',

  // Portuguese
  'espanha': 'Spain',
  'alemanha': 'Germany',

  // Direct (English)
  'france': 'France',
  'italy': 'Italy',
  'spain': 'Spain',
  'germany': 'Germany',
  'austria': 'Austria',
  'portugal': 'Portugal',
  'argentina': 'Argentina',
  'chile': 'Chile',
  'australia': 'Australia',
  'usa': 'USA',
  'greece': 'Greece',
  'hungary': 'Hungary',
  'lebanon': 'Lebanon',
  'georgia': 'Georgia',
  'croatia': 'Croatia',
  'slovenia': 'Slovenia',
  'switzerland': 'Switzerland',
  'israel': 'Israel',
  'turkey': 'Turkey',
  'morocco': 'Morocco',
};

// ============================================================================
// Enrichment Functions
// ============================================================================

/**
 * Normalize country name through alias table
 */
export function normalizeCountry(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const normalized = input.toLowerCase().trim();
  return COUNTRY_ALIASES[normalized] || undefined;
}

/**
 * Lookup country from region
 */
export function lookupCountryFromRegion(region: string | undefined): string | undefined {
  if (!region) return undefined;
  const normalized = region.toLowerCase().trim();
  return REGION_TO_COUNTRY[normalized] || undefined;
}

/**
 * Lookup typical grapes from region
 */
export function lookupGrapesFromRegion(region: string | undefined): string | undefined {
  if (!region) return undefined;
  const normalized = region.toLowerCase().trim();
  return REGION_TO_GRAPES[normalized] || undefined;
}

/**
 * Enrich a batch of wine rows using lookup tables.
 * Returns enrichment results only for rows that were actually enriched.
 */
export function enrichWineRows(rows: RawWineRow[]): EnrichmentResult[] {
  const results: EnrichmentResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const enrichedFields: EnrichedField[] = [];

    // 1. Normalize country alias
    if (row.country) {
      const normalized = normalizeCountry(row.country);
      if (normalized && normalized !== row.country) {
        enrichedFields.push({
          field: 'country',
          originalValue: row.country,
          enrichedValue: normalized,
          source: 'lookup',
          confidence: 1.0,
        });
        row.country = normalized;
      }
    }

    // 2. Enrich country from region (if country is missing)
    if (!row.country && row.region) {
      const country = lookupCountryFromRegion(row.region);
      if (country) {
        enrichedFields.push({
          field: 'country',
          originalValue: undefined,
          enrichedValue: country,
          source: 'lookup',
          confidence: 0.95,
        });
        row.country = country;
      }
    }

    // 3. Enrich grape from region (if grape is missing)
    if (!row.grape && row.region) {
      const grapes = lookupGrapesFromRegion(row.region);
      if (grapes) {
        enrichedFields.push({
          field: 'grape',
          originalValue: undefined,
          enrichedValue: grapes,
          source: 'lookup',
          confidence: 0.7, // Lower confidence — typical != guaranteed
        });
        row.grape = grapes;
      }
    }

    // 4. Enrich grape from appellation (if grape is still missing)
    if (!row.grape && row.appellation) {
      const grapes = lookupGrapesFromRegion(row.appellation);
      if (grapes) {
        enrichedFields.push({
          field: 'grape',
          originalValue: undefined,
          enrichedValue: grapes,
          source: 'lookup',
          confidence: 0.75,
        });
        row.grape = grapes;
      }
    }

    if (enrichedFields.length > 0) {
      results.push({ rowIndex: i, enrichedFields });
    }
  }

  return results;
}
