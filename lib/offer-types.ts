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
 * Shipping Adjustment Request
 * Restaurant can request adjustment, supplier makes the change
 */
export interface ShippingAdjustmentRequest {
  id: string;
  reason: string; // e.g., "Vi ligger i Malmö, 60 mil - kan ni se över frakten?"
  status: 'PENDING' | 'ADJUSTED' | 'DECLINED';
  created_at: string;
  responded_at: string | null;
}

/**
 * Shipping Adjustment Record
 * Tracks history of shipping cost changes by supplier
 */
export interface ShippingAdjustment {
  id: string;
  previous_amount: number | null;
  new_amount: number | null;
  is_franco: boolean; // true = shipping included in wine price
  reason: string; // Supplier's note on why they adjusted
  request_id: string | null; // Links to restaurant's request if applicable
  created_at: string;
}

/**
 * Shipping Information for Offers
 * Supports both franco (included) and separate shipping costs
 */
export interface OfferShipping {
  // Current shipping
  is_franco: boolean; // true = "fritt levererat", shipping included
  shipping_cost_sek: number | null; // null if franco
  shipping_notes: string | null; // e.g., "Leverans till Stockholm"

  // Adjustment requests from restaurant
  adjustment_requests: ShippingAdjustmentRequest[];

  // Adjustment history by supplier (for transparency)
  adjustments: ShippingAdjustment[];

  // Metadata
  original_cost_sek: number | null; // First quoted shipping cost
  last_updated_at: string | null;
}

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

  // Shipping information
  shipping: OfferShipping | null;

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
    shipping: null,
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

/**
 * Create empty shipping info
 */
export function createEmptyShipping(): OfferShipping {
  return {
    is_franco: false,
    shipping_cost_sek: null,
    shipping_notes: null,
    adjustment_requests: [],
    adjustments: [],
    original_cost_sek: null,
    last_updated_at: null,
  };
}

/**
 * Create franco shipping (included in price)
 */
export function createFrancoShipping(notes?: string): OfferShipping {
  return {
    is_franco: true,
    shipping_cost_sek: null,
    shipping_notes: notes || 'Fritt levererat - frakt ingår i priset',
    adjustment_requests: [],
    adjustments: [],
    original_cost_sek: null,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Create shipping with specified cost
 */
export function createShippingWithCost(costSek: number, notes?: string): OfferShipping {
  return {
    is_franco: false,
    shipping_cost_sek: costSek,
    shipping_notes: notes || null,
    adjustment_requests: [],
    adjustments: [],
    original_cost_sek: costSek,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Create adjustment request from restaurant
 */
export function createAdjustmentRequest(reason: string): ShippingAdjustmentRequest {
  return {
    id: crypto.randomUUID(),
    reason,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    responded_at: null,
  };
}

/**
 * Apply shipping adjustment by supplier
 */
export function applyShippingAdjustment(
  shipping: OfferShipping,
  newAmount: number | null,
  isFranco: boolean,
  reason: string,
  requestId?: string
): OfferShipping {
  const adjustment: ShippingAdjustment = {
    id: crypto.randomUUID(),
    previous_amount: shipping.shipping_cost_sek,
    new_amount: newAmount,
    is_franco: isFranco,
    reason,
    request_id: requestId || null,
    created_at: new Date().toISOString(),
  };

  // Update request status if applicable
  const updatedRequests = shipping.adjustment_requests.map(req =>
    req.id === requestId
      ? { ...req, status: 'ADJUSTED' as const, responded_at: new Date().toISOString() }
      : req
  );

  return {
    ...shipping,
    is_franco: isFranco,
    shipping_cost_sek: newAmount,
    adjustment_requests: updatedRequests,
    adjustments: [...shipping.adjustments, adjustment],
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Decline adjustment request
 */
export function declineAdjustmentRequest(
  shipping: OfferShipping,
  requestId: string
): OfferShipping {
  const updatedRequests = shipping.adjustment_requests.map(req =>
    req.id === requestId
      ? { ...req, status: 'DECLINED' as const, responded_at: new Date().toISOString() }
      : req
  );

  return {
    ...shipping,
    adjustment_requests: updatedRequests,
  };
}

/**
 * Calculate total with shipping
 */
export function calculateOfferTotalWithShipping(draft: OfferDraft): { subtotal: number | null; shipping: number | null; total: number | null } {
  const subtotal = calculateOfferTotal(draft);
  const shipping = draft.shipping?.is_franco ? 0 : (draft.shipping?.shipping_cost_sek ?? null);

  if (subtotal === null) {
    return { subtotal: null, shipping, total: null };
  }

  const total = shipping !== null ? subtotal + shipping : subtotal;
  return { subtotal, shipping, total };
}

/**
 * Get shipping status label
 */
export function getShippingStatusLabel(shipping: OfferShipping | null): string {
  if (!shipping) return 'Ej angiven';
  if (shipping.is_franco) return 'Fritt levererat';
  if (shipping.shipping_cost_sek === null) return 'Ej angiven';
  return `${shipping.shipping_cost_sek.toLocaleString('sv-SE')} kr`;
}

/**
 * Check if shipping has pending adjustment request from restaurant
 */
export function hasPendingAdjustmentRequest(shipping: OfferShipping | null): boolean {
  if (!shipping) return false;
  return shipping.adjustment_requests.some(req => req.status === 'PENDING');
}

/**
 * Get pending adjustment request
 */
export function getPendingAdjustmentRequest(shipping: OfferShipping | null): ShippingAdjustmentRequest | null {
  if (!shipping) return null;
  return shipping.adjustment_requests.find(req => req.status === 'PENDING') || null;
}

/**
 * Check if shipping was adjusted from original
 */
export function wasShippingAdjusted(shipping: OfferShipping | null): boolean {
  if (!shipping) return false;
  return shipping.adjustments.length > 0;
}

/**
 * Get shipping adjustment history summary
 */
export function getShippingAdjustmentSummary(shipping: OfferShipping | null): string {
  if (!shipping || shipping.adjustments.length === 0) return '';

  const original = shipping.original_cost_sek;
  const current = shipping.shipping_cost_sek;

  if (shipping.is_franco) {
    return `Justerad till fritt levererat (ursprungligen ${original?.toLocaleString('sv-SE')} kr)`;
  }

  if (original !== null && current !== null && original !== current) {
    const diff = current - original;
    const sign = diff > 0 ? '+' : '';
    return `Justerad: ${sign}${diff.toLocaleString('sv-SE')} kr från ursprungliga ${original.toLocaleString('sv-SE')} kr`;
  }

  return '';
}
