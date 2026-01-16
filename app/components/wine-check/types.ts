/**
 * WINE CHECK TYPES
 *
 * Allowlist-only types for Wine-Searcher Wine Check integration
 * NO PRICE DATA ALLOWED
 *
 * CRITICAL: These types define the strict contract for what data
 * can be displayed in UI. Any fields containing price/offer/currency
 * are forbidden.
 */

/**
 * Wine Check Candidate
 * Represents an alternative match from Wine-Searcher
 */
export interface WineCheckCandidate {
  name: string;
  producer?: string;
  region?: string;
  appellation?: string;
  score: number; // 0-100 match confidence
}

/**
 * Wine Check Result
 * Main result from Wine-Searcher Wine Check API
 */
export interface WineCheckResult {
  canonical_name: string | null;
  producer: string | null;
  region: string | null;
  appellation: string | null;
  match_score: number | null; // 0-100
  match_status: MatchStatus;
  candidates: WineCheckCandidate[];
}

/**
 * Match Status Enum
 * Indicates the quality/type of match found
 */
export type MatchStatus =
  | 'EXACT'              // Perfect match (score >= 95)
  | 'FUZZY'              // Close match (score 80-94)
  | 'MULTIPLE'           // Multiple good candidates
  | 'NOT_FOUND'          // No match found
  | 'ERROR'              // API error
  | 'TEMP_UNAVAILABLE';  // Temporary service unavailable

/**
 * Wine Check API Response
 * Includes allowlist data + mock metadata
 */
export interface WineCheckResponse {
  data: WineCheckResult;
  mock: boolean; // Indicates if using mock data (API key not configured)
}

/**
 * Wine Check Input
 * Parameters for checking a wine
 */
export interface WineCheckInput {
  name: string;      // Wine name (required)
  vintage?: string;  // Vintage year (optional)
}

/**
 * Type guard: Validate no forbidden fields in object
 * Throws error if price/offer/currency fields detected
 */
export function assertNoForbiddenFields(obj: any, context: string = 'object'): void {
  const serialized = JSON.stringify(obj);
  const forbiddenPattern = /price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i;

  if (forbiddenPattern.test(serialized)) {
    console.error(`[WineCheck] SECURITY VIOLATION in ${context}:`, obj);
    throw new Error(`SECURITY_VIOLATION: Forbidden price data detected in ${context}`);
  }
}

/**
 * Type guard: Validate object has only allowlist keys
 */
export function assertAllowlistKeys(obj: any, allowedKeys: string[], context: string = 'object'): void {
  const objKeys = Object.keys(obj);
  const invalidKeys = objKeys.filter(key => !allowedKeys.includes(key));

  if (invalidKeys.length > 0) {
    console.error(`[WineCheck] Invalid keys in ${context}:`, invalidKeys);
    throw new Error(`SECURITY_VIOLATION: Unexpected keys in ${context}: ${invalidKeys.join(', ')}`);
  }
}
