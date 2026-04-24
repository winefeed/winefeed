/**
 * Matching Agent — Deterministic Pre-Scorer
 *
 * Scores each wine 0-125 without AI, based on:
 * - Price proximity to budget (0-20)
 * - Color match (0-20)
 * - Region/country match (0-15)
 * - Grape match (0-20) — high weight because AI parser infers grapes from food+color context
 * - Food pairing compatibility (0-15)
 * - Availability/stock (0-10)
 * - Name match (0-25) — boosts wines whose name/appellation/producer matches the search query
 *
 * Runs in <5ms for 100 wines. Sorts and returns top N for AI re-ranking.
 */

import { SupplierWineRow, MergedPreferences, StructuredFilters, ScoredWine, ScoreBreakdown } from './types';
import { lookupCountryFromRegion } from '../catalog-agent/enrichment';
import { FOOD_TO_WINE_STYLES } from './food-pairing';
import { findGrape, isRegionRelated } from './knowledge';
import { FOOD_STYLE_PREFERENCES } from './food-style-preferences';
import { inferWineStyle } from './style-inference';
import { matchGoldenPair } from './golden-pairs';
import { getMergedCuisineProfile, CuisineWineProfile } from './cuisine-profiles';

/**
 * Score and sort wines. Returns top N by score.
 */
/** Feedback map: wine_id → list of feedback types given by this restaurant */
export type WineFeedbackMap = Map<string, string[]>;

export function preScoreWines(
  wines: SupplierWineRow[],
  preferences: MergedPreferences,
  structuredFilters: StructuredFilters,
  topN: number,
  searchQuery?: string,
  feedbackMap?: WineFeedbackMap,
): ScoredWine[] {
  // Resolve cuisine profile once for all wines (not per-wine)
  const cuisineProfile = preferences.cuisineTypes.length > 0
    ? getMergedCuisineProfile(preferences.cuisineTypes)
    : null;

  // Normalize search query once for name matching
  const normalizedQuery = searchQuery
    ? searchQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    : '';

  // Detect urgency once for the whole batch — same signal affects all wines
  const urgencyDetected = detectUrgency(normalizedQuery);

  const scored: ScoredWine[] = wines.map(wine => {
    const breakdown = scoreWine(wine, preferences, structuredFilters, cuisineProfile, normalizedQuery, feedbackMap, urgencyDetected);
    const score = breakdown.price + breakdown.color + breakdown.region + breakdown.grape + breakdown.food + breakdown.styleMatch + breakdown.availability + breakdown.certification + breakdown.goldenPair + breakdown.cuisineMatch + breakdown.nameMatch + breakdown.appellationMatch + breakdown.feedbackPenalty + breakdown.locationBoost;

    // Get golden pair reason if applicable
    let goldenPairReason: string | undefined;
    if (breakdown.goldenPair > 0 && preferences.food_pairing.length > 0) {
      const gpMatch = matchGoldenPair(
        preferences.food_pairing,
        wine.grape,
        wine.region,
        wine.color,
      );
      if (gpMatch) {
        goldenPairReason = gpMatch.pair.reason;
      }
    }

    return { wine, score, breakdown, goldenPairReason };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

function scoreWine(
  wine: SupplierWineRow,
  prefs: MergedPreferences,
  filters: StructuredFilters,
  cuisineProfile: CuisineWineProfile | null,
  normalizedQuery: string,
  feedbackMap: WineFeedbackMap | undefined,
  urgencyDetected: boolean,
): ScoreBreakdown {
  return {
    price: scorePrice(wine, filters),
    color: scoreColor(wine, prefs, filters),
    region: scoreRegion(wine, prefs),
    grape: scoreGrape(wine, prefs),
    food: scoreFood(wine, prefs),
    styleMatch: scoreStyleMatch(wine, prefs),
    availability: scoreAvailability(wine),
    certification: scoreCertification(wine, prefs),
    goldenPair: scoreGoldenPair(wine, prefs),
    cuisineMatch: scoreCuisineMatch(wine, cuisineProfile),
    nameMatch: scoreNameMatch(wine, normalizedQuery),
    appellationMatch: scoreAppellationMatch(wine, prefs),
    feedbackPenalty: scoreFeedbackPenalty(wine, feedbackMap),
    locationBoost: scoreLocationBoost(wine, urgencyDetected),
  };
}

// ============================================================================
// Urgency detection + location boost
// ============================================================================

/**
 * Detects urgency signals in the restaurant's free-text query.
 * When urgency is present, domestic stock gets boosted and EU direct-import
 * is penalized — matching the reality that direct-import takes 7-14 days.
 *
 * Keep the keyword set conservative to avoid false positives
 * (e.g. "snabbt drucket vin" is a wine description, not urgency).
 */
function detectUrgency(normalizedQuery: string): boolean {
  if (!normalizedQuery) return false;

  // Urgency phrases — require leverans/behov context or time-bound words
  const URGENCY_PATTERNS = [
    /\b(akut|brådskande|brådskar|express)\b/,
    /\b(idag|i dag|imorgon|i morgon)\b/,
    /\b(snarast|omgående|asap)\b/,
    /\b(till (helgen|fredag|lördag|söndag|imorgon))\b/,
    /\bbehöver (.*?)(snabbt|imorgon|idag|nu)\b/,
    /\b(snabb leverans|snabbt i hus)\b/,
  ];

  return URGENCY_PATTERNS.some(pattern => pattern.test(normalizedQuery));
}

function scoreLocationBoost(wine: SupplierWineRow, urgencyDetected: boolean): number {
  if (!urgencyDetected) return 0;

  // location is 'domestic' | 'eu' | 'non_eu' (see wine_location enum)
  const loc = (wine as any).location as string | null | undefined;

  if (loc === 'domestic') return 8;       // Swedish warehouse — 1-2 dagar
  if (loc === 'eu' || loc === 'non_eu') return -8; // Direct import — 7-14 dagar

  // Unknown location: small neutral boost since many legacy rows lack the field
  return 0;
}

// ============================================================================
// Feedback penalty (0 to -20)
// Penalizes wines this restaurant has previously given negative feedback on.
// Only exact wine_id matches for now — region/style inference comes in P2.
// ============================================================================

function scoreFeedbackPenalty(wine: SupplierWineRow, feedbackMap?: WineFeedbackMap): number {
  if (!feedbackMap) return 0;
  const feedback = feedbackMap.get(wine.id);
  if (!feedback || feedback.length === 0) return 0;

  // Take the strongest signal. Multiple feedbacks on the same wine
  // don't stack — one "wrong_style" is enough to suppress.
  let penalty = 0;
  for (const type of feedback) {
    switch (type) {
      case 'wrong_style':    penalty = Math.min(penalty, -20); break;
      case 'too_expensive':  penalty = Math.min(penalty, -15); break;
      case 'already_tried':  penalty = Math.min(penalty, -10); break;
      case 'wrong_region':   penalty = Math.min(penalty, -8); break;
      case 'other':          penalty = Math.min(penalty, -5); break;
    }
  }
  return penalty;
}

// ============================================================================
// Name match scoring (0-25 bonus)
// Boosts wines whose name, appellation, producer, or region matches the
// search query. Accent-insensitive and case-insensitive.
// ============================================================================

function normalizeForMatch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function scoreNameMatch(wine: SupplierWineRow, normalizedQuery: string): number {
  if (!normalizedQuery || normalizedQuery.length < 2) return 0;

  // Wine name contains query → strongest signal
  if (wine.name && normalizeForMatch(wine.name).includes(normalizedQuery)) {
    return 25;
  }

  // Appellation contains query (e.g. "Chablis" appellation)
  if (wine.appellation && normalizeForMatch(wine.appellation).includes(normalizedQuery)) {
    return 20;
  }

  // Producer contains query
  if (wine.producer && normalizeForMatch(wine.producer).includes(normalizedQuery)) {
    return 15;
  }

  // Region contains query (supplements existing region scoring)
  if (wine.region && normalizeForMatch(wine.region).includes(normalizedQuery)) {
    return 10;
  }

  return 0;
}

// ============================================================================
// Appellation exact-match scoring (0-8 bonus)
// Fires when wine.appellation matches an entry in preferences.regions
// (accent/case-insensitive, word-level). The AI parser puts appellation
// names into prefs.regions (e.g. "Chablis") alongside true regions, so
// one check covers both user free-text and open-request criteria.
// Overlap with scoreRegion is intentional — an appellation-level match is
// a stronger signal than a region-contains match and deserves its own lift.
// ============================================================================

function scoreAppellationMatch(wine: SupplierWineRow, prefs: MergedPreferences): number {
  if (!wine.appellation || prefs.regions.length === 0) return 0;
  const wineApp = normalizeForMatch(wine.appellation);
  for (const r of prefs.regions) {
    const pref = normalizeForMatch(r);
    if (!pref) continue;
    if (wineApp === pref) return 8;          // exact match
    if (wineApp.includes(pref) && pref.length >= 4) return 6; // substring, e.g. "Chablis Premier Cru" ⊃ "Chablis"
  }
  return 0;
}

// ============================================================================
// Cuisine match scoring (0-8 bonus)
// Boosts wines that match the restaurant's cuisine profile.
// Pure bonus — never penalizes non-matching wines.
// ============================================================================

function scoreCuisineMatch(wine: SupplierWineRow, profile: CuisineWineProfile | null): number {
  if (!profile) return 0; // No cuisine profile — no boost

  let score = 0;

  // Country match (0-3)
  if (wine.country) {
    const wineCountryLower = wine.country.toLowerCase();
    if (profile.preferred_countries.some(c => c.toLowerCase() === wineCountryLower)) {
      score += 3;
    }
  }

  // Region match (0-2)
  if (wine.region) {
    const wineRegionLower = wine.region.toLowerCase();
    if (profile.preferred_regions.some(r => wineRegionLower.includes(r.toLowerCase()))) {
      score += 2;
    }
  }

  // Grape match (0-2)
  if (wine.grape) {
    const wineGrapeLower = wine.grape.toLowerCase();
    if (profile.preferred_grapes.some(g => wineGrapeLower.includes(g.toLowerCase()))) {
      score += 2;
    }
  }

  // Style match (0-1) — only if wine has style data
  if (wine.body && profile.preferred_style.body.includes(wine.body as any)) {
    score += 1;
  }

  return Math.min(score, 8);
}

// ============================================================================
// Golden pair scoring (0-10 bonus)
// Classic food+wine pairings that every sommelier knows.
// ============================================================================

function scoreGoldenPair(wine: SupplierWineRow, prefs: MergedPreferences): number {
  if (prefs.food_pairing.length === 0) return 0; // No food context — no golden pair

  const match = matchGoldenPair(
    prefs.food_pairing,
    wine.grape,
    wine.region,
    wine.color,
  );

  if (!match) return 0;

  // Cap at 10 (golden pair score_boost ranges 5-15 but we cap the breakdown bucket)
  return Math.min(match.boost, 10);
}

// ============================================================================
// Price scoring (0-20)
// ============================================================================

function scorePrice(wine: SupplierWineRow, filters: StructuredFilters): number {
  const budgetMax = filters.budget_max;
  if (!budgetMax) return 12; // No budget = neutral score

  const priceSek = wine.price_ex_vat_sek / 100; // Convert öre to SEK
  const ratio = priceSek / budgetMax;

  // Under budget is good for restaurants (better value)
  if (ratio <= 0.5) return 12;   // Way under budget — decent but maybe too cheap
  if (ratio <= 0.8) return 18;   // Nice sweet spot — good value
  if (ratio <= 0.9) return 20;   // Just under budget — perfect
  if (ratio <= 1.0) return 20;   // At budget — perfect
  if (ratio <= 1.1) return 16;   // Slightly over — acceptable
  if (ratio <= 1.2) return 12;   // 20% over — stretch
  if (ratio <= 1.3) return 8;    // 30% over — max tolerance
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
// Region/country scoring (0-15)
// ============================================================================

function scoreRegion(wine: SupplierWineRow, prefs: MergedPreferences): number {
  let score = 0;

  // Country match
  if (prefs.countries.length > 0) {
    const wineCountryLower = (wine.country || '').toLowerCase();
    const countryMatch = prefs.countries.some(c => c.toLowerCase() === wineCountryLower);
    if (countryMatch) {
      score += 10;
    }
  }

  // Region match (bonus on top of country)
  if (prefs.regions.length > 0 && wine.region) {
    const wineRegionLower = wine.region.toLowerCase();
    const regionMatch = prefs.regions.some(r => wineRegionLower.includes(r.toLowerCase()));
    if (regionMatch) {
      score = 15; // Region match is strongest — overrides country-only score
    }
  }

  // Knowledge base: check subregion relationships
  if (score < 10 && prefs.regions.length > 0 && wine.region) {
    const subMatch = prefs.regions.some(r => isRegionRelated(r, wine.region || ''));
    if (subMatch) score = Math.max(score, 10);
  }

  // If wine's region is in a preferred country (indirect match)
  if (score === 0 && prefs.countries.length > 0 && wine.region) {
    const regionCountry = lookupCountryFromRegion(wine.region);
    if (regionCountry && prefs.countries.some(c => c.toLowerCase() === regionCountry.toLowerCase())) {
      score = 7;
    }
  }

  // No country/region preferences — neutral
  if (prefs.countries.length === 0 && prefs.regions.length === 0) {
    score = 8;
  }

  return Math.min(score, 15);
}

// ============================================================================
// Grape scoring (0-20)
// Higher weight because AI parser infers ideal grapes from food+color context.
// E.g. "rött vin till fisk" → implied_grapes: [Pinot Noir, Gamay]
// This makes grape match the strongest content signal after color.
// ============================================================================

function scoreGrape(wine: SupplierWineRow, prefs: MergedPreferences): number {
  if (prefs.grapes.length === 0) return 10; // No grape pref — neutral

  if (!wine.grape) return 3; // No grape data — low but not zero

  const wineGrapeLower = wine.grape.toLowerCase();

  // Exact match (grape contains preferred grape name)
  const exactMatch = prefs.grapes.some(g => wineGrapeLower.includes(g.toLowerCase()));
  if (exactMatch) return 20;

  // Check if wine grape appears in any preferred grape (reverse check)
  const reverseMatch = prefs.grapes.some(g => g.toLowerCase().includes(wineGrapeLower));
  if (reverseMatch) return 16;

  // Knowledge base: check synonym match (e.g., Shiraz = Syrah)
  const wineGrapeProfile = findGrape(wine.grape);
  if (wineGrapeProfile) {
    for (const prefGrape of prefs.grapes) {
      const prefProfile = findGrape(prefGrape);
      if (prefProfile && prefProfile.name === wineGrapeProfile.name) {
        return 20; // Same grape via synonym
      }
    }
  }

  return 0;
}

// ============================================================================
// Food pairing scoring (0-15)
// ============================================================================

function scoreFood(wine: SupplierWineRow, prefs: MergedPreferences): number {
  if (prefs.food_pairing.length === 0) return 7; // No food context — neutral

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

  return Math.min(score, 15);
}

// ============================================================================
// Style match scoring (0-15) — body/tannin/acidity distance
// Uses food→style preferences and the wine's style profile (DB or inferred)
// ============================================================================

function scoreStyleMatch(wine: SupplierWineRow, prefs: MergedPreferences): number {
  // If wine has no style data, try to infer from grape+color
  if (!wine.body && !wine.tannin && !wine.acidity) {
    if (wine.grape || wine.color) {
      const inferred = inferWineStyle(wine.grape || '', wine.color || '', wine.region || undefined);
      wine.body = inferred.body;
      wine.tannin = inferred.tannin;
      wine.acidity = inferred.acidity;
    } else {
      return 7; // No data to work with — neutral
    }
  }

  // If no food context, check against preferred_style from AI parser
  if (prefs.food_pairing.length === 0) {
    const ps = prefs.preferred_style;
    if (!ps || (!ps.body && !ps.tannin && !ps.acidity)) return 7;
    return scoreAgainstPreferred(wine, ps);
  }

  // Score against food style preferences
  let bestScore = 0;
  let matched = false;

  for (const food of prefs.food_pairing) {
    const stylePref = FOOD_STYLE_PREFERENCES[food.toLowerCase()];
    if (!stylePref) continue;
    matched = true;

    let foodScore = 7; // Start neutral

    // Body match/mismatch
    if (wine.body && stylePref.body.length > 0) {
      if (stylePref.body.includes(wine.body)) {
        foodScore += 3; // Body match bonus
      } else {
        // Light food + full wine = bigger penalty (overpowering)
        if (stylePref.body.includes('light') && wine.body === 'full') {
          foodScore -= 4;
        }
        // Full food + light wine = smaller penalty (underwhelming but drinkable)
        else if (stylePref.body.includes('full') && wine.body === 'light') {
          foodScore -= 3;
        }
        else {
          foodScore -= 1;
        }
      }
    }

    // Tannin match/mismatch
    if (wine.tannin && stylePref.tannin.length > 0) {
      if (stylePref.tannin.includes(wine.tannin)) {
        foodScore += 3; // Tannin match bonus
      } else if (stylePref.tannin.includes('low') && wine.tannin === 'high') {
        foodScore -= 3; // High tannin clashes with delicate food
      } else {
        foodScore -= 1;
      }
    }

    // Acidity match/mismatch
    if (wine.acidity && stylePref.acidity.length > 0) {
      if (stylePref.acidity.includes(wine.acidity)) {
        foodScore += 2; // Acidity match bonus
      } else {
        foodScore -= 1;
      }
    }

    bestScore = Math.max(bestScore, foodScore);
  }

  if (!matched) {
    // No food style preferences found — fall back to preferred_style
    const ps = prefs.preferred_style;
    if (ps && (ps.body || ps.tannin || ps.acidity)) {
      return scoreAgainstPreferred(wine, ps);
    }
    return 7;
  }

  return Math.min(Math.max(bestScore, 0), 15);
}

/** Score wine against a single preferred style profile (from AI parser) */
function scoreAgainstPreferred(
  wine: SupplierWineRow,
  ps: { body: string | null; tannin: string | null; acidity: string | null },
): number {
  let score = 7;
  if (ps.body && wine.body) {
    score += wine.body === ps.body ? 3 : -2;
  }
  if (ps.tannin && wine.tannin) {
    score += wine.tannin === ps.tannin ? 3 : -1;
  }
  if (ps.acidity && wine.acidity) {
    score += wine.acidity === ps.acidity ? 2 : -1;
  }
  return Math.min(Math.max(score, 0), 15);
}

// ============================================================================
// Certification scoring (0-5 bonus)
// ============================================================================

function scoreCertification(wine: SupplierWineRow, prefs: MergedPreferences): number {
  const userWantsCerts = prefs.organic || prefs.biodynamic;

  if (wine.biodynamic) {
    return userWantsCerts ? 10 : 3; // Biodynamic + user asked = strong signal
  }
  if (wine.organic) {
    return userWantsCerts ? 8 : 2;  // Organic + user asked = clear boost
  }

  // No certification — penalty if user explicitly asked for it
  if (userWantsCerts) return -3;

  return 0;
}

// ============================================================================
// Style match scoring (0-15)
// Compares wine's body/tannin/acidity to the ideal style from AI parser.
// This is the key layer that makes food pairing scale without lookup tables.
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
