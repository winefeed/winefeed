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
  type?: string;    // För NV-kategori-detektion (t.ex. "champagne", "port")
  region?: string;  // För NV-kategori-detektion (t.ex. "Champagne", "Porto")
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
// NV (Non-Vintage) Wine Handling
// ============================================================================

/**
 * Kategorier som typiskt är NV (non-vintage)
 * Kräver vintage=NV parameter för Wine-Searcher API
 */
const NV_KEYWORDS = [
  // Mousserande
  'champagne', 'cava', 'prosecco', 'cremant', 'crémant', 'sekt', 'sparkling',
  // Starkvin
  'sherry', 'porto', 'port', 'madeira', 'marsala', 'vermouth',
  // Övrigt
  'fortified', 'solera'
];

/**
 * Kontrollera om vinet tillhör en NV-kategori
 */
function isNonVintageCategory(input: WineCheckInput): boolean {
  const searchText = [
    input.type,
    input.region,
    input.name
  ].filter(Boolean).join(' ').toLowerCase();

  return NV_KEYWORDS.some(kw => searchText.includes(kw));
}

/**
 * Bestäm vintage-parameter för API-anrop
 *
 * Logik:
 * 1. vintage finns → använd vintage
 * 2. vintage saknas + NV-kategori → använd "NV"
 * 3. vintage saknas + ej NV-kategori → ingen vintage-param
 */
function getVintageParam(input: WineCheckInput): string | undefined {
  if (input.vintage) {
    return input.vintage.toString();
  }
  if (isNonVintageCategory(input)) {
    return 'NV';
  }
  return undefined;
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
 *
 * API returnerar XML, inte JSON
 */
async function fetchWineSearcherWineCheck(
  input: WineCheckInput
): Promise<{ result: WineCheckResult; rawResponse?: string }> {
  // If API key not configured, return mock data for development
  if (!WINESEARCHER_API_KEY || WINESEARCHER_API_KEY === 'your_winesearcher_api_key_here') {
    console.warn('[WineSearcher] Using mock data (API key not configured)');
    return {
      result: {
        canonical_name: input.name,
        producer: 'Mock Producer',
        region: 'Mock Region',
        appellation: null,
        match_score: 85,
        match_status: 'FUZZY',
        candidates: [
          {
            name: input.name,
            producer: 'Mock Producer A',
            region: 'Mock Region A',
            score: 90
          },
          {
            name: input.name,
            producer: 'Mock Producer B',
            region: 'Mock Region B',
            score: 80
          }
        ]
      },
      rawResponse: '<mock>true</mock>'
    };
  }

  try {
    // Bygg API-parametrar
    const params = new URLSearchParams({
      api_key: WINESEARCHER_API_KEY,
      winename: input.name,
    });

    // Lägg till vintage-parameter (hanterar NV-kategorier)
    const vintageParam = getVintageParam(input);
    if (vintageParam) {
      params.append('vintage', vintageParam);
    }

    const url = `https://api.wine-searcher.com/x?${params.toString()}`;
    console.log('[WineSearcher] API call:', input.name, vintageParam ? `(vintage=${vintageParam})` : '(no vintage)');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Winefeed/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Wine-Searcher API error: ${response.status} ${response.statusText}`);
    }

    const rawXml = await response.text();
    const result = parseWineSearcherXmlResponse(rawXml);

    return { result, rawResponse: rawXml };
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
 * Parse Wine-Searcher XML response
 *
 * Format:
 * <wine-searcher>
 *   <return-code>0</return-code>
 *   <list-currency-code>USD</list-currency-code>
 *   <wine-details>
 *     <wine>
 *       <region>Pomerol</region>
 *       <grape>Merlot</grape>
 *       <price-average>3584.99</price-average>  <!-- IGNORERAS -->
 *       <ws-score>94</ws-score>
 *     </wine>
 *   </wine-details>
 * </wine-searcher>
 *
 * CRITICAL: Prisdata extraheras men returneras INTE till klient
 */
function parseWineSearcherXmlResponse(rawXml: string): WineCheckResult {
  try {
    // Enkel XML-parsning utan externt bibliotek
    const getTagValue = (xml: string, tag: string): string | null => {
      const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
      const match = xml.match(regex);
      return match ? match[1] : null;
    };

    const returnCode = getTagValue(rawXml, 'return-code');

    // return-code 0 = success
    if (returnCode !== '0') {
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

    // Extrahera wine-details
    const wineMatch = rawXml.match(/<wine-details>[\s\S]*?<wine>([\s\S]*?)<\/wine>[\s\S]*?<\/wine-details>/i);
    if (!wineMatch) {
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

    const wineXml = wineMatch[1];

    // Extrahera ENDAST allowlist-fält (IGNORERA price-* fält)
    const region = getTagValue(wineXml, 'region');
    const grape = getTagValue(wineXml, 'grape');
    const wsScore = getTagValue(wineXml, 'ws-score');

    // Wine-Searcher /x returnerar inte canonical_name direkt
    // Region används som indikator på matchning
    const hasMatch = region !== null;

    return {
      canonical_name: null,  // API returnerar inte detta
      producer: null,        // API returnerar inte detta
      region: region,
      appellation: grape,    // Använder grape som appellation-info
      match_score: wsScore ? parseInt(wsScore, 10) : null,
      match_status: hasMatch ? 'EXACT' : 'NOT_FOUND',
      candidates: []         // /x endpoint returnerar inte kandidater
    };
  } catch (err: any) {
    console.error('[WineSearcher] Failed to parse XML response:', err.message);
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
   *
   * NV-hantering:
   * - Om vintage saknas och vinet är i en NV-kategori (champagne, port, etc.)
   *   skickas vintage=NV automatiskt till API:et
   */
  async checkWine(input: WineCheckInput): Promise<WineCheckResponse> {
    const isMockMode = !WINESEARCHER_API_KEY || WINESEARCHER_API_KEY === 'your_winesearcher_api_key_here';

    // Beräkna effektiv vintage (för cache-nyckel)
    const effectiveVintage = getVintageParam(input);

    // 1. Try cache first
    const cached = await getCachedWineCheck(input.tenantId, input.name, effectiveVintage);
    if (cached) {
      console.log('[WineSearcher] Cache hit:', input.name, effectiveVintage ? `(${effectiveVintage})` : '');
      return {
        data: cached,
        mock: isMockMode
      };
    }

    console.log('[WineSearcher] Cache miss, fetching from API:', input.name);

    // 2. Fetch from Wine-Searcher API
    const { result, rawResponse } = await fetchWineSearcherWineCheck(input);

    // 3. Cache result (med effektiv vintage som nyckel)
    await setCachedWineCheck(
      { ...input, vintage: effectiveVintage },
      result,
      rawResponse
    );

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
