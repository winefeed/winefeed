/**
 * Sommelier Context — Personalized restaurant profile for AI wine suggestions
 *
 * Loads restaurant profile + order history and formats it as a prompt string
 * injected into the AI re-ranking step.
 *
 * Entirely fail-safe: returns empty context on any error so the pipeline
 * continues without personalization.
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface RestaurantProfile {
  cuisine_type: string[] | null;
  price_segment: string | null;
  wine_preference_notes: string | null;
  city: string | null;
}

interface OrderHistory {
  topCountries: string[];
  avgPriceSek: number | null;
  totalOrders: number;
}

export interface SommelierContext {
  profile: RestaurantProfile | null;
  history: OrderHistory | null;
  promptContext: string;
}

const EMPTY_CONTEXT: SommelierContext = {
  profile: null,
  history: null,
  promptContext: '',
};

/**
 * Build full sommelier context for a restaurant.
 * Returns empty context on any failure — never blocks the pipeline.
 */
export async function buildSommelierContext(
  restaurantId: string,
  tenantId: string,
): Promise<SommelierContext> {
  try {
    const [profile, history] = await Promise.all([
      loadRestaurantProfile(restaurantId),
      loadOrderHistory(restaurantId, tenantId),
    ]);

    // Nothing to personalize
    if (!profile && !history) return EMPTY_CONTEXT;

    const promptContext = formatPromptContext(profile, history);
    if (!promptContext) return EMPTY_CONTEXT;

    return { profile, history, promptContext };
  } catch (err: any) {
    console.warn('[SommelierContext] Failed to build context (non-critical):', err?.message);
    return EMPTY_CONTEXT;
  }
}

async function loadRestaurantProfile(restaurantId: string): Promise<RestaurantProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('restaurants')
    .select('cuisine_type, price_segment, wine_preference_notes, city')
    .eq('id', restaurantId)
    .single();

  if (error || !data) return null;

  // Only return if at least one profile field is set
  if (!data.cuisine_type?.length && !data.price_segment && !data.wine_preference_notes) {
    return null;
  }

  return data;
}

async function loadOrderHistory(restaurantId: string, _tenantId: string): Promise<OrderHistory | null> {
  const { data: orders, error } = await getSupabaseAdmin()
    .from('orders')
    .select('total_price_sek, supplier_wines(country)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !orders || orders.length === 0) return null;

  // Extract countries from order lines
  const countries: string[] = [];
  let priceSum = 0;
  let priceCount = 0;

  for (const order of orders) {
    if (order.total_price_sek) {
      priceSum += order.total_price_sek;
      priceCount++;
    }
    // supplier_wines can be an object or array depending on join
    const wines = Array.isArray(order.supplier_wines) ? order.supplier_wines : order.supplier_wines ? [order.supplier_wines] : [];
    for (const w of wines) {
      if ((w as any)?.country) countries.push((w as any).country);
    }
  }

  // Count top countries
  const countryCount: Record<string, number> = {};
  for (const c of countries) {
    countryCount[c] = (countryCount[c] || 0) + 1;
  }
  const topCountries = Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([country]) => country);

  if (topCountries.length === 0 && priceCount === 0) return null;

  return {
    topCountries,
    avgPriceSek: priceCount > 0 ? Math.round(priceSum / priceCount) : null,
    totalOrders: orders.length,
  };
}

function formatPromptContext(
  profile: RestaurantProfile | null,
  history: OrderHistory | null,
): string {
  const parts: string[] = [];

  if (profile) {
    if (profile.cuisine_type?.length) {
      parts.push(`Kök: ${profile.cuisine_type.join(', ')}`);
    }
    if (profile.price_segment) {
      const segmentLabels: Record<string, string> = {
        'casual': 'Casual',
        'mid-range': 'Mellansegment',
        'fine-dining': 'Fine dining',
      };
      parts.push(`Segment: ${segmentLabels[profile.price_segment] || profile.price_segment}`);
    }
    if (profile.wine_preference_notes) {
      parts.push(`Vinpreferenser: ${profile.wine_preference_notes}`);
    }
  }

  if (history) {
    if (history.topCountries.length > 0) {
      parts.push(`Ofta beställt från: ${history.topCountries.join(', ')}`);
    }
    if (history.avgPriceSek) {
      parts.push(`Snittbeställningspris: ${history.avgPriceSek} kr/flaska`);
    }
    parts.push(`Baserat på ${history.totalOrders} senaste beställningar`);
  }

  if (parts.length === 0) return '';

  return `RESTAURANGPROFIL:\n${parts.join('. ')}.\n\nOBS: Använd profilen som mjuk preferens — den ska INTE övertrumfa explicita sökkriterier.`;
}
