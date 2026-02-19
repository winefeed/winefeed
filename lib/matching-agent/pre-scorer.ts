/**
 * Matching Agent — Deterministic Pre-Scorer
 *
 * Scores each wine 0-100 without AI, based on:
 * - Price proximity to budget (0-25)
 * - Color match (0-20)
 * - Region/country match (0-20)
 * - Grape match (0-15)
 * - Food pairing compatibility (0-10)
 * - Availability/stock (0-10)
 *
 * Runs in <5ms for 100 wines. Sorts and returns top N for AI re-ranking.
 */

import { SupplierWineRow, MergedPreferences, StructuredFilters, ScoredWine, ScoreBreakdown } from './types';
import { lookupCountryFromRegion } from '../catalog-agent/enrichment';
import { FOOD_TO_WINE_STYLES } from './food-pairing';
import { findGrape, isRegionRelated } from './knowledge';

/**
 * Score and sort wines. Returns top N by score.
 */
export function preScoreWines(
  wines: SupplierWineRow[],
  preferences: MergedPreferences,
  structuredFilters: StructuredFilters,
  topN: number,
): ScoredWine[] {
  const scored: ScoredWine[] = wines.map(wine => {
    const breakdown = scoreWine(wine, preferences, structuredFilters);
    const score = breakdown.price + breakdown.color + breakdown.region + breakdown.grape + breakdown.food + breakdown.availability + breakdown.certification;
    return { wine, score, breakdown };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

function scoreWine(
  wine: SupplierWineRow,
  prefs: MergedPreferences,
  filters: StructuredFilters,
): ScoreBreakdown {
  return {
    price: scorePrice(wine, filters),
    color: scoreColor(wine, prefs, filters),
    region: scoreRegion(wine, prefs),
    grape: scoreGrape(wine, prefs),
    food: scoreFood(wine, prefs),
    availability: scoreAvailability(wine),
    certification: scoreCertification(wine, prefs),
  };
}

// ============================================================================
// Price scoring (0-25)
// ============================================================================

function scorePrice(wine: SupplierWineRow, filters: StructuredFilters): number {
  const budgetMax = filters.budget_max;
  if (!budgetMax) return 15; // No budget = neutral score

  const priceSek = wine.price_ex_vat_sek / 100; // Convert öre to SEK
  const ratio = priceSek / budgetMax;

  // Under budget is good for restaurants (better value)
  if (ratio <= 0.5) return 15;   // Way under budget — decent but maybe too cheap
  if (ratio <= 0.8) return 22;   // Nice sweet spot — good value
  if (ratio <= 0.9) return 25;   // Just under budget — perfect
  if (ratio <= 1.0) return 25;   // At budget — perfect
  if (ratio <= 1.1) return 20;   // Slightly over — acceptable
  if (ratio <= 1.2) return 15;   // 20% over — stretch
  if (ratio <= 1.3) return 10;   // 30% over — max tolerance
  return 0;                       // Over 30% — too expensive
}

// ============================================================================
// Color scoring (0-20)
// ============================================================================

function scoreColor(wine: SupplierWineRow, prefs: MergedPreferences, filters: StructuredFilters): number {
  // If user explicitly selected color via UI chip, that's the strongest signal
  if (filters.color && filters.color !== 'all') {
    return wine.color === filters.color ? 20 : 0;
  }

  // If preferences imply color(s)
  if (prefs.colors.length > 0) {
    if (prefs.colors.includes(wine.color || '')) return 20;
    return 0; // Color mismatch is significant
  }

  // No color preference — neutral
  return 15;
}

// ============================================================================
// Region/country scoring (0-20)
// ============================================================================

function scoreRegion(wine: SupplierWineRow, prefs: MergedPreferences): number {
  let score = 0;

  // Country match
  if (prefs.countries.length > 0) {
    const wineCountryLower = (wine.country || '').toLowerCase();
    const countryMatch = prefs.countries.some(c => c.toLowerCase() === wineCountryLower);
    if (countryMatch) {
      score += 15;
    }
  }

  // Region match (bonus on top of country)
  if (prefs.regions.length > 0 && wine.region) {
    const wineRegionLower = wine.region.toLowerCase();
    const regionMatch = prefs.regions.some(r => wineRegionLower.includes(r.toLowerCase()));
    if (regionMatch) {
      score = 20; // Region match is strongest — overrides country-only score
    }
  }

  // Knowledge base: check subregion relationships
  if (score < 15 && prefs.regions.length > 0 && wine.region) {
    const subMatch = prefs.regions.some(r => isRegionRelated(r, wine.region || ''));
    if (subMatch) score = Math.max(score, 15);
  }

  // If wine's region is in a preferred country (indirect match)
  if (score === 0 && prefs.countries.length > 0 && wine.region) {
    const regionCountry = lookupCountryFromRegion(wine.region);
    if (regionCountry && prefs.countries.some(c => c.toLowerCase() === regionCountry.toLowerCase())) {
      score = 10;
    }
  }

  // No country/region preferences — neutral
  if (prefs.countries.length === 0 && prefs.regions.length === 0) {
    score = 10;
  }

  return Math.min(score, 20);
}

// ============================================================================
// Grape scoring (0-15)
// ============================================================================

function scoreGrape(wine: SupplierWineRow, prefs: MergedPreferences): number {
  if (prefs.grapes.length === 0) return 8; // No grape pref — neutral

  if (!wine.grape) return 3; // No grape data — low but not zero

  const wineGrapeLower = wine.grape.toLowerCase();

  // Exact match (grape contains preferred grape name)
  const exactMatch = prefs.grapes.some(g => wineGrapeLower.includes(g.toLowerCase()));
  if (exactMatch) return 15;

  // Check if wine grape appears in any preferred grape (reverse check)
  const reverseMatch = prefs.grapes.some(g => g.toLowerCase().includes(wineGrapeLower));
  if (reverseMatch) return 12;

  // Knowledge base: check synonym match (e.g., Shiraz = Syrah)
  const wineGrapeProfile = findGrape(wine.grape);
  if (wineGrapeProfile) {
    for (const prefGrape of prefs.grapes) {
      const prefProfile = findGrape(prefGrape);
      if (prefProfile && prefProfile.name === wineGrapeProfile.name) {
        return 15; // Same grape via synonym
      }
    }
  }

  return 0;
}

// ============================================================================
// Food pairing scoring (0-10)
// ============================================================================

function scoreFood(wine: SupplierWineRow, prefs: MergedPreferences): number {
  if (prefs.food_pairing.length === 0) return 5; // No food context — neutral

  let score = 0;

  for (const food of prefs.food_pairing) {
    const foodPref = FOOD_TO_WINE_STYLES[food.toLowerCase()];
    if (!foodPref) {
      // Fallback: use knowledge base grape food affinities
      if (wine.grape) {
        const grapeProfile = findGrape(wine.grape);
        if (grapeProfile) {
          const foodLower = food.toLowerCase();
          if (grapeProfile.foodAffinities.some(f => foodLower.includes(f.toLowerCase()) || f.toLowerCase().includes(foodLower))) {
            score += 6; // Direct grape-food affinity from knowledge base
          }
        }
      }
      continue;
    }

    // Check if wine color matches food preference
    if (wine.color && foodPref.colors.includes(wine.color)) {
      score += 3;
    }

    // Check if wine region matches food-paired regions (with knowledge base subregion awareness)
    if (wine.region) {
      const wineRegionLower = wine.region.toLowerCase();
      const regionMatch = foodPref.regions.some(r => wineRegionLower.includes(r.toLowerCase()));
      if (regionMatch) {
        score += 4;
      } else {
        // Knowledge base: check if wine's region is a subregion of a preferred region
        const subRegionMatch = foodPref.regions.some(r => isRegionRelated(r, wine.region || ''));
        if (subRegionMatch) score += 3;
      }
    }

    // Check if wine grape matches food-paired grapes (with synonym support)
    if (wine.grape) {
      const wineGrapeLower = wine.grape.toLowerCase();
      const grapeMatch = foodPref.grapes.some(g => wineGrapeLower.includes(g.toLowerCase()));
      if (grapeMatch) {
        score += 3;
      } else {
        // Knowledge base: check synonyms
        const wineGrapeProfile = findGrape(wine.grape);
        if (wineGrapeProfile) {
          const synonymMatch = foodPref.grapes.some(g => {
            const gProfile = findGrape(g);
            return gProfile && gProfile.name === wineGrapeProfile.name;
          });
          if (synonymMatch) score += 3;
        }
      }
    }
  }

  return Math.min(score, 10);
}

// ============================================================================
// Certification scoring (0-5 bonus)
// ============================================================================

function scoreCertification(wine: SupplierWineRow, prefs: MergedPreferences): number {
  // Only give bonus if certifications are relevant:
  // - User explicitly asked for organic/biodynamic, OR
  // - The wine has certifications (sustainability is a growing market trend)
  const userWantsCerts = prefs.organic || prefs.biodynamic;

  if (wine.biodynamic) {
    return userWantsCerts ? 5 : 3; // Biodynamic is strongest signal
  }
  if (wine.organic) {
    return userWantsCerts ? 3 : 2; // Organic is common but valued
  }

  // No certification — small penalty only if user explicitly asked
  if (userWantsCerts) return 0;

  return 0;
}

// ============================================================================
// Availability scoring (0-10)
// ============================================================================

function scoreAvailability(wine: SupplierWineRow): number {
  const stockQty = wine.stock_qty;
  const moq = wine.moq || wine.min_order_qty || 6;

  if (stockQty === null || stockQty === undefined) {
    // Unknown stock — assume available (many suppliers don't track stock)
    return 5;
  }

  if (stockQty <= 0) return 0; // Out of stock

  if (stockQty >= moq) return 10; // In stock and meets MOQ

  return 6; // In stock but below MOQ
}
