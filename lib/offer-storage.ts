/**
 * OFFER STORAGE UTILS
 *
 * Client-side storage for offer drafts using localStorage
 * MVP: No backend persistence yet
 *
 * TODO: Replace with API calls when offer_lines table is ready
 */

import { OfferDraft, assertNoForbiddenFieldsInEnrichment } from './offer-types';

const STORAGE_KEY = 'winefeed_offer_drafts';

/**
 * Get all offer drafts from localStorage
 */
export function getAllOfferDrafts(): OfferDraft[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const drafts = JSON.parse(stored);
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    console.error('Failed to load offer drafts from localStorage:', error);
    return [];
  }
}

/**
 * Get single offer draft by ID
 */
export function getOfferDraft(id: string): OfferDraft | null {
  const drafts = getAllOfferDrafts();
  return drafts.find(d => d.id === id) || null;
}

/**
 * Save offer draft to localStorage
 */
export function saveOfferDraft(draft: OfferDraft): void {
  if (typeof window === 'undefined') return;

  try {
    // POLICY GUARD: Validate all enrichments for forbidden fields
    for (const item of draft.line_items) {
      if (item.enrichment) {
        assertNoForbiddenFieldsInEnrichment(item.enrichment);
      }
    }

    const drafts = getAllOfferDrafts();
    const existingIndex = drafts.findIndex(d => d.id === draft.id);

    const updatedDraft = {
      ...draft,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Update existing
      drafts[existingIndex] = updatedDraft;
    } else {
      // Add new
      drafts.push(updatedDraft);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to save offer draft to localStorage:', error);

    // If security violation, re-throw with clear message
    if (error instanceof Error && error.message.includes('SECURITY_VIOLATION')) {
      throw error;
    }

    throw new Error('Kunde inte spara offert. Försök igen.');
  }
}

/**
 * Delete offer draft from localStorage
 */
export function deleteOfferDraft(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const drafts = getAllOfferDrafts();
    const filtered = drafts.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete offer draft from localStorage:', error);
    throw new Error('Kunde inte ta bort offert. Försök igen.');
  }
}

/**
 * TODO: Replace with API calls when backend is ready
 *
 * Example future implementation:
 *
 * export async function saveOfferDraft(draft: OfferDraft): Promise<void> {
 *   const response = await fetch('/api/offers/drafts', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(draft)
 *   });
 *
 *   if (!response.ok) {
 *     throw new Error('Failed to save offer draft');
 *   }
 * }
 */
