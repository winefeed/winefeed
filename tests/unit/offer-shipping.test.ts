import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyShipping,
  createFrancoShipping,
  createShippingWithCost,
  createAdjustmentRequest,
  applyShippingAdjustment,
  declineAdjustmentRequest,
  hasPendingAdjustmentRequest,
  getPendingAdjustmentRequest,
  wasShippingAdjusted,
  getShippingAdjustmentSummary,
  getShippingStatusLabel,
  OfferShipping,
} from '@/lib/offer-types';

/**
 * Unit Tests: Offer Shipping Types and Helpers
 *
 * Tests the shipping-related functions in offer-types.ts:
 * - Creating shipping info (empty, franco, with cost)
 * - Adjustment requests and approvals
 * - Status labels and summaries
 */

describe('Offer Shipping Types', () => {
  describe('createEmptyShipping', () => {
    it('creates empty shipping with default values', () => {
      const shipping = createEmptyShipping();

      expect(shipping.is_franco).toBe(false);
      expect(shipping.shipping_cost_sek).toBeNull();
      expect(shipping.shipping_notes).toBeNull();
      expect(shipping.adjustment_requests).toEqual([]);
      expect(shipping.adjustments).toEqual([]);
      expect(shipping.original_cost_sek).toBeNull();
      expect(shipping.last_updated_at).toBeNull();
    });
  });

  describe('createFrancoShipping', () => {
    it('creates franco shipping (shipping included in price)', () => {
      const shipping = createFrancoShipping();

      expect(shipping.is_franco).toBe(true);
      expect(shipping.shipping_cost_sek).toBeNull();
      expect(shipping.shipping_notes).toBe('Fritt levererat - frakt ingår i priset');
      expect(shipping.last_updated_at).not.toBeNull();
    });

    it('accepts custom notes', () => {
      const shipping = createFrancoShipping('Fritt levererat inom Stockholms län');

      expect(shipping.is_franco).toBe(true);
      expect(shipping.shipping_notes).toBe('Fritt levererat inom Stockholms län');
    });
  });

  describe('createShippingWithCost', () => {
    it('creates shipping with specified cost', () => {
      const shipping = createShippingWithCost(850);

      expect(shipping.is_franco).toBe(false);
      expect(shipping.shipping_cost_sek).toBe(850);
      expect(shipping.original_cost_sek).toBe(850);
      expect(shipping.last_updated_at).not.toBeNull();
    });

    it('accepts custom notes', () => {
      const shipping = createShippingWithCost(1200, 'Pallfrakt till Malmö');

      expect(shipping.shipping_cost_sek).toBe(1200);
      expect(shipping.shipping_notes).toBe('Pallfrakt till Malmö');
    });
  });

  describe('getShippingStatusLabel', () => {
    it('returns "Ej angiven" for null shipping', () => {
      expect(getShippingStatusLabel(null)).toBe('Ej angiven');
    });

    it('returns "Fritt levererat" for franco', () => {
      const shipping = createFrancoShipping();
      expect(getShippingStatusLabel(shipping)).toBe('Fritt levererat');
    });

    it('returns formatted cost for specified shipping', () => {
      const shipping = createShippingWithCost(1500);
      expect(getShippingStatusLabel(shipping)).toMatch(/1[\s,.]?500 kr/);
    });

    it('returns "Ej angiven" for empty shipping', () => {
      const shipping = createEmptyShipping();
      expect(getShippingStatusLabel(shipping)).toBe('Ej angiven');
    });
  });

  describe('Adjustment Requests', () => {
    let shipping: OfferShipping;

    beforeEach(() => {
      shipping = createShippingWithCost(850, 'Stockholmsfrakt');
    });

    it('creates adjustment request from restaurant', () => {
      const request = createAdjustmentRequest('Vi ligger i Malmö, 60 mil - kan ni se över frakten?');

      expect(request.id).toBeDefined();
      expect(request.reason).toBe('Vi ligger i Malmö, 60 mil - kan ni se över frakten?');
      expect(request.status).toBe('PENDING');
      expect(request.responded_at).toBeNull();
      expect(request.created_at).toBeDefined();
    });

    it('hasPendingAdjustmentRequest returns false for no requests', () => {
      expect(hasPendingAdjustmentRequest(shipping)).toBe(false);
    });

    it('hasPendingAdjustmentRequest returns true when request pending', () => {
      const request = createAdjustmentRequest('Kan ni sänka frakten?');
      shipping.adjustment_requests.push(request);

      expect(hasPendingAdjustmentRequest(shipping)).toBe(true);
    });

    it('getPendingAdjustmentRequest returns the pending request', () => {
      const request = createAdjustmentRequest('Kan ni sänka frakten?');
      shipping.adjustment_requests.push(request);

      const pending = getPendingAdjustmentRequest(shipping);
      expect(pending).not.toBeNull();
      expect(pending!.reason).toBe('Kan ni sänka frakten?');
    });
  });

  describe('applyShippingAdjustment', () => {
    it('supplier adjusts shipping cost', () => {
      let shipping = createShippingWithCost(850, 'Stockholmsfrakt');
      const request = createAdjustmentRequest('Malmö är 60 mil');
      shipping.adjustment_requests.push(request);

      const adjusted = applyShippingAdjustment(
        shipping,
        1200, // New cost
        false, // Not franco
        'Justerat för längre sträcka till Malmö',
        request.id
      );

      expect(adjusted.shipping_cost_sek).toBe(1200);
      expect(adjusted.is_franco).toBe(false);
      expect(adjusted.adjustments.length).toBe(1);
      expect(adjusted.adjustments[0].previous_amount).toBe(850);
      expect(adjusted.adjustments[0].new_amount).toBe(1200);
      expect(adjusted.adjustments[0].reason).toBe('Justerat för längre sträcka till Malmö');
      expect(adjusted.adjustments[0].request_id).toBe(request.id);

      // Request should be marked as adjusted
      const updatedRequest = adjusted.adjustment_requests.find(r => r.id === request.id);
      expect(updatedRequest!.status).toBe('ADJUSTED');
      expect(updatedRequest!.responded_at).not.toBeNull();
    });

    it('supplier can change to franco', () => {
      let shipping = createShippingWithCost(850);

      const adjusted = applyShippingAdjustment(
        shipping,
        null, // No cost
        true, // Franco
        'Vi bjuder på frakten för denna order'
      );

      expect(adjusted.is_franco).toBe(true);
      expect(adjusted.shipping_cost_sek).toBeNull();
      expect(adjusted.adjustments[0].is_franco).toBe(true);
    });
  });

  describe('declineAdjustmentRequest', () => {
    it('marks request as declined', () => {
      let shipping = createShippingWithCost(850);
      const request = createAdjustmentRequest('Kan ni sänka frakten?');
      shipping.adjustment_requests.push(request);

      const declined = declineAdjustmentRequest(shipping, request.id);

      const updatedRequest = declined.adjustment_requests.find(r => r.id === request.id);
      expect(updatedRequest!.status).toBe('DECLINED');
      expect(updatedRequest!.responded_at).not.toBeNull();

      // Shipping cost unchanged
      expect(declined.shipping_cost_sek).toBe(850);
    });
  });

  describe('wasShippingAdjusted', () => {
    it('returns false for new shipping', () => {
      const shipping = createShippingWithCost(850);
      expect(wasShippingAdjusted(shipping)).toBe(false);
    });

    it('returns true after adjustment', () => {
      let shipping = createShippingWithCost(850);
      shipping = applyShippingAdjustment(shipping, 1000, false, 'Höjt pga avstånd');

      expect(wasShippingAdjusted(shipping)).toBe(true);
    });
  });

  describe('getShippingAdjustmentSummary', () => {
    it('returns empty string for no adjustments', () => {
      const shipping = createShippingWithCost(850);
      expect(getShippingAdjustmentSummary(shipping)).toBe('');
    });

    it('returns summary after adjustment', () => {
      let shipping = createShippingWithCost(850);
      shipping = applyShippingAdjustment(shipping, 1200, false, 'Justerat');

      const summary = getShippingAdjustmentSummary(shipping);
      expect(summary).toContain('Justerad');
      expect(summary).toContain('+350');
      expect(summary).toContain('850');
    });

    it('returns franco summary when changed to franco', () => {
      let shipping = createShippingWithCost(850);
      shipping = applyShippingAdjustment(shipping, null, true, 'Bjuder på frakt');

      const summary = getShippingAdjustmentSummary(shipping);
      expect(summary).toContain('fritt levererat');
      expect(summary).toContain('850');
    });
  });
});

describe('B2B Pricing Clarity', () => {
  it('shipping cost is always ex moms', () => {
    // In B2B, all prices should be ex moms
    // Shipping cost is separate and should not have VAT applied
    const shipping = createShippingWithCost(850, 'Leverans Malmö');

    // The shipping_cost_sek is the actual cost (ex moms)
    expect(shipping.shipping_cost_sek).toBe(850);

    // This is added to wine total (also ex moms) for total order value
  });

  it('franco indicates shipping included in wine price', () => {
    const shipping = createFrancoShipping();

    // Franco means supplier has included shipping in their wine price
    expect(shipping.is_franco).toBe(true);
    expect(shipping.shipping_cost_sek).toBeNull();

    // The wine price already includes shipping, no extra amount needed
  });
});
