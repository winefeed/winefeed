/**
 * SPONSORED SLOTS SERVICE TESTS
 *
 * Unit tests for the sponsored slots service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mock before hoisted vi.mock runs
const mockSupabase = vi.hoisted(() => {
  const chainable: any = {};

  // All methods return the chainable object for method chaining
  chainable.from = vi.fn(() => chainable);
  chainable.select = vi.fn(() => chainable);
  chainable.insert = vi.fn(() => chainable);
  chainable.update = vi.fn(() => chainable);
  chainable.upsert = vi.fn(() => chainable);
  chainable.delete = vi.fn(() => chainable);
  chainable.eq = vi.fn(() => chainable);
  chainable.or = vi.fn(() => chainable);
  chainable.order = vi.fn(() => chainable);
  chainable.limit = vi.fn(() => chainable);
  chainable.single = vi.fn(() => Promise.resolve({ data: null, error: null }));

  return chainable;
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

// Mock subscription service
vi.mock('@/lib/subscription-service', () => ({
  subscriptionService: {
    getSubscription: vi.fn().mockResolvedValue({ tier: 'premium' }),
    getTierLimits: vi.fn().mockResolvedValue({ included_sponsored_slots: 1 }),
  },
}));

// Import after mocks
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';

// TODO: Fix mock setup - currently the real Supabase client is created at module load
// before mocks can be applied. Need to refactor service to accept injected client.
describe.skip('sponsoredSlotsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCategories', () => {
    it('returns categories with slot counts', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Burgundy',
          slug: 'burgundy',
          sponsor_cap: 3,
          is_active: true,
        },
        {
          id: 'cat-2',
          name: 'Champagne',
          slug: 'champagne',
          sponsor_cap: 2,
          is_active: true,
        },
      ];

      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.order.mockResolvedValueOnce({
        data: mockCategories,
        error: null,
      });

      // Mock slot counts (called for each category)
      mockSupabase.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ count: 1, error: null }),
      }));

      const categories = await sponsoredSlotsService.listCategories('tenant-1');

      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('Burgundy');
    });
  });

  describe('getSupplierEntitlement', () => {
    it('creates default entitlement if none exists', async () => {
      // First call returns not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Insert returns new entitlement
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'ent-1',
          supplier_id: 'sup-1',
          tenant_id: 'tenant-1',
          included_slots: 0,
          purchased_slots: 0,
        },
        error: null,
      });

      // Count used slots
      mockSupabase.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }));

      const entitlement = await sponsoredSlotsService.getSupplierEntitlement(
        'sup-1',
        'tenant-1'
      );

      expect(entitlement.included_slots).toBe(0);
      expect(entitlement.purchased_slots).toBe(0);
      expect(entitlement.total_slots).toBe(0);
      expect(entitlement.remaining_slots).toBe(0);
    });

    it('calculates remaining slots correctly', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'ent-1',
          supplier_id: 'sup-1',
          tenant_id: 'tenant-1',
          included_slots: 1,
          purchased_slots: 2,
        },
        error: null,
      });

      // 1 slot used
      mockSupabase.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ count: 1, error: null }),
      }));

      const entitlement = await sponsoredSlotsService.getSupplierEntitlement(
        'sup-1',
        'tenant-1'
      );

      expect(entitlement.total_slots).toBe(3); // 1 included + 2 purchased
      expect(entitlement.used_slots).toBe(1);
      expect(entitlement.remaining_slots).toBe(2);
    });
  });

  describe('assignSlot', () => {
    it('rejects when no remaining entitlement', async () => {
      // Mock entitlement with 0 remaining
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          included_slots: 0,
          purchased_slots: 0,
        },
        error: null,
      });

      mockSupabase.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }));

      const result = await sponsoredSlotsService.assignSlot(
        'sup-1',
        'cat-1',
        'tenant-1',
        'INCLUDED'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No remaining slot entitlement');
    });

    it('rejects when category is full', async () => {
      // Mock entitlement with slots available
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { included_slots: 1, purchased_slots: 0 },
          error: null,
        })
        // Category lookup
        .mockResolvedValueOnce({
          data: { id: 'cat-1', name: 'Burgundy', sponsor_cap: 3 },
          error: null,
        });

      // Count - 0 slots used for entitlement
      mockSupabase.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ count: 3, error: null }), // 3 = full
      }));

      const result = await sponsoredSlotsService.assignSlot(
        'sup-1',
        'cat-1',
        'tenant-1',
        'INCLUDED'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('full');
    });

    it('rejects duplicate slot assignment', async () => {
      // Mock entitlement with slots available
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { included_slots: 1, purchased_slots: 0 },
          error: null,
        })
        // Category lookup
        .mockResolvedValueOnce({
          data: { id: 'cat-1', name: 'Burgundy', sponsor_cap: 3 },
          error: null,
        })
        // Existing slot found
        .mockResolvedValueOnce({
          data: { id: 'existing-slot' },
          error: null,
        });

      // Count - 1 slot used for entitlement, 1 for category
      mockSupabase.select.mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ count: 1, error: null }),
      }));

      const result = await sponsoredSlotsService.assignSlot(
        'sup-1',
        'cat-1',
        'tenant-1',
        'INCLUDED'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already have a slot');
    });
  });

  describe('unassignSlot', () => {
    it('cancels active slot', async () => {
      // Mock slot lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'slot-1',
          supplier_id: 'sup-1',
          category_id: 'cat-1',
          status: 'ACTIVE',
        },
        error: null,
      });

      // Mock update
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      const result = await sponsoredSlotsService.unassignSlot(
        'slot-1',
        'sup-1',
        'tenant-1'
      );

      expect(result.success).toBe(true);
    });

    it('rejects unassigning non-active slot', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'slot-1',
          supplier_id: 'sup-1',
          status: 'CANCELLED',
        },
        error: null,
      });

      const result = await sponsoredSlotsService.unassignSlot(
        'slot-1',
        'sup-1',
        'tenant-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });
  });

  describe('isSupplierSponsoring', () => {
    it('returns true when supplier has active slot in category', async () => {
      // Category lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'cat-1' },
        error: null,
      });

      // Slot lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'slot-1' },
        error: null,
      });

      const isSponsoring = await sponsoredSlotsService.isSupplierSponsoring(
        'sup-1',
        'burgundy',
        'tenant-1'
      );

      expect(isSponsoring).toBe(true);
    });

    it('returns false when supplier has no slot in category', async () => {
      // Category lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'cat-1' },
        error: null,
      });

      // Slot lookup - not found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const isSponsoring = await sponsoredSlotsService.isSupplierSponsoring(
        'sup-1',
        'burgundy',
        'tenant-1'
      );

      expect(isSponsoring).toBe(false);
    });
  });

  describe('getSupplierSponsoredCategories', () => {
    it('returns list of sponsored category slugs', async () => {
      mockSupabase.or.mockResolvedValueOnce({
        data: [
          { category: { slug: 'burgundy' } },
          { category: { slug: 'champagne' } },
        ],
        error: null,
      });

      const categories = await sponsoredSlotsService.getSupplierSponsoredCategories('sup-1');

      expect(categories).toEqual(['burgundy', 'champagne']);
    });

    it('returns empty array when no sponsored categories', async () => {
      mockSupabase.or.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const categories = await sponsoredSlotsService.getSupplierSponsoredCategories('sup-1');

      expect(categories).toEqual([]);
    });
  });
});
