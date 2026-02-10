/**
 * WINE KNOWLEDGE BASE — Index & Aggregation
 *
 * Exposes all knowledge modules through unified lookup functions.
 * Used by pipeline steps to enrich scoring and AI prompts.
 */

// Re-export all modules
export { GRAPE_ENCYCLOPEDIA, findGrape, grapesForFood, grapesForRegion, grapeSimilarity } from './grapes';
export type { GrapeProfile } from './grapes';

export { REGION_HIERARCHY, getRegionsForCountry, findRegion, findSubRegion, isRegionRelated, getCountryForRegion } from './regions';
export type { WineRegion, SubRegion } from './regions';

export {
  PROTEIN_PAIRINGS, COOKING_METHODS, SAUCE_MODIFIERS, NORDIC_DISHES, SEASONAL_GUIDE,
  findFoodPairings, findCookingMethod, findSauceModifier, getCurrentSeason, getComprehensivePairing
} from './food-matrix';
export type { FoodWineMatch, CookingMethodModifier, SauceModifier, SeasonalGuide } from './food-matrix';

import { findGrape, grapesForFood, type GrapeProfile } from './grapes';
import { findRegion, getCountryForRegion, type WineRegion } from './regions';
import { getComprehensivePairing, getCurrentSeason } from './food-matrix';

// ═══════════════════════════════════════════
// UNIFIED KNOWLEDGE LOOKUP
// ═══════════════════════════════════════════

export interface WineKnowledgeContext {
  /** Grape profiles for mentioned grapes */
  grapeProfiles: GrapeProfile[];
  /** Region info for mentioned regions */
  regionInfo: WineRegion[];
  /** Food pairing analysis */
  foodAnalysis: ReturnType<typeof getComprehensivePairing> | null;
  /** Current season */
  season: ReturnType<typeof getCurrentSeason>;
  /** Formatted knowledge summary for AI prompt injection */
  promptContext: string;
}

/**
 * Build a comprehensive knowledge context for a matching request.
 * Used to inject relevant domain knowledge into the AI re-ranking prompt.
 */
export function buildKnowledgeContext(params: {
  grapes?: string[];
  regions?: string[];
  countries?: string[];
  foodDescription?: string;
  wineColor?: string;
}): WineKnowledgeContext {
  const { grapes = [], regions = [], countries = [], foodDescription } = params;

  // Resolve grape profiles
  const grapeProfiles: GrapeProfile[] = [];
  for (const grape of grapes) {
    const profile = findGrape(grape);
    if (profile) grapeProfiles.push(profile);
  }

  // Resolve region info
  const regionInfo: WineRegion[] = [];
  for (const region of regions) {
    const info = findRegion(region);
    if (info && !regionInfo.some(r => r.name === info.name)) {
      regionInfo.push(info);
    }
  }

  // Food analysis
  const foodAnalysis = foodDescription
    ? getComprehensivePairing(foodDescription)
    : null;

  const season = getCurrentSeason();

  // Build prompt context string
  const promptParts: string[] = [];

  // Grape knowledge
  if (grapeProfiles.length > 0) {
    promptParts.push('DRUVKUNSKAP:');
    for (const grape of grapeProfiles.slice(0, 5)) {
      promptParts.push(
        `- ${grape.name}: ${grape.description} ` +
        `Kropp ${grape.body}/5, tannin ${grape.tannin}/5, syra ${grape.acidity}/5. ` +
        `Frukt: ${grape.fruitProfile.slice(0, 3).join(', ')}. ` +
        `Serveras ${grape.servingTempC[0]}-${grape.servingTempC[1]}°C.`
      );
    }
  }

  // Region knowledge
  if (regionInfo.length > 0) {
    promptParts.push('REGIONKUNSKAP:');
    for (const region of regionInfo.slice(0, 3)) {
      promptParts.push(
        `- ${region.name} (${region.country}): ${region.climate}. ` +
        `Druvor: ${region.grapes.slice(0, 4).join(', ')}. ` +
        `Stilar: ${region.styles.join(', ')}.`
      );
      if (region.subRegions.length > 0) {
        const subs = region.subRegions.slice(0, 3).map(s =>
          `${s.name} (${s.style}, ${s.priceTier})`
        );
        promptParts.push(`  Subregioner: ${subs.join(', ')}`);
      }
    }
  }

  // Food pairing knowledge
  if (foodAnalysis && foodAnalysis.foodMatches.length > 0) {
    promptParts.push('MATPAIRINGSANALYS:');
    promptParts.push(`Intensitet: ${foodAnalysis.intensity}`);
    for (const match of foodAnalysis.foodMatches.slice(0, 3)) {
      promptParts.push(`- ${match.tip}`);
    }
    if (foodAnalysis.cookingMethod) {
      promptParts.push(`Tillagning: ${foodAnalysis.cookingMethod.tip}`);
    }
    if (foodAnalysis.sauceModifier) {
      promptParts.push(`Sås: ${foodAnalysis.sauceModifier.tip}`);
    }
    if (foodAnalysis.combinedGrapes.length > 0) {
      promptParts.push(`Rekommenderade druvor: ${foodAnalysis.combinedGrapes.slice(0, 6).join(', ')}`);
    }
  }

  // Season
  promptParts.push(`SÄSONG: ${season.season} — ${season.tip}`);

  return {
    grapeProfiles,
    regionInfo,
    foodAnalysis,
    season,
    promptContext: promptParts.join('\n'),
  };
}

/**
 * Get serving recommendation for a wine based on grape knowledge.
 */
export function getServingRecommendation(grapeName: string): {
  tempRange: [number, number];
  decanting: string;
  agingPotential: string;
} | null {
  const grape = findGrape(grapeName);
  if (!grape) return null;
  return {
    tempRange: grape.servingTempC,
    decanting: grape.decanting,
    agingPotential: grape.agingPotential,
  };
}

/**
 * Score how well a wine's grape matches a food description (0-1).
 * Uses the knowledge base for intelligent matching.
 */
export function scoreFoodGrapeAffinity(grapeName: string, foodText: string): number {
  const grape = findGrape(grapeName);
  if (!grape) return 0.3; // Unknown grape = neutral

  const normalized = foodText.toLowerCase();

  // Direct food affinity match
  const directMatch = grape.foodAffinities.some(f =>
    normalized.includes(f.toLowerCase())
  );
  if (directMatch) return 1.0;

  // Check if any recommended grapes for this food match
  const pairing = getComprehensivePairing(foodText);
  if (pairing.combinedGrapes.includes(grape.name)) return 0.9;

  // Check intensity match
  const intensityMap = { 'light': 2, 'medium': 3, 'full': 4 };
  const targetBody = intensityMap[pairing.intensity] || 3;
  const bodyDiff = Math.abs(grape.body - targetBody);
  if (bodyDiff === 0) return 0.6;
  if (bodyDiff === 1) return 0.4;

  return 0.2;
}
