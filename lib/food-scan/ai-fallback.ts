/**
 * Food Scan Agent — AI Fallback (Step 5)
 *
 * When the static 4-step analyzer (exact → fuzzy → decompose → category)
 * fails to match a dish, this module sends unmatched dishes to Claude
 * in a single batch call and returns updated DishAnalysis objects.
 */

import { callClaude } from '../ai/claude';
import type { DishAnalysis } from './types';

interface AIPairingResult {
  dish: string;
  colors: string[];
  regions: string[];
  grapes: string[];
  confidence: number;
}

/**
 * Send unmatched dishes to Claude for wine pairing analysis.
 * Returns the full dish list with previously-unmatched dishes updated.
 *
 * If the AI call fails, returns the original list unchanged (graceful degradation).
 */
export async function enrichWithAI(dishes: DishAnalysis[]): Promise<DishAnalysis[]> {
  const unmatched = dishes.filter(d => !d.matched);

  if (unmatched.length === 0) return dishes;

  // Cap at 30 dishes per batch to stay within token limits
  const batch = unmatched.slice(0, 30);
  const dishNames = batch.map(d => d.dish_name_original);

  try {
    const pairings = await getAIPairings(dishNames);

    // Build a lookup from AI results
    const aiMap = new Map<string, AIPairingResult>();
    for (const p of pairings) {
      aiMap.set(p.dish.toLowerCase(), p);
    }

    // Update unmatched dishes with AI results
    return dishes.map(d => {
      if (d.matched) return d;

      const ai = aiMap.get(d.dish_name_original.toLowerCase())
        || aiMap.get(d.dish_name.toLowerCase());

      if (ai && ai.colors.length > 0) {
        return {
          ...d,
          matched: true,
          match_key: `ai: ${d.dish_name}`,
          colors: ai.colors,
          regions: ai.regions,
          grapes: ai.grapes,
          confidence: Math.min(ai.confidence, 0.7),
          method: 'ai' as const,
        };
      }

      return d;
    });
  } catch (error) {
    console.error('[FoodScan] AI fallback failed, returning original results:', error);
    return dishes;
  }
}

/**
 * Call Claude to get wine pairings for a list of dish names.
 */
async function getAIPairings(dishNames: string[]): Promise<AIPairingResult[]> {
  const prompt = `Du är en sommelier. Föreslå vinpairings för följande maträtter.

För varje rätt, ange:
- colors: en array med vinfärger som passar (t.ex. ["red"], ["white", "rose"], ["sparkling"])
  Giltiga värden: "red", "white", "rose", "sparkling", "orange", "fortified"
- regions: 2-3 vinregioner som passar (t.ex. ["bourgogne", "rhône", "rioja"])
- grapes: 2-3 druvor som passar (t.ex. ["Pinot Noir", "Syrah"])
- confidence: 0.0-1.0 hur säker du är

Svara ENBART med en JSON-array. Inget annat.

Rätter:
${dishNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Svara som JSON:
[{"dish": "rättnamn", "colors": [...], "regions": [...], "grapes": [...], "confidence": 0.8}, ...]`;

  const response = await callClaude(prompt, 4096);

  // Extract JSON array from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((p: any) =>
        p && typeof p.dish === 'string' &&
        Array.isArray(p.colors) &&
        Array.isArray(p.regions) &&
        Array.isArray(p.grapes)
      )
      .map((p: any) => ({
        dish: p.dish,
        colors: p.colors.filter((c: any) => typeof c === 'string'),
        regions: p.regions.filter((r: any) => typeof r === 'string'),
        grapes: p.grapes.filter((g: any) => typeof g === 'string'),
        confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
      }));
  } catch {
    return [];
  }
}
