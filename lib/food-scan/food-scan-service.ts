/**
 * Food Scan Agent — Service (Orchestrator)
 *
 * Wires together: Wolt client → menu analyzer → DB persistence.
 * Also handles suggestion CRUD for admin review.
 */

import { getSupabaseAdmin } from '../supabase-server';
import { searchVenues, fetchMenu } from './wolt-client';
import { analyzeDishes } from './menu-analyzer';
import { scanKoketTrends } from './trend-scanner';
import type {
  WoltVenue,
  ScanResult,
  TrendScanResult,
  DishAnalysis,
  FoodPairingSuggestion,
  FoodScanResultRow,
} from './types';

// ============================================================================
// Wolt Venue Search
// ============================================================================

export async function searchWoltVenues(query: string, city: string): Promise<WoltVenue[]> {
  return searchVenues(query, city);
}

// ============================================================================
// Restaurant Menu Scan
// ============================================================================

export async function scanRestaurantMenu(
  woltSlug: string,
  restaurantName: string,
  city: string,
  restaurantId?: string,
): Promise<ScanResult> {
  // 1. Fetch menu from Wolt
  const menuItems = await fetchMenu(woltSlug);

  if (menuItems.length === 0) {
    return {
      restaurant_name: restaurantName,
      wolt_slug: woltSlug,
      city,
      scan_source: 'wolt',
      total_dishes: 0,
      matched_dishes: 0,
      unmatched_dishes: 0,
      dishes: [],
    };
  }

  // 2. Analyze dishes
  const dishes = analyzeDishes(menuItems);
  const matched = dishes.filter(d => d.matched).length;
  const unmatched = dishes.filter(d => !d.matched).length;

  const result: ScanResult = {
    restaurant_name: restaurantName,
    wolt_slug: woltSlug,
    city,
    scan_source: 'wolt',
    total_dishes: dishes.length,
    matched_dishes: matched,
    unmatched_dishes: unmatched,
    dishes,
  };

  // 3. Persist scan result
  const supabase = getSupabaseAdmin();
  await supabase.from('food_scan_results').insert({
    restaurant_id: restaurantId || null,
    restaurant_name: restaurantName,
    wolt_slug: woltSlug,
    city,
    scan_source: 'wolt',
    total_dishes: dishes.length,
    matched_dishes: matched,
    unmatched_dishes: unmatched,
    dishes_json: dishes,
  });

  // 4. Upsert unmatched dishes as suggestions
  await upsertSuggestions(
    dishes.filter(d => !d.matched),
    'wolt',
    `${restaurantName} (${city})`,
  );

  return result;
}

// ============================================================================
// Trend Scan
// ============================================================================

export async function runTrendScan(): Promise<TrendScanResult> {
  const trendResult = await scanKoketTrends();

  // Persist as scan result
  const supabase = getSupabaseAdmin();
  await supabase.from('food_scan_results').insert({
    restaurant_name: 'Köket.se Trender',
    scan_source: 'trend',
    total_dishes: trendResult.dishes.length,
    matched_dishes: trendResult.dishes.filter(d => d.matched).length,
    unmatched_dishes: trendResult.dishes.filter(d => !d.matched).length,
    dishes_json: trendResult.dishes,
  });

  // Upsert unmatched as suggestions
  await upsertSuggestions(
    trendResult.dishes.filter(d => !d.matched),
    'trend',
    trendResult.source,
  );

  return trendResult;
}

// ============================================================================
// Suggestion Management
// ============================================================================

async function upsertSuggestions(
  dishes: DishAnalysis[],
  source: string,
  sourceDetail: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  for (const dish of dishes) {
    if (!dish.dish_name) continue;

    // Try to find existing non-rejected suggestion
    const { data: existing } = await supabase
      .from('food_pairing_suggestions')
      .select('id, occurrence_count')
      .eq('dish_name', dish.dish_name)
      .neq('status', 'rejected')
      .limit(1)
      .single();

    if (existing) {
      // Increment occurrence count + update last_seen
      await supabase
        .from('food_pairing_suggestions')
        .update({
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new suggestion
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

export async function getPendingSuggestions(
  status: string = 'pending',
  sort: string = 'occurrence_count',
  limit: number = 50,
): Promise<FoodPairingSuggestion[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('food_pairing_suggestions')
    .select('*')
    .eq('status', status)
    .limit(limit);

  if (sort === 'occurrence_count') {
    query = query.order('occurrence_count', { ascending: false });
  } else if (sort === 'last_seen_at') {
    query = query.order('last_seen_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as FoodPairingSuggestion[];
}

export async function approveSuggestion(
  id: string,
  approvedColors: string[],
  approvedRegions: string[],
  approvedGrapes: string[],
  reviewedBy: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('food_pairing_suggestions')
    .update({
      status: 'approved',
      approved_colors: approvedColors,
      approved_regions: approvedRegions,
      approved_grapes: approvedGrapes,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function rejectSuggestion(
  id: string,
  reviewedBy: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('food_pairing_suggestions')
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function getScanResults(limit: number = 20): Promise<FoodScanResultRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('food_scan_results')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as FoodScanResultRow[];
}
