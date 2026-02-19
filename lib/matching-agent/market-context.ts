/**
 * Matching Agent — Market Context
 *
 * Fetches market intelligence from supplier_market_intelligence table
 * and formats it for injection into the AI ranking prompt.
 *
 * Two main exports:
 * - buildMarketContext(): Trend context string for the AI prompt
 * - getMarketLeaderSubsidiaries(): Subsidiary names for competitive flagging
 */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCurrentSeason } from './knowledge/food-matrix';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface MarketTrend {
  signal: 'growth' | 'structural' | 'negative' | 'risk' | 'operational';
  detail: string;
  implication: string;
}

interface SubsidiaryCompany {
  name: string;
  country: string;
  description: string;
}

// DB schema: trends is Record<string, MarketTrend>, subsidiaries has notable_companies array
interface MarketIntelligenceRow {
  trends: Record<string, MarketTrend>;
  subsidiaries: {
    notable_companies?: SubsidiaryCompany[];
    wine_clubs?: string[];
  };
}

// Normalized internal format
interface NormalizedTrend extends MarketTrend {
  key: string;
}

// Cache to avoid repeated DB calls within the same pipeline run
let cachedTrends: NormalizedTrend[] | null = null;
let cachedSubsidiaries: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheValid(): boolean {
  return Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

async function fetchMarketIntelligence(): Promise<{
  trends: NormalizedTrend[];
  subsidiaryNames: string[];
}> {
  if (cachedTrends && cachedSubsidiaries && isCacheValid()) {
    return { trends: cachedTrends, subsidiaryNames: cachedSubsidiaries };
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('supplier_market_intelligence')
      .select('trends, subsidiaries')
      .order('report_year', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn('[MarketContext] No market intelligence data found:', error?.message);
      return { trends: [], subsidiaryNames: [] };
    }

    const row = data as MarketIntelligenceRow;

    // Normalize trends from Record<string, trend> to array with keys
    const trendsObj = row.trends || {};
    cachedTrends = Object.entries(trendsObj).map(([key, trend]) => ({
      key,
      ...trend,
    }));

    // Extract subsidiary names from notable_companies
    const companies = row.subsidiaries?.notable_companies || [];
    cachedSubsidiaries = companies.map(c => c.name);

    cacheTimestamp = Date.now();

    return { trends: cachedTrends, subsidiaryNames: cachedSubsidiaries };
  } catch (err: any) {
    console.warn('[MarketContext] Failed to fetch market intelligence:', err?.message);
    return { trends: [], subsidiaryNames: [] };
  }
}

/**
 * Build a market context string for injection into the AI re-ranking prompt.
 * Filters to growth and structural signals that are relevant for recommendations.
 */
export async function buildMarketContext(): Promise<string> {
  const { trends } = await fetchMarketIntelligence();

  if (trends.length === 0) return '';

  // Filter to actionable trends (growth + structural)
  const relevantTrends = trends.filter(
    t => t.signal === 'growth' || t.signal === 'structural'
  );

  if (relevantTrends.length === 0) return '';

  const season = getCurrentSeason();

  const parts: string[] = ['MARKNADSTRENDER:'];

  for (const trend of relevantTrends) {
    parts.push(`- ${trend.implication}`);
  }

  // Add seasonal tip from market data
  const seasonalTrend = trends.find(t => t.key === 'seasonal_patterns');
  if (seasonalTrend) {
    parts.push(`SÄSONGSKONTEXT: ${season.season} — ${seasonalTrend.implication}`);
  }

  return parts.join('\n');
}

/**
 * Get list of market leader subsidiary names.
 * Used to tag wines from these suppliers in the AI prompt.
 */
export async function getMarketLeaderSubsidiaries(): Promise<string[]> {
  const { subsidiaryNames } = await fetchMarketIntelligence();
  return subsidiaryNames;
}
