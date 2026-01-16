/**
 * OFFER LINE ITEM TYPES
 *
 * Types for multi-line-item offers with Wine Check integration
 * NO PRICE DATA from Wine-Searcher (policy compliant)
 *
 * MVP: Client-side storage with localStorage
 * Future: Backend persistence via offer_lines table
 */

import type { MatchStatus } from '@/app/components/wine-check';

/**
 * Wine Check Enrichment Data
 * Data from Wine-Searcher Wine Check (allowlist only)
 */
export interface WineCheckEnrichment {
  canonical_name: string | null;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  ws_id: string | null; // Wine-Searcher ID for reference
  match_score: number | null; // 0-100
  match_status: MatchStatus | null;
  checked_at: string; // ISO timestamp
}

/**
 * Offer Line Item
 * Single wine row in an offer
 */
export interface OfferLineItem {
  id: string; // UUID

  // User input
  name: string; // Raw wine name
  vintage: number | null;
  quantity: number;
  unit_price: number | null; // Optional, SEK per bottle

  // Wine Check enrichment (allowlist only)
  enrichment: WineCheckEnrichment | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Offer Draft
 * Multi-line-item offer (MVP: client-side only)
 */
export interface OfferDraft {
  id: string; // UUID
  title: string;
  description: string | null;
  line_items: OfferLineItem[];

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Policy Guard: Assert no forbidden fields in enrichment
 * Throws error if price/offer/currency detected
 */
export function assertNoForbiddenFieldsInEnrichment(enrichment: WineCheckEnrichment): void {
  const serialized = JSON.stringify(enrichment);
  const forbiddenPattern = /price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i;

  if (forbiddenPattern.test(serialized)) {
    console.error('[OfferLineItem] SECURITY VIOLATION: Forbidden field in enrichment', enrichment);
    throw new Error('SECURITY_VIOLATION: Forbidden price data detected in wine enrichment');
  }
}

/**
 * Create empty line item
 */
export function createEmptyLineItem(): OfferLineItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    vintage: null,
    quantity: 1,
    unit_price: null,
    enrichment: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Create empty offer draft
 */
export function createEmptyOfferDraft(): OfferDraft {
  return {
    id: crypto.randomUUID(),
    title: 'Ny offert',
    description: null,
    line_items: [
      createEmptyLineItem(),
      createEmptyLineItem(),
      createEmptyLineItem()
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Calculate line item totals
 */
export function calculateLineItemTotal(item: OfferLineItem): number | null {
  if (item.unit_price === null) return null;
  return item.unit_price * item.quantity;
}

/**
 * Calculate offer total
 */
export function calculateOfferTotal(draft: OfferDraft): number | null {
  let total = 0;
  let hasAllPrices = true;

  for (const item of draft.line_items) {
    const itemTotal = calculateLineItemTotal(item);
    if (itemTotal === null) {
      hasAllPrices = false;
      break;
    }
    total += itemTotal;
  }

  return hasAllPrices ? total : null;
}

/**
 * Get match status badge variant
 */
export function getMatchStatusVariant(status: MatchStatus | null): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'EXACT':
      return 'success';
    case 'FUZZY':
    case 'MULTIPLE':
      return 'warning';
    case 'NOT_FOUND':
    case 'ERROR':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Get match status label
 */
export function getMatchStatusLabel(status: MatchStatus | null): string {
  switch (status) {
    case 'EXACT':
      return 'Exakt matchning';
    case 'FUZZY':
      return 'Delvis matchning';
    case 'MULTIPLE':
      return 'Flera kandidater';
    case 'NOT_FOUND':
      return 'Ej hittad';
    case 'ERROR':
      return 'Fel';
    case 'TEMP_UNAVAILABLE':
      return 'Temporärt otillgänglig';
    default:
      return 'Ej kontrollerad';
  }
}
