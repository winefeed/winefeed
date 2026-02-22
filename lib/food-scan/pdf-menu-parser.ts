/**
 * Food Scan Agent — PDF Menu Parser
 *
 * Parses a PDF menu file, extracts dish names with Claude,
 * runs the 4-step pairing analyzer, persists results, and
 * upserts unmatched dishes as suggestions.
 */

import { getSupabaseAdmin } from '../supabase-server';
import { callClaude } from '../ai/claude';
import { analyzeDishes } from './menu-analyzer';
import { enrichWithAI } from './ai-fallback';
import type { WoltMenuItem, ScanResult, DishAnalysis } from './types';

// pdf-parse v1 tries to load a test PDF at require() time — import inner module
// eslint-disable-next-line
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

/**
 * Parse a PDF menu, extract dishes with AI, run pairing analysis, and persist.
 */
export async function parsePdfMenu(
  buffer: Buffer,
  restaurantName: string,
  restaurantId?: string,
): Promise<ScanResult> {
  // 1. Extract text from PDF
  const parsed = await pdfParse(buffer);
  const menuText: string = parsed.text;

  if (!menuText?.trim()) {
    throw new Error(
      'Kunde inte extrahera text från PDF:en. Kontrollera att filen innehåller text och inte är en scannad bild.',
    );
  }

  // 2. Extract dish names with Claude
  const dishNames = await extractDishNames(menuText);

  if (dishNames.length === 0) {
    return {
      restaurant_name: restaurantName,
      scan_source: 'manual',
      total_dishes: 0,
      matched_dishes: 0,
      unmatched_dishes: 0,
      dishes: [],
    };
  }

  // 3. Map to WoltMenuItem format and run 4-step analyzer
  const items: WoltMenuItem[] = dishNames.map(name => ({
    name,
    category: 'pdf',
  }));

  // 4-step static analyzer + AI fallback (step 5) for unmatched
  const staticDishes = analyzeDishes(items);
  const dishes = await enrichWithAI(staticDishes);
  const matched = dishes.filter(d => d.matched).length;
  const unmatched = dishes.filter(d => !d.matched).length;

  const result: ScanResult = {
    restaurant_name: restaurantName,
    scan_source: 'manual',
    total_dishes: dishes.length,
    matched_dishes: matched,
    unmatched_dishes: unmatched,
    dishes,
  };

  // 4. Persist to food_scan_results
  const supabase = getSupabaseAdmin();
  const { data: inserted } = await supabase.from('food_scan_results').insert({
    restaurant_id: restaurantId || null,
    restaurant_name: restaurantName,
    scan_source: 'manual',
    total_dishes: dishes.length,
    matched_dishes: matched,
    unmatched_dishes: unmatched,
    dishes_json: dishes,
  }).select('id').single();

  if (inserted) {
    result.id = inserted.id;
  }

  // 5. Upsert unmatched dishes as suggestions
  await upsertSuggestions(
    dishes.filter(d => !d.matched),
    'manual',
    `${restaurantName} (PDF)`,
  );

  return result;
}

/**
 * Use Claude to extract dish names from raw menu text.
 */
async function extractDishNames(menuText: string): Promise<string[]> {
  const prompt = `Analysera följande restaurangmeny och extrahera ALLA rättnamn (maträtter).

Regler:
- Inkludera huvudrätter, förrätter, sallader, desserter — allt som är mat
- Exkludera drycker, tillbehör (bröd, smör), sektionsrubriker, priser
- Returnera som JSON-array med strängar: ["Rätt 1", "Rätt 2", ...]
- Behåll originalnamnet på rätten
- Om du inte kan extrahera några rätter, returnera []

MENY:
${menuText}`;

  const response = await callClaude(prompt, 4096);
  const jsonMatch = response.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return [];

  try {
    const names = JSON.parse(jsonMatch[0]);
    return Array.isArray(names)
      ? names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Upsert unmatched dishes as food_pairing_suggestions.
 * Mirrors the pattern from food-scan-service.ts.
 */
async function upsertSuggestions(
  dishes: DishAnalysis[],
  source: string,
  sourceDetail: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  for (const dish of dishes) {
    if (!dish.dish_name) continue;

    const { data: existing } = await supabase
      .from('food_pairing_suggestions')
      .select('id, occurrence_count')
      .eq('dish_name', dish.dish_name)
      .neq('status', 'rejected')
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from('food_pairing_suggestions')
        .update({
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('food_pairing_suggestions').insert({
        dish_name: dish.dish_name,
        dish_name_original: dish.dish_name_original,
        source,
        source_detail: sourceDetail,
        suggested_colors: dish.colors,
        suggested_regions: dish.regions,
        suggested_grapes: dish.grapes,
        confidence: dish.confidence,
        categorization_method: dish.method,
      });
    }
  }
}
