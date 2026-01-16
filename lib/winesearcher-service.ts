/**
 * WINE-SEARCHER SERVICE
 *
 * Purpose: Wine Check (normalization & verification) - NO PRICE DATA
 * Endpoint: /x (Wine Check only)
 *
 * CRITICAL POLICY:
 * - NEVER fetch or expose price/offer/currency data
 * - NEVER implement /a (Market Price) route
 * - API key NEVER exposed to client
 * - Only allowlist fields returned to UI
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================================================
// Types
// ============================================================================

export type MatchStatus = 'EXACT' | 'FUZZY' | 'MULTIPLE' | 'NOT_FOUND' | 'ERROR';

export interface WineCheckInput {
  tenantId: string;
  name: string;
  vintage?: string;
}

export interface WineCandidate {
  name: string;
  producer: string;
  region?: string;
  appellation?: string;
  score: number;
}

/**
 * ALLOWLIST ONLY - These are the ONLY fields that can be returned to UI
 * NO price/offer/currency fields allowed
 */
export interface WineCheckResult {
  canonical_name: string | null;
  producer: string | null;
  region: string | null;
  appellation: string | null;
  match_score: number | null;
  match_status: MatchStatus;
  candidates: WineCandidate[]; // Max 3
}

// Internal cache record (includes raw_response for dev)
interface WineEnrichmentRecord {
  id: string;
  tenant_id: string;
  query_name: string;
  query_vintage: string | null;
  canonical_name: string | null;
  producer: string | null;
  region: string | null;
  appellation: string | null;
  match_score: number | null;
  match_status: MatchStatus;
  candidates: WineCandidate[];
  ws_id: string | null;
  fetched_at: string;
  expires_at: string;
  raw_response: any;
}

// ============================================================================
// Configuration
// ============================================================================

const WINESEARCHER_API_KEY = process.env.WINESEARCHER_API_KEY;
const CACHE_TTL_DAYS = parseInt(process.env.WINESEARCHER_CACHE_TTL_DAYS || '7', 10);

if (!WINESEARCHER_API_KEY || WINESEARCHER_API_KEY === 'your_winesearcher_api_key_here') {
  console.warn('[WineSearcher] API key not configured. Wine Check will return mock data.');
}

// ============================================================================
// Response Serializer (ALLOWLIST FILTER)
// ============================================================================

/**
 * CRITICAL SECURITY FUNCTION
 * Filters response to ONLY allowlist fields
 * Strips all price/offer/currency data
 */
function serializeWineCheckResult(record: WineEnrichmentRecord): WineCheckResult {
  const allowlist: WineCheckResult = {
    canonical_name: record.canonical_name,
    producer: record.producer,
    region: record.region,
    appellation: record.appellation,
    match_score: record.match_score,
    match_status: record.match_status,
    candidates: record.candidates.slice(0, 3).map((c: WineCandidate) => ({
      name: c.name,
      producer: c.producer,
      region: c.region,
      appellation: c.appellation,
      score: c.score
    }))
  };

  // SECURITY CHECK: Assert no price fields leaked
  const serialized = JSON.stringify(allowlist);
  if (/price|offer|currency|market/i.test(serialized)) {
    console.error('[WineSearcher] SECURITY VIOLATION: Price data leaked in response!');
    throw new Error('SECURITY_VIOLATION: Price data detected in response');
  }

  return allowlist;
}

// ============================================================================
// Cache Functions
// ============================================================================

async function getCachedWineCheck(
  tenantId: string,
  name: string,
  vintage?: string
): Promise<WineCheckResult | null> {
  try {
    const { data, error } = await supabase
      .from('wine_enrichment')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('query_name', name)
      .eq('query_vintage', vintage || '')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return serializeWineCheckResult(data as WineEnrichmentRecord);
  } catch (err: any) {
    console.error('[WineSearcher] Cache lookup failed:', err.message);
    return null;
  }
}

async function setCachedWineCheck(
  input: WineCheckInput,
  result: WineCheckResult,
  rawResponse?: any
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  try {
    const { error } = await supabase
      .from('wine_enrichment')
      .upsert({
        tenant_id: input.tenantId,
        query_name: input.name,
        query_vintage: input.vintage || null,
        canonical_name: result.canonical_name,
        producer: result.producer,
        region: result.region,
        appellation: result.appellation,
        match_score: result.match_score,
        match_status: result.match_status,
        candidates: result.candidates,
        ws_id: null, // Could extract from rawResponse if available
        expires_at: expiresAt.toISOString(),
        raw_response: rawResponse || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,query_name,query_vintage'
      });

    if (error) {
      throw error;
    }
  } catch (err: any) {
    console.error('[WineSearcher] Cache write failed:', err.message);
    // Don't fail the request, just log
  }
}

// ============================================================================
// Wine-Searcher API Client
// ============================================================================

/**
 * Fetch wine data from Wine-Searcher /x endpoint
 * ONLY Wine Check - NO PRICE DATA
 */
async function fetchWineSearcherWineCheck(
  name: string,
  vintage?: string
): Promise<{ result: WineCheckResult; rawResponse?: any }> {
  // If API key not configured, return mock data for development
  if (!WINESEARCHER_API_KEY || WINESEARCHER_API_KEY === 'your_winesearcher_api_key_here') {
    console.warn('[WineSearcher] Using mock data (API key not configured)');
    return {
      result: {
        canonical_name: name,
        producer: 'Mock Producer',
        region: 'Mock Region',
        appellation: null,
        match_score: 85,
        match_status: 'FUZZY',
        candidates: [
          {
            name: name,
            producer: 'Mock Producer A',
            region: 'Mock Region A',
            score: 90
          },
          {
            name: name,
            producer: 'Mock Producer B',
            region: 'Mock Region B',
            score: 80
          }
        ]
      },
      rawResponse: { mock: true }
    };
  }

  try {
    // Wine-Searcher API endpoint: /x (Wine Check)
    // Documentation: https://www.wine-searcher.com/api/docs
    const params = new URLSearchParams({
      Xwapikey: WINESEARCHER_API_KEY,
      s: name,
      ...(vintage && { vintage })
    });

    const response = await fetch(`https://api.wine-searcher.com/x?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Winefeed/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Wine-Searcher API error: ${response.status} ${response.statusText}`);
    }

    const rawResponse = await response.json();

    // Parse Wine-Searcher response
    // NOTE: Adjust this based on actual API response format
    const result = parseWineSearcherResponse(rawResponse);

    return { result, rawResponse };
  } catch (err: any) {
    console.error('[WineSearcher] API call failed:', err.message);
    return {
      result: {
        canonical_name: null,
        producer: null,
        region: null,
        appellation: null,
        match_score: null,
        match_status: 'ERROR',
        candidates: []
      }
    };
  }
}

/**
 * Parse Wine-Searcher API response into allowlist format
 * CRITICAL: Strip all price/offer/currency fields
 */
function parseWineSearcherResponse(rawResponse: any): WineCheckResult {
  // This is a placeholder implementation
  // Adjust based on actual Wine-Searcher /x response format

  try {
    const results = rawResponse.results || [];

    if (results.length === 0) {
      return {
        canonical_name: null,
        producer: null,
        region: null,
        appellation: null,
        match_score: null,
        match_status: 'NOT_FOUND',
        candidates: []
      };
    }

    const topResult = results[0];
    const isExactMatch = topResult.score >= 95;
    const hasMultipleCandidates = results.length > 1 && results[1].score >= 80;

    // Extract ONLY allowlist fields
    const canonical_name = topResult.wine_name || topResult.name || null;
    const producer = topResult.producer || topResult.winery || null;
    const region = topResult.region || null;
    const appellation = topResult.appellation || null;
    const match_score = topResult.score || null;

    const candidates: WineCandidate[] = results.slice(0, 3).map((r: any) => ({
      name: r.wine_name || r.name || '',
      producer: r.producer || r.winery || '',
      region: r.region || undefined,
      appellation: r.appellation || undefined,
      score: r.score || 0
    }));

    return {
      canonical_name,
      producer,
      region,
      appellation,
      match_score,
      match_status: isExactMatch ? 'EXACT' : (hasMultipleCandidates ? 'MULTIPLE' : 'FUZZY'),
      candidates
    };
  } catch (err: any) {
    console.error('[WineSearcher] Failed to parse response:', err.message);
    return {
      canonical_name: null,
      producer: null,
      region: null,
      appellation: null,
      match_score: null,
      match_status: 'ERROR',
      candidates: []
    };
  }
}

// ============================================================================
// Public API
// ============================================================================

export interface WineCheckResponse {
  data: WineCheckResult;
  mock: boolean;
}

export class WineSearcherService {
  /**
   * Check wine name + vintage (normalization & verification)
   * Returns ONLY allowlist fields - NO PRICE DATA
   *
   * Uses cache with TTL from env var (default 7 days)
   */
  async checkWine(input: WineCheckInput): Promise<WineCheckResponse> {
    const isMockMode = !WINESEARCHER_API_KEY || WINESEARCHER_API_KEY === 'your_winesearcher_api_key_here';

    // 1. Try cache first
    const cached = await getCachedWineCheck(input.tenantId, input.name, input.vintage);
    if (cached) {
      console.log('[WineSearcher] Cache hit:', input.name);
      return {
        data: cached,
        mock: isMockMode
      };
    }

    console.log('[WineSearcher] Cache miss, fetching from API:', input.name);

    // 2. Fetch from Wine-Searcher API
    const { result, rawResponse } = await fetchWineSearcherWineCheck(
      input.name,
      input.vintage
    );

    // 3. Cache result
    await setCachedWineCheck(input, result, rawResponse);

    // 4. Return allowlist-filtered result with mock flag
    return {
      data: result,
      mock: isMockMode
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const wineSearcherService = new WineSearcherService();
