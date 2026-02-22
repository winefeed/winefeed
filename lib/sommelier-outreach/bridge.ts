/**
 * Bridge: DishAnalysis[] → MatchingAgentInput
 *
 * Converts food scan results into a matching pipeline input
 * so we can find wines that pair with a restaurant's menu.
 */

import type { DishAnalysis } from '../food-scan/types';
import type { MatchingAgentInput, StructuredFilters } from '../matching-agent/types';

export interface BridgeResult {
  matchingInput: MatchingAgentInput;
  dishSummary: string;
  dominantStyles: string[];
}

/**
 * Aggregate frequency counts from arrays across dishes.
 * Returns sorted by frequency (descending), top N.
 */
function topByFrequency(items: string[], topN: number): string[] {
  const freq: Record<string, number> = {};
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (key) freq[key] = (freq[key] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key]) => key);
}

/**
 * Build a MatchingAgentInput from a restaurant's dish analysis.
 */
export function buildOutreachInput(
  restaurantName: string,
  dishes: DishAnalysis[],
): BridgeResult {
  // Only use matched dishes (they have wine pairing data)
  const matched = dishes.filter(d => d.matched);

  // Aggregate colors, regions, grapes with frequency
  const allColors = matched.flatMap(d => d.colors);
  const allRegions = matched.flatMap(d => d.regions);
  const allGrapes = matched.flatMap(d => d.grapes);

  const topColors = topByFrequency(allColors, 3);
  const topRegions = topByFrequency(allRegions, 3);
  const topGrapes = topByFrequency(allGrapes, 5);

  // Pick top dish names for the fritext
  const topDishes = matched
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map(d => d.dish_name_original || d.dish_name);

  // Build dominant styles summary
  const dominantStyles: string[] = [];
  if (topColors.length > 0) dominantStyles.push(...topColors);
  if (topRegions.length > 0) dominantStyles.push(...topRegions.slice(0, 2));

  // Build fritext — natural language description for the AI parser
  const fritextParts: string[] = [
    `Restaurang ${restaurantName} serverar ${topDishes.join(', ')}.`,
  ];
  if (topColors.length > 0) {
    fritextParts.push(`Dominerande vinfärger: ${topColors.join(', ')}.`);
  }
  if (topGrapes.length > 0) {
    fritextParts.push(`Bra druvor: ${topGrapes.join(', ')}.`);
  }
  fritextParts.push('Vinkarta bör matcha menyns profil.');

  const fritext = fritextParts.join(' ');

  // Build structured filters — dominant color if clear majority
  const structuredFilters: StructuredFilters = {};
  if (topColors.length === 1) {
    structuredFilters.color = topColors[0];
  }

  // Build dish summary for the email template
  const dishSummary = topDishes.length > 3
    ? `${topDishes.slice(0, 3).join(', ')} m.fl.`
    : topDishes.join(', ');

  return {
    matchingInput: {
      fritext,
      structuredFilters,
      restaurantContext: `Restaurang: ${restaurantName}. Antal rätter: ${dishes.length}. Matchade: ${matched.length}.`,
    },
    dishSummary,
    dominantStyles,
  };
}
