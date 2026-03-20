/**
 * Matching Agent — Cuisine Profiles
 *
 * Maps restaurant cuisine types to wine preferences.
 * Used as a soft boost (0-8) in pre-scoring — never penalizes,
 * only rewards wines that naturally match the restaurant's identity.
 *
 * Keys are lowercase and include both Swedish and English variants.
 * cuisine_type from the DB is string[] so we check each element.
 */

export interface CuisineWineProfile {
  preferred_countries: string[];    // Country names matching DB format
  preferred_regions: string[];      // Key regions
  preferred_grapes: string[];       // Signature grapes
  preferred_colors: string[];       // Typical wine colors
  preferred_style: {
    body: ('light' | 'medium' | 'full')[];
    tannin: ('low' | 'medium' | 'high')[];
    acidity: ('low' | 'medium' | 'high')[];
  };
}

/**
 * Cuisine → wine preference map.
 * All keys are lowercase. Both Swedish and English variants map
 * to the same profile object for deduplication.
 */
export const CUISINE_PROFILES: Record<string, CuisineWineProfile> = {};

// --------------------------------------------------------------------------
// Helper: register a profile under multiple keys
// --------------------------------------------------------------------------
function register(keys: string[], profile: CuisineWineProfile): void {
  for (const key of keys) {
    CUISINE_PROFILES[key.toLowerCase()] = profile;
  }
}

// ==========================================================================
// Italian
// ==========================================================================
const ITALIAN: CuisineWineProfile = {
  preferred_countries: ['Italy'],
  preferred_regions: ['toscana', 'piemonte', 'veneto', 'sicilia', 'puglia', 'campania', 'friuli', 'alto adige', 'umbria'],
  preferred_grapes: ['Sangiovese', 'Nebbiolo', 'Vermentino', 'Barbera', 'Primitivo', 'Nero d\'Avola', 'Trebbiano', 'Garganega', 'Pinot Grigio', 'Glera'],
  preferred_colors: ['red', 'white', 'sparkling'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['italiensk', 'italian', 'italienskt', 'italia'], ITALIAN);

// ==========================================================================
// French
// ==========================================================================
const FRENCH: CuisineWineProfile = {
  preferred_countries: ['France'],
  preferred_regions: ['bordeaux', 'bourgogne', 'rhône', 'loire', 'champagne', 'alsace', 'languedoc', 'provence', 'beaujolais'],
  preferred_grapes: ['Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Chardonnay', 'Syrah', 'Grenache', 'Chenin Blanc', 'Sauvignon Blanc', 'Gamay'],
  preferred_colors: ['red', 'white', 'sparkling'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['fransk', 'french', 'franskt'], FRENCH);

// ==========================================================================
// Spanish
// ==========================================================================
const SPANISH: CuisineWineProfile = {
  preferred_countries: ['Spain'],
  preferred_regions: ['rioja', 'ribera del duero', 'rías baixas', 'priorat', 'rueda', 'penedès', 'jumilla', 'toro'],
  preferred_grapes: ['Tempranillo', 'Garnacha', 'Albariño', 'Verdejo', 'Monastrell', 'Bobal', 'Cariñena'],
  preferred_colors: ['red', 'white', 'rose'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['spansk', 'spanish', 'spanskt'], SPANISH);

// ==========================================================================
// Nordic / Scandinavian
// ==========================================================================
const NORDIC: CuisineWineProfile = {
  preferred_countries: ['France', 'Germany', 'Austria'],
  preferred_regions: ['bourgogne', 'loire', 'champagne', 'mosel', 'rheingau', 'wachau', 'alsace', 'beaujolais'],
  preferred_grapes: ['Riesling', 'Pinot Noir', 'Chardonnay', 'Grüner Veltliner', 'Gamay', 'Chenin Blanc', 'Sauvignon Blanc'],
  preferred_colors: ['white', 'red', 'sparkling'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low', 'medium'],
    acidity: ['medium', 'high'],
  },
};
register(['nordisk', 'nordic', 'skandinavisk', 'scandinavian', 'nordiskt', 'skandinaviskt', 'swedish', 'svensk', 'svenskt'], NORDIC);

// ==========================================================================
// Japanese
// ==========================================================================
const JAPANESE: CuisineWineProfile = {
  preferred_countries: ['France', 'Germany', 'Austria', 'Japan'],
  preferred_regions: ['champagne', 'bourgogne', 'mosel', 'alsace', 'wachau', 'loire'],
  preferred_grapes: ['Riesling', 'Grüner Veltliner', 'Pinot Noir', 'Chardonnay', 'Gamay', 'Koshu'],
  preferred_colors: ['white', 'sparkling', 'red'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low', 'medium'],
    acidity: ['medium', 'high'],
  },
};
register(['japansk', 'japanese', 'japanskt', 'sushi', 'izakaya', 'omakase'], JAPANESE);

// ==========================================================================
// Korean
// ==========================================================================
const KOREAN: CuisineWineProfile = {
  preferred_countries: ['France', 'Germany', 'Austria'],
  preferred_regions: ['alsace', 'mosel', 'beaujolais', 'champagne', 'rheingau'],
  preferred_grapes: ['Riesling', 'Gewürztraminer', 'Gamay', 'Pinot Noir', 'Chenin Blanc'],
  preferred_colors: ['white', 'sparkling', 'red'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low', 'medium'],
    acidity: ['medium', 'high'],
  },
};
register(['koreansk', 'korean', 'koreanskt'], KOREAN);

// ==========================================================================
// Thai
// ==========================================================================
const THAI: CuisineWineProfile = {
  preferred_countries: ['Germany', 'France', 'Austria', 'Argentina'],
  preferred_regions: ['alsace', 'mosel', 'loire', 'rheingau'],
  preferred_grapes: ['Riesling', 'Gewürztraminer', 'Torrontés', 'Chenin Blanc', 'Sauvignon Blanc'],
  preferred_colors: ['white', 'sparkling', 'rose'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low'],
    acidity: ['medium', 'high'],
  },
};
register(['thai', 'thailändskt', 'thailändsk'], THAI);

// ==========================================================================
// Chinese
// ==========================================================================
const CHINESE: CuisineWineProfile = {
  preferred_countries: ['France', 'Germany', 'Italy'],
  preferred_regions: ['champagne', 'alsace', 'bourgogne', 'mosel'],
  preferred_grapes: ['Riesling', 'Pinot Noir', 'Chardonnay', 'Gewürztraminer', 'Gamay'],
  preferred_colors: ['white', 'red', 'sparkling'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low', 'medium'],
    acidity: ['medium', 'high'],
  },
};
register(['kinesisk', 'chinese', 'kinesiskt'], CHINESE);

// ==========================================================================
// Indian
// ==========================================================================
const INDIAN: CuisineWineProfile = {
  preferred_countries: ['Germany', 'France', 'South Africa'],
  preferred_regions: ['alsace', 'mosel', 'loire', 'rheingau', 'stellenbosch'],
  preferred_grapes: ['Gewürztraminer', 'Riesling', 'Chenin Blanc', 'Viognier', 'Torrontés'],
  preferred_colors: ['white', 'rose'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low'],
    acidity: ['medium', 'high'],
  },
};
register(['indisk', 'indian', 'indiskt'], INDIAN);

// ==========================================================================
// Middle Eastern / Lebanese / Turkish
// ==========================================================================
const MIDDLE_EASTERN: CuisineWineProfile = {
  preferred_countries: ['France', 'Lebanon', 'Greece', 'Turkey'],
  preferred_regions: ['rhône', 'languedoc', 'provence', 'bekaa valley', 'naoussa', 'santorini'],
  preferred_grapes: ['Syrah', 'Grenache', 'Mourvèdre', 'Cinsault', 'Assyrtiko', 'Xinomavro'],
  preferred_colors: ['red', 'rose', 'white'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['mellanöstern', 'middle eastern', 'libanesisk', 'lebanese', 'turkisk', 'turkish', 'libanesiskt', 'turkiskt', 'arabisk', 'arabiskt'], MIDDLE_EASTERN);

// ==========================================================================
// Mexican
// ==========================================================================
const MEXICAN: CuisineWineProfile = {
  preferred_countries: ['Argentina', 'Spain', 'France'],
  preferred_regions: ['mendoza', 'rioja', 'rías baixas', 'provence', 'languedoc'],
  preferred_grapes: ['Malbec', 'Tempranillo', 'Albariño', 'Grenache', 'Verdejo'],
  preferred_colors: ['red', 'rose', 'white'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['mexikansk', 'mexican', 'mexikanskt'], MEXICAN);

// ==========================================================================
// American
// ==========================================================================
const AMERICAN: CuisineWineProfile = {
  preferred_countries: ['USA', 'United States'],
  preferred_regions: ['napa valley', 'sonoma', 'willamette valley', 'washington state', 'paso robles'],
  preferred_grapes: ['Cabernet Sauvignon', 'Zinfandel', 'Chardonnay', 'Pinot Noir', 'Merlot'],
  preferred_colors: ['red', 'white'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium'],
  },
};
register(['amerikansk', 'american', 'amerikanskt'], AMERICAN);

// ==========================================================================
// Bistro / Brasserie
// ==========================================================================
const BISTRO: CuisineWineProfile = {
  preferred_countries: ['France'],
  preferred_regions: ['beaujolais', 'loire', 'bourgogne', 'rhône', 'languedoc', 'alsace'],
  preferred_grapes: ['Gamay', 'Chenin Blanc', 'Pinot Noir', 'Chardonnay', 'Cabernet Franc', 'Syrah'],
  preferred_colors: ['red', 'white'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low', 'medium'],
    acidity: ['medium', 'high'],
  },
};
register(['bistro', 'brasserie', 'brasseri'], BISTRO);

// ==========================================================================
// Steakhouse
// ==========================================================================
const STEAKHOUSE: CuisineWineProfile = {
  preferred_countries: ['France', 'Argentina', 'Italy', 'USA', 'United States', 'Australia'],
  preferred_regions: ['bordeaux', 'mendoza', 'barolo', 'napa valley', 'barossa', 'ribera del duero'],
  preferred_grapes: ['Cabernet Sauvignon', 'Malbec', 'Nebbiolo', 'Tempranillo', 'Shiraz', 'Zinfandel'],
  preferred_colors: ['red'],
  preferred_style: {
    body: ['full'],
    tannin: ['medium', 'high'],
    acidity: ['medium'],
  },
};
register(['steakhouse', 'köttrestaurang'], STEAKHOUSE);

// ==========================================================================
// Vegetarian
// ==========================================================================
const VEGETARIAN: CuisineWineProfile = {
  preferred_countries: ['France', 'Italy', 'Germany', 'Austria'],
  preferred_regions: ['loire', 'alsace', 'alto adige', 'friuli', 'mosel', 'bourgogne', 'beaujolais'],
  preferred_grapes: ['Chenin Blanc', 'Riesling', 'Sauvignon Blanc', 'Pinot Grigio', 'Gamay', 'Pinot Noir', 'Grüner Veltliner'],
  preferred_colors: ['white', 'red', 'orange'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low', 'medium'],
    acidity: ['medium', 'high'],
  },
};
register(['vegetarisk', 'vegetarian', 'vegetariskt', 'vegan', 'vegansk', 'veganskt'], VEGETARIAN);

// ==========================================================================
// Seafood / Fish
// ==========================================================================
const SEAFOOD: CuisineWineProfile = {
  preferred_countries: ['France', 'Spain', 'Portugal', 'Italy'],
  preferred_regions: ['chablis', 'muscadet', 'rías baixas', 'vinho verde', 'champagne', 'sancerre', 'friuli'],
  preferred_grapes: ['Chardonnay', 'Muscadet', 'Albariño', 'Alvarinho', 'Sauvignon Blanc', 'Vermentino', 'Picpoul'],
  preferred_colors: ['white', 'sparkling'],
  preferred_style: {
    body: ['light', 'medium'],
    tannin: ['low'],
    acidity: ['medium', 'high'],
  },
};
register(['seafood', 'fisk', 'fiskrestaurang', 'skaldjur'], SEAFOOD);

// ==========================================================================
// Greek
// ==========================================================================
const GREEK: CuisineWineProfile = {
  preferred_countries: ['Greece'],
  preferred_regions: ['santorini', 'naoussa', 'nemea', 'crete', 'macedonia'],
  preferred_grapes: ['Assyrtiko', 'Xinomavro', 'Agiorgitiko', 'Moschofilero', 'Malagousia'],
  preferred_colors: ['white', 'red', 'rose'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['grekisk', 'greek', 'grekiskt'], GREEK);

// ==========================================================================
// Portuguese
// ==========================================================================
const PORTUGUESE: CuisineWineProfile = {
  preferred_countries: ['Portugal'],
  preferred_regions: ['douro', 'alentejo', 'dão', 'vinho verde', 'bairrada'],
  preferred_grapes: ['Touriga Nacional', 'Alvarinho', 'Baga', 'Castelão', 'Encruzado'],
  preferred_colors: ['red', 'white'],
  preferred_style: {
    body: ['medium', 'full'],
    tannin: ['medium', 'high'],
    acidity: ['medium', 'high'],
  },
};
register(['portugisisk', 'portuguese', 'portugisiskt'], PORTUGUESE);


// ==========================================================================
// Lookup helper
// ==========================================================================

/**
 * Parse cuisine types from a restaurant context string.
 * The context format from buildSommelierContext() includes "Kök: Italian, Nordic".
 * Returns an empty array if no cuisine is found.
 */
export function parseCuisineFromContext(restaurantContext: string | undefined): string[] {
  if (!restaurantContext) return [];

  // Match "Kök: X, Y, Z" pattern from formatPromptContext()
  const match = restaurantContext.match(/Kök:\s*([^.]+)/i);
  if (!match) return [];

  return match[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Look up a cuisine profile by name (case-insensitive).
 * Returns null if no profile matches.
 */
export function getCuisineProfile(cuisineType: string): CuisineWineProfile | null {
  return CUISINE_PROFILES[cuisineType.toLowerCase()] ?? null;
}

/**
 * Look up profiles for an array of cuisine types (as stored in DB).
 * Merges all matching profiles into a single combined profile.
 * Returns null if no cuisine types match.
 */
export function getMergedCuisineProfile(cuisineTypes: string[]): CuisineWineProfile | null {
  const profiles = cuisineTypes
    .map(ct => getCuisineProfile(ct))
    .filter((p): p is CuisineWineProfile => p !== null);

  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];

  // Merge: union all arrays, deduplicate
  const unique = <T>(arr: T[]) => [...new Set(arr)];
  return {
    preferred_countries: unique(profiles.flatMap(p => p.preferred_countries)),
    preferred_regions: unique(profiles.flatMap(p => p.preferred_regions)),
    preferred_grapes: unique(profiles.flatMap(p => p.preferred_grapes)),
    preferred_colors: unique(profiles.flatMap(p => p.preferred_colors)),
    preferred_style: {
      body: unique(profiles.flatMap(p => p.preferred_style.body)),
      tannin: unique(profiles.flatMap(p => p.preferred_style.tannin)),
      acidity: unique(profiles.flatMap(p => p.preferred_style.acidity)),
    },
  };
}
