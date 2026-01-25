import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit Tests: Offer Service
 *
 * Tests for offer CRUD, status workflow, and immutability after acceptance.
 * Mocks Supabase to test service logic in isolation.
 */

// Use vi.hoisted to define mocks that will be hoisted with vi.mock
const { mockFrom, createChainableMock } = vi.hoisted(() => {
  // Creates a chainable mock that is also thenable (can be awaited)
  const createChainableMock = (defaultResult?: { data?: any; error?: any }) => {
    const result = defaultResult || { data: null, error: null };
    const chain: any = {};

    // Make the chain thenable so await works
    chain.then = (resolve: (value: any) => any, reject?: (reason: any) => any) => {
      return Promise.resolve(result).then(resolve, reject);
    };

    // All methods return chain for proper chaining
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);

    // single() and maybeSingle() return promises
    chain.single = vi.fn(() => Promise.resolve(result));
    chain.maybeSingle = vi.fn(() => Promise.resolve(result));

    // Helper to change result for this chain
    chain._setResult = (newResult: { data?: any; error?: any }) => {
      Object.assign(result, newResult);
    };

    return chain;
  };

  const mockFrom = vi.fn(() => createChainableMock());

  return { mockFrom, createChainableMock };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// Import after mocks are set up
import { offerService } from '@/lib/offer-service';
import type { CreateOfferInput, OfferLineEnrichment } from '@/lib/offer-service';

describe('OfferService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // createOffer() Tests
  // ==========================================================================
  describe('createOffer', () => {
    it('creates offer with lines successfully', async () => {
      const offerId = 'offer-123';

      // Setup mock chain for offers table
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({ data: { id: offerId }, error: null });

      // Setup mock chain for offer_lines table
      const linesChain = createChainableMock();

      // Setup mock chain for offer_events table
      const eventsChain = createChainableMock();
      eventsChain.insert.mockResolvedValueOnce({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') return eventsChain;
        return createChainableMock();
      });

      const input: CreateOfferInput = {
        tenant_id: 'tenant-1',
        restaurant_id: 'rest-1',
        request_id: 'req-1',
        supplier_id: 'sup-1',
        title: 'Test Offer',
        currency: 'SEK',
        lines: [
          {
            line_no: 1,
            name: 'Château Margaux 2015',
            vintage: 2015,
            quantity: 6,
            offered_unit_price_ore: 150000,
          },
          {
            line_no: 2,
            name: 'Opus One 2018',
            vintage: 2018,
            quantity: 3,
            offered_unit_price_ore: 200000,
          },
        ],
      };

      const result = await offerService.createOffer(input);

      expect(result.offer_id).toBe(offerId);
      expect(mockFrom).toHaveBeenCalledWith('offers');
      expect(mockFrom).toHaveBeenCalledWith('offer_lines');
      expect(mockFrom).toHaveBeenCalledWith('offer_events');
    });

    it('throws error when offer creation fails', async () => {
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      mockFrom.mockReturnValue(offerChain);

      const input: CreateOfferInput = {
        tenant_id: 'tenant-1',
        restaurant_id: 'rest-1',
        lines: [{ line_no: 1, name: 'Test Wine', quantity: 1 }],
      };

      await expect(offerService.createOffer(input)).rejects.toThrow(
        'Failed to create offer: Database error'
      );
    });

    it('validates enrichment and rejects price data', async () => {
      const input: CreateOfferInput = {
        tenant_id: 'tenant-1',
        restaurant_id: 'rest-1',
        lines: [
          {
            line_no: 1,
            name: 'Test Wine',
            quantity: 1,
            enrichment: {
              canonical_name: 'Test Wine',
              // @ts-expect-error - Testing forbidden field
              market_price: 1000,
            },
          },
        ],
      };

      await expect(offerService.createOffer(input)).rejects.toThrow(
        'SECURITY_VIOLATION: Forbidden price data detected in enrichment'
      );
    });

    it('rolls back offer when line creation fails', async () => {
      const offerId = 'offer-to-rollback';

      // Mock offer creation success
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({ data: { id: offerId }, error: null });

      // Mock lines insertion failure
      const linesChain = createChainableMock();
      linesChain.insert.mockReturnValue({
        error: { message: 'Lines insert failed' },
      });

      // Mock delete for rollback
      const deleteChain = createChainableMock();

      let offerCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') {
          offerCallCount++;
          return offerCallCount === 1 ? offerChain : deleteChain;
        }
        if (table === 'offer_lines') return linesChain;
        return createChainableMock();
      });

      const input: CreateOfferInput = {
        tenant_id: 'tenant-1',
        restaurant_id: 'rest-1',
        lines: [{ line_no: 1, name: 'Test', quantity: 1 }],
      };

      await expect(offerService.createOffer(input)).rejects.toThrow(
        'Failed to create offer lines: Lines insert failed'
      );
    });
  });

  // ==========================================================================
  // updateOffer() Tests
  // ==========================================================================
  describe('updateOffer', () => {
    it('allows update when status is DRAFT', async () => {
      let queryCount = 0;

      // Mock fetch: DRAFT status
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: { status: 'DRAFT', locked_at: null },
        error: null,
      });

      // Mock update
      const updateChain = createChainableMock();
      updateChain.single.mockResolvedValueOnce({
        data: { id: 'offer-1', title: 'Updated Title', status: 'DRAFT' },
        error: null,
      });

      // Mock events insert
      const eventsChain = createChainableMock();
      eventsChain.insert.mockResolvedValueOnce({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') {
          queryCount++;
          return queryCount === 1 ? fetchChain : updateChain;
        }
        if (table === 'offer_events') return eventsChain;
        return createChainableMock();
      });

      const result = await offerService.updateOffer('tenant-1', 'offer-1', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('blocks update when status is ACCEPTED', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: { status: 'ACCEPTED', locked_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        offerService.updateOffer('tenant-1', 'offer-1', { title: 'New Title' })
      ).rejects.toThrow('Cannot update offer: status is ACCEPTED');
    });

    it('blocks update when offer is locked', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: { status: 'DRAFT', locked_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        offerService.updateOffer('tenant-1', 'offer-1', { title: 'New Title' })
      ).rejects.toThrow('Cannot update offer: status is DRAFT');
    });

    it('throws error when offer not found', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        offerService.updateOffer('tenant-1', 'nonexistent', { title: 'X' })
      ).rejects.toThrow('Offer not found: Not found');
    });
  });

  // ==========================================================================
  // updateOfferLines() Tests
  // ==========================================================================
  describe('updateOfferLines', () => {
    it('blocks line updates when offer is not DRAFT', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: { status: 'ACCEPTED', locked_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        offerService.updateOfferLines('tenant-1', 'offer-1', [
          { line_no: 1, quantity: 10 },
        ])
      ).rejects.toThrow('Cannot update lines: status is ACCEPTED');
    });

    it('validates enrichment on line updates', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: { status: 'DRAFT', locked_at: null },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        offerService.updateOfferLines('tenant-1', 'offer-1', [
          {
            line_no: 1,
            enrichment: {
              canonical_name: 'Wine',
              // @ts-expect-error - Testing forbidden field
              price_usd: 50,
            },
          },
        ])
      ).rejects.toThrow('SECURITY_VIOLATION: Forbidden price data detected');
    });
  });

  // ==========================================================================
  // acceptOffer() Tests
  // ==========================================================================
  describe('acceptOffer', () => {
    it('locks offer and creates snapshot on acceptance', async () => {
      const mockOffer = {
        id: 'offer-1',
        tenant_id: 'tenant-1',
        restaurant_id: 'rest-1',
        status: 'DRAFT',
        locked_at: null,
        request_id: null,
      };

      const mockLines = [
        { id: 'line-1', name: 'Wine 1', quantity: 6 },
        { id: 'line-2', name: 'Wine 2', quantity: 3 },
      ];

      // Mock getOffer internally - thenable chains
      const offerChain = createChainableMock({ data: mockOffer, error: null });
      const linesChain = createChainableMock({ data: mockLines, error: null });
      const eventsChain = createChainableMock({ data: [], error: null });
      const matchChain = createChainableMock({ data: [], error: null });

      // Mock update for acceptance
      const updateChain = createChainableMock({
        data: { ...mockOffer, status: 'ACCEPTED', locked_at: new Date().toISOString() },
        error: null,
      });

      // Mock event insert
      const eventInsertChain = createChainableMock({ data: null, error: null });

      let offersQueryCount = 0;
      let eventsQueryCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') {
          offersQueryCount++;
          return offersQueryCount === 1 ? offerChain : updateChain;
        }
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') {
          eventsQueryCount++;
          return eventsQueryCount === 1 ? eventsChain : eventInsertChain;
        }
        if (table === 'match_results') return matchChain;
        return createChainableMock();
      });

      const result = await offerService.acceptOffer('tenant-1', 'offer-1', 'user-1');

      expect(result.offer.status).toBe('ACCEPTED');
      expect(result.offer.locked_at).toBeDefined();
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.lines).toHaveLength(2);
    });

    it('throws error when offer already accepted', async () => {
      const mockOffer = {
        id: 'offer-1',
        status: 'ACCEPTED',
        locked_at: null,
      };

      // Use thenable chains with results set
      const offerChain = createChainableMock({ data: mockOffer, error: null });
      const linesChain = createChainableMock({ data: [], error: null });
      const eventsChain = createChainableMock({ data: [], error: null });
      const matchChain = createChainableMock({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') return eventsChain;
        if (table === 'match_results') return matchChain;
        return createChainableMock();
      });

      await expect(
        offerService.acceptOffer('tenant-1', 'offer-1')
      ).rejects.toThrow('Offer already accepted');
    });

    it('throws error when offer is already locked', async () => {
      const mockOffer = {
        id: 'offer-1',
        status: 'DRAFT',
        locked_at: '2024-01-01T00:00:00Z',
      };

      // Use thenable chains with results set
      const offerChain = createChainableMock({ data: mockOffer, error: null });
      const linesChain = createChainableMock({ data: [], error: null });
      const eventsChain = createChainableMock({ data: [], error: null });
      const matchChain = createChainableMock({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') return eventsChain;
        if (table === 'match_results') return matchChain;
        return createChainableMock();
      });

      await expect(
        offerService.acceptOffer('tenant-1', 'offer-1')
      ).rejects.toThrow('Offer is already locked');
    });

    it('throws error when request already has accepted offer', async () => {
      const mockOffer = {
        id: 'offer-1',
        status: 'DRAFT',
        locked_at: null,
        request_id: 'req-1',
      };

      const mockRequest = {
        id: 'req-1',
        accepted_offer_id: 'other-offer',
        status: 'ACCEPTED',
      };

      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({ data: mockOffer, error: null });

      const linesChain = createChainableMock();
      linesChain.order.mockReturnValue({ error: null, data: [] });

      const eventsChain = createChainableMock();
      eventsChain.order.mockReturnValue({ error: null, data: [] });

      const matchChain = createChainableMock();
      matchChain.order.mockReturnValue({ error: null, data: [] });

      const requestChain = createChainableMock();
      requestChain.single.mockResolvedValueOnce({ data: mockRequest, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') return eventsChain;
        if (table === 'match_results') return matchChain;
        if (table === 'requests') return requestChain;
        return createChainableMock();
      });

      await expect(
        offerService.acceptOffer('tenant-1', 'offer-1')
      ).rejects.toThrow('Request already has an accepted offer');
    });
  });

  // ==========================================================================
  // validateEnrichment() Security Tests
  // ==========================================================================
  describe('validateEnrichment (Security)', () => {
    const testForbiddenPatterns = [
      { field: 'price', value: { price: 100 } },
      { field: 'market_price', value: { market_price: 100 } },
      { field: 'price_usd', value: { price_usd: 50 } },
      { field: 'offer_price', value: { offer_price: 200 } },
      { field: 'currency', value: { currency: 'USD' } },
      { field: 'cost', value: { cost: 150 } },
      { field: 'value', value: { value: 500 } },
      { field: 'USD symbol', value: { note: '$100' } },
      { field: 'EUR symbol', value: { note: '100 €' } },
      { field: 'GBP symbol', value: { note: '£50' } },
    ];

    testForbiddenPatterns.forEach(({ field, value }) => {
      it(`rejects enrichment containing ${field}`, async () => {
        const input: CreateOfferInput = {
          tenant_id: 'tenant-1',
          restaurant_id: 'rest-1',
          lines: [
            {
              line_no: 1,
              name: 'Test Wine',
              quantity: 1,
              enrichment: value as OfferLineEnrichment,
            },
          ],
        };

        await expect(offerService.createOffer(input)).rejects.toThrow(
          'SECURITY_VIOLATION: Forbidden price data detected in enrichment'
        );
      });
    });

    it('allows valid enrichment without price data', async () => {
      const validEnrichment: OfferLineEnrichment = {
        canonical_name: 'Château Margaux',
        producer: 'Château Margaux',
        country: 'France',
        region: 'Bordeaux',
        appellation: 'Margaux',
        ws_id: 'ws-12345',
        match_status: 'MATCHED',
        match_score: 95,
      };

      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({ data: { id: 'offer-1' }, error: null });

      const linesChain = createChainableMock();
      const eventsChain = createChainableMock();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') return eventsChain;
        return createChainableMock();
      });

      const input: CreateOfferInput = {
        tenant_id: 'tenant-1',
        restaurant_id: 'rest-1',
        lines: [
          {
            line_no: 1,
            name: 'Test Wine',
            quantity: 1,
            enrichment: validEnrichment,
          },
        ],
      };

      const result = await offerService.createOffer(input);
      expect(result.offer_id).toBe('offer-1');
    });
  });

  // ==========================================================================
  // getOffer() Tests
  // ==========================================================================
  describe('getOffer', () => {
    it('returns null when offer not found', async () => {
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      mockFrom.mockReturnValue(offerChain);

      const result = await offerService.getOffer('tenant-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('returns offer with lines and events', async () => {
      const mockOffer = { id: 'offer-1', tenant_id: 'tenant-1', status: 'DRAFT' };
      const mockLines = [{ id: 'line-1', name: 'Wine' }];
      const mockEvents = [{ id: 'event-1', event_type: 'CREATED' }];

      // Use thenable chains with results set
      const offerChain = createChainableMock({ data: mockOffer, error: null });
      const linesChain = createChainableMock({ data: mockLines, error: null });
      const eventsChain = createChainableMock({ data: mockEvents, error: null });
      const matchChain = createChainableMock({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'offer_events') return eventsChain;
        if (table === 'match_results') return matchChain;
        return createChainableMock();
      });

      const result = await offerService.getOffer('tenant-1', 'offer-1');

      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe('offer-1');
      expect(result?.lines).toHaveLength(1);
      expect(result?.events).toHaveLength(1);
    });
  });
});
