/**
 * MOQ HELPER - Types & Validation
 *
 * Feature flag: FEATURE_MOQ_HELPER=false (default)
 *
 * POLICY REMINDERS:
 * - Only available when access_request.status is ACCEPTED
 * - Only request owner can add items
 * - Items must be from SAME importer
 * - NO cart, NO checkout, NO payment totals
 * - This is a "fill-up helper", not commerce
 */

import { z } from 'zod';

// ============================================
// FEATURE FLAG
// ============================================

export function isMOQHelperEnabled(): boolean {
  return process.env.FEATURE_MOQ_HELPER === 'true';
}

// Client-side check
export function isMOQHelperEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_MOQ_HELPER === 'true';
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Request statuses that allow MOQ helper additions.
 * Matches: ACCEPTED states in Vinkoll Access flow
 */
export const ACCEPTED_STATUSES_FOR_MOQ = ['besvarad', 'meddelad', 'slutford'] as const;
export type AcceptedStatusForMOQ = (typeof ACCEPTED_STATUSES_FOR_MOQ)[number];

/**
 * Reasons why an item was added to a request
 */
export const ADDED_REASONS = ['MOQ_HELPER', 'MANUAL', 'SUGGESTED'] as const;
export type AddedReason = (typeof ADDED_REASONS)[number];

/**
 * MOQ helper event types for analytics
 */
export const MOQ_EVENT_TYPES = [
  'BANNER_SHOWN',
  'SUGGESTIONS_SHOWN',
  'SUGGESTION_CLICKED',
  'ITEM_ADDED',
  'ITEM_REMOVED',
  'DISMISSED',
] as const;
export type MOQEventType = (typeof MOQ_EVENT_TYPES)[number];

/**
 * Maximum items per addition (guardrail)
 */
export const MAX_QUANTITY_PER_ITEM = 24;

/**
 * Maximum suggestions to return
 */
export const MAX_SUGGESTIONS = 8;

// ============================================
// TYPES
// ============================================

/**
 * Access request item (additional items added via MOQ helper)
 */
export interface AccessRequestItem {
  id: string;
  access_request_id: string;
  lot_id: string;
  wine_id: string;
  wine_name: string;
  vintage: number | null;
  importer_name: string;
  quantity: number;
  added_reason: AddedReason;
  added_by: string | null;
  created_at: string;
}

/**
 * MOQ helper event (audit/analytics)
 */
export interface MOQHelperEvent {
  id: string;
  access_request_id: string;
  actor_id: string | null;
  event_type: MOQEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * MOQ status for a request
 */
export interface MOQStatus {
  /** Importer's minimum order quantity in bottles */
  moq_bottles: number | null;
  /** Current total bottles (original + added) */
  current_bottles: number;
  /** How many more bottles needed to meet MOQ (0 if met) */
  deficit: number;
  /** Whether MOQ is met */
  is_met: boolean;
  /** Optional note from importer about MOQ */
  moq_note: string | null;
}

/**
 * Wine suggestion for MOQ fill-up
 */
export interface MOQSuggestion {
  lot_id: string;
  wine_id: string;
  wine_name: string;
  vintage: number | null;
  wine_type: string | null;
  producer_name: string | null;
  appellation: string | null;
  grapes: string[] | null;
  bottle_size_ml: number | null;
  /** Indicative price (if available) - NOT for checkout */
  indicative_price_sek: number | null;
  /** Why this was suggested */
  match_reason: 'same_producer' | 'same_type' | 'same_importer';
}

/**
 * Full MOQ helper response
 */
export interface MOQHelperResponse {
  status: MOQStatus;
  suggestions: MOQSuggestion[];
  /** Items already added to this request */
  added_items: AccessRequestItem[];
}

// ============================================
// ZOD SCHEMAS
// ============================================

/**
 * Schema for adding an item via MOQ helper
 */
export const addMOQItemSchema = z.object({
  lot_id: z.string().uuid('Invalid lot ID'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be positive')
    .max(MAX_QUANTITY_PER_ITEM, `Maximum ${MAX_QUANTITY_PER_ITEM} bottles per item`),
});

export type AddMOQItemInput = z.infer<typeof addMOQItemSchema>;

/**
 * Schema for logging MOQ events
 */
export const logMOQEventSchema = z.object({
  event_type: z.enum(MOQ_EVENT_TYPES),
  payload: z.record(z.unknown()).optional().default({}),
});

export type LogMOQEventInput = z.infer<typeof logMOQEventSchema>;

// ============================================
// HELPERS
// ============================================

/**
 * Check if a request status allows MOQ helper
 */
export function isStatusAcceptedForMOQ(status: string): boolean {
  return ACCEPTED_STATUSES_FOR_MOQ.includes(status as AcceptedStatusForMOQ);
}

/**
 * Calculate MOQ deficit
 */
export function calculateMOQDeficit(moqBottles: number | null, currentBottles: number): number {
  if (moqBottles === null || moqBottles <= 0) return 0;
  return Math.max(0, moqBottles - currentBottles);
}

/**
 * Format display name for a wine (with vintage handling)
 */
export function formatWineDisplayName(name: string, vintage: number | null): string {
  if (vintage === null) {
    // Check if name already contains "NV" or "Non-Vintage"
    if (/\bNV\b|non.?vintage/i.test(name)) {
      return name;
    }
    return `${name} NV`;
  }
  // Check if name already contains the vintage
  if (name.includes(String(vintage))) {
    return name;
  }
  return `${name} ${vintage}`;
}
