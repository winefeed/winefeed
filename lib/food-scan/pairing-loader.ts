/**
 * Food Scan Agent — Pairing Loader
 *
 * Loads approved food pairing overrides from DB.
 * Cached for 5 minutes to avoid hitting DB on every matching request.
 * Returns Record<dish_name, { colors, regions, grapes }> for runtime use.
 */

import { getSupabaseAdmin } from '../supabase-server';

export interface FoodWineOverride {
  colors: string[];
  regions: string[];
  grapes: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache: Record<string, FoodWineOverride> | null = null;
let cacheLoadedAt = 0;

/**
 * Load all approved pairing overrides from DB.
 * Returns cached result if within TTL.
 */
export async function loadPairingOverrides(): Promise<Record<string, FoodWineOverride>> {
  const now = Date.now();
  if (cache && (now - cacheLoadedAt) < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('food_pairing_suggestions')
      .select('dish_name, approved_colors, approved_regions, approved_grapes')
      .eq('status', 'approved');

    if (error) {
      console.warn('[PairingLoader] Failed to load overrides:', error.message);
      return cache || {};
    }

    const overrides: Record<string, FoodWineOverride> = {};
    for (const row of data || []) {
      if (row.approved_colors?.length || row.approved_regions?.length || row.approved_grapes?.length) {
        overrides[row.dish_name] = {
          colors: row.approved_colors || [],
          regions: row.approved_regions || [],
          grapes: row.approved_grapes || [],
        };
      }
    }

    cache = overrides;
    cacheLoadedAt = now;
    console.log(`[PairingLoader] Loaded ${Object.keys(overrides).length} pairing overrides`);
    return overrides;
  } catch (err: any) {
    console.warn('[PairingLoader] Error loading overrides:', err?.message);
    return cache || {};
  }
}

/** Force-clear the cache (useful after admin approves a suggestion) */
export function invalidatePairingCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}
