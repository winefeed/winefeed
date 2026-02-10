/**
 * Matching Agent — Smart Query Builder
 *
 * Builds Supabase queries from merged preferences (parsed + structured).
 * Tighter budget (±30%), region/grape filters from parsed text,
 * organic/biodynamic filters. Falls back gracefully if no results.
 */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { StructuredFilters, MergedPreferences, SupplierWineRow, MatchingAgentOptions } from './types';
import { normalizeCountry, lookupCountryFromRegion } from '../catalog-agent/enrichment';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Run smart query with fallback cascade:
 * 1. Full filters (color + budget + country + region + grape + organic)
 * 2. Relaxed (color + budget only)
 * 3. Color only
 * 4. All wines
 */
export async function runSmartQuery(
  structuredFilters: StructuredFilters,
  preferences: MergedPreferences,
  options: MatchingAgentOptions,
): Promise<SupplierWineRow[]> {
  // Try full smart query first
  const fullResult = await queryWithFilters(structuredFilters, preferences, options, 'full');
  if (fullResult.length > 0) return fullResult;

  console.log('[MatchingAgent] Full query returned 0 results, trying relaxed...');

  // Relaxed: color + budget only
  const relaxedResult = await queryWithFilters(structuredFilters, preferences, options, 'relaxed');
  if (relaxedResult.length > 0) return relaxedResult;

  console.log('[MatchingAgent] Relaxed query returned 0 results, trying color-only...');

  // Color only
  const colorResult = await queryWithFilters(structuredFilters, preferences, options, 'color-only');
  if (colorResult.length > 0) return colorResult;

  console.log('[MatchingAgent] Color-only returned 0 results, fetching all wines...');

  // All wines
  return queryWithFilters(structuredFilters, preferences, options, 'all');
}

type QueryMode = 'full' | 'relaxed' | 'color-only' | 'all';

async function queryWithFilters(
  filters: StructuredFilters,
  prefs: MergedPreferences,
  options: MatchingAgentOptions,
  mode: QueryMode,
): Promise<SupplierWineRow[]> {
  let query = getSupabaseAdmin()
    .from('supplier_wines')
    .select('*');

  // --- Color filter (applies in all modes except 'all') ---
  if (mode !== 'all') {
    const effectiveColor = resolveColor(filters.color, prefs);
    if (effectiveColor) {
      query = query.eq('color', effectiveColor);
    }
  }

  // --- Budget filter (applies in 'full' and 'relaxed') ---
  if (mode === 'full' || mode === 'relaxed') {
    const budgetMax = filters.budget_max;
    const budgetMin = filters.budget_min;

    if (budgetMax) {
      const budgetMaxOre = budgetMax * 100;
      // Tighter: +30% over budget (was +50%)
      query = query.lte('price_ex_vat_sek', Math.round(budgetMaxOre * 1.3));
    }

    if (budgetMin) {
      const budgetMinOre = budgetMin * 100;
      // Tighter: -30% under min (was -50%)
      query = query.gte('price_ex_vat_sek', Math.round(budgetMinOre * 0.7));
    }
  }

  // --- Full mode: add country, region, grape, organic/biodynamic filters ---
  if (mode === 'full') {
    // Country: from structured filter or parsed preferences
    const country = resolveCountry(filters.country, prefs);
    if (country) {
      query = query.eq('country', country);
    }

    // Grape: from structured filter or parsed preferences (use ilike for partial match)
    const grape = resolveGrape(filters.grape, prefs);
    if (grape) {
      query = query.ilike('grape', `%${grape}%`);
    }

    // Region: from parsed preferences (ilike for partial match)
    if (prefs.regions.length > 0) {
      // Use the first (most specific) region as filter
      const primaryRegion = prefs.regions[0];
      query = query.ilike('region', `%${primaryRegion}%`);
    }

    // Organic filter
    if (prefs.organic) {
      query = query.eq('organic', true);
    }

    // Biodynamic filter
    if (prefs.biodynamic) {
      query = query.eq('biodynamic', true);
    }
  }

  try {
    const { data, error } = await query.limit(options.maxDbResults);

    if (error) {
      console.error(`[MatchingAgent] Query error (${mode}):`, error.message);
      return [];
    }

    return (data || []) as SupplierWineRow[];
  } catch (err: any) {
    console.error(`[MatchingAgent] Query exception (${mode}):`, err?.message);
    return [];
  }
}

// ============================================================================
// Resolve helpers — merge structured filter with parsed preferences
// ============================================================================

/** Pick the effective color: structured filter wins, then parsed/food/occasion */
function resolveColor(structuredColor: string | undefined, prefs: MergedPreferences): string | null {
  if (structuredColor && structuredColor !== 'all') {
    return structuredColor;
  }
  // Use first color from preferences (strongest signal)
  return prefs.colors.length > 0 ? prefs.colors[0] : null;
}

/** Pick the effective country: structured filter wins, then parsed */
function resolveCountry(structuredCountry: string | undefined, prefs: MergedPreferences): string | null {
  if (structuredCountry && structuredCountry !== 'all' && structuredCountry !== 'other') {
    return structuredCountry;
  }
  if (prefs.countries.length > 0) {
    // Normalize the country name
    const normalized = normalizeCountry(prefs.countries[0]);
    return normalized || prefs.countries[0];
  }
  // Try resolving country from region
  if (prefs.regions.length > 0) {
    const country = lookupCountryFromRegion(prefs.regions[0]);
    if (country) return country;
  }
  return null;
}

/** Pick the effective grape: structured filter wins, then parsed */
function resolveGrape(structuredGrape: string | undefined, prefs: MergedPreferences): string | null {
  if (structuredGrape && structuredGrape !== 'all' && structuredGrape !== 'other') {
    return structuredGrape;
  }
  // Use first grape from preferences (most relevant from food/style)
  return prefs.grapes.length > 0 ? prefs.grapes[0] : null;
}
