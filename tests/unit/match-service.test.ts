import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit Tests: Match Service
 *
 * Tests for hierarchical matching, auto-create policy, and match status.
 * Mocks Supabase and Wine-Searcher service to test logic in isolation.
 */

// Use vi.hoisted to define mocks that will be hoisted with vi.mock
const { mockFrom, createChainableMock, mockCheckWine } = vi.hoisted(() => {
  const createChainableMock = () => {
    const chain: any = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    };
    return chain;
  };

  const mockFrom = vi.fn(() => createChainableMock());
  const mockCheckWine = vi.fn();

  return { mockFrom, createChainableMock, mockCheckWine };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/winesearcher-service', () => ({
  wineSearcherService: {
    checkWine: mockCheckWine,
  },
}));

// Import after mocks are set up
import { matchService, MatchProductInput, MatchStatus, MatchMethod } from '@/lib/match-service';

describe('MatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATCHING_ENABLE_AUTO_CREATE = 'true';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Matching Hierarchy Tests
  // ==========================================================================
  describe('Matching Hierarchy', () => {
    it('prioritizes GTIN matching first', async () => {
      // Mock GTIN found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValueOnce({
        data: { entity_type: 'wine_sku', entity_id: 'sku-123' },
        error: null,
      });

      // Mock match_results logging
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {
          gtin: '1234567890123',
          lwin: 'LWIN-123', // Should be ignored since GTIN matched
          producer_sku: 'SKU-1',
        },
      };

      const result = await matchService.matchProduct(input);

      expect(result.match_method).toBe('GTIN_EXACT');
      expect(result.matched_entity_type).toBe('wine_sku');
      expect(result.matched_entity_id).toBe('sku-123');
      expect(result.status).toBe('AUTO_MATCH');
      expect(result.confidence).toBe(1.0);
    });

    it('falls back to LWIN when GTIN not found', async () => {
      let callCount = 0;
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // GTIN not found
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        // LWIN found
        return Promise.resolve({
          data: { entity_type: 'wine_master', entity_id: 'master-456' },
          error: null,
        });
      });

      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {
          gtin: '1234567890123',
          lwin: 'LWIN-123',
        },
      };

      const result = await matchService.matchProduct(input);

      expect(result.match_method).toBe('LWIN_EXACT');
      expect(result.matched_entity_type).toBe('wine_master');
      expect(result.status).toBe('AUTO_MATCH');
    });

    it('falls back to Producer SKU when GTIN and LWIN not found', async () => {
      let callCount = 0;
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // GTIN and LWIN not found
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        // Producer SKU found
        return Promise.resolve({
          data: { entity_type: 'wine_sku', entity_id: 'sku-789' },
          error: null,
        });
      });

      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {
          gtin: '1234567890123',
          lwin: 'LWIN-123',
          producer_sku: 'PROD-SKU-1',
          producer_id: 'producer-1',
        },
      };

      const result = await matchService.matchProduct(input);

      expect(result.match_method).toBe('SKU_EXACT');
      expect(result.status).toBe('AUTO_MATCH_WITH_GUARDS');
      expect(result.confidence).toBe(0.95);
    });

    it('falls back to Importer SKU when previous methods fail', async () => {
      let callCount = 0;
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          // GTIN, LWIN, and Producer SKU not found
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        // Importer SKU found
        return Promise.resolve({
          data: { entity_type: 'wine_sku', entity_id: 'sku-imp' },
          error: null,
        });
      });

      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {
          gtin: '1234567890123',
          lwin: 'LWIN-123',
          producer_sku: 'PROD-SKU-1',
          producer_id: 'producer-1',
          importer_sku: 'IMP-SKU-1',
          importer_id: 'importer-1',
        },
      };

      const result = await matchService.matchProduct(input);

      expect(result.match_method).toBe('SKU_EXACT');
      expect(result.matched_entity_id).toBe('sku-imp');
      expect(result.confidence).toBe(0.9);
    });
  });

  // ==========================================================================
  // Auto-Create Policy Tests
  // ==========================================================================
  describe('Auto-Create Policy', () => {
    it('auto-creates wine_sku for GTIN when not found (enabled)', async () => {
      process.env.MATCHING_ENABLE_AUTO_CREATE = 'true';

      // Mock GTIN not found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock wine_master creation
      const masterChain = createChainableMock();
      masterChain.single.mockResolvedValueOnce({
        data: { id: 'master-new' },
        error: null,
      });

      // Mock wine_sku creation
      const skuChain = createChainableMock();
      skuChain.single.mockResolvedValueOnce({
        data: { id: 'sku-new' },
        error: null,
      });

      // Mock identifier registration
      const identifierInsertChain = createChainableMock();
      identifierInsertChain.insert.mockReturnValue({ error: null });

      // Mock match results
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      let identifierCalls = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') {
          identifierCalls++;
          // First call is lookup, subsequent calls are inserts
          return identifierCalls === 1 ? identifiersChain : identifierInsertChain;
        }
        if (table === 'wine_masters') return masterChain;
        if (table === 'wine_skus') return skuChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: { gtin: '9876543210123' },
        textFallback: { name: 'New Wine' },
      };

      const result = await matchService.matchProduct(input);

      expect(result.status).toBe('AUTO_MATCH_WITH_GUARDS');
      expect(result.match_method).toBe('GTIN_EXACT');
      expect(result.matched_entity_type).toBe('wine_sku');
      expect(result.explanation).toContain('auto-create enabled');
    });

    it('does NOT auto-create for canonical/text matches (policy)', async () => {
      // All identifiers not found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock Wine-Searcher response
      mockCheckWine.mockResolvedValueOnce({
        data: {
          match_status: 'MATCHED',
          canonical_name: 'Château Margaux',
          producer: 'Château Margaux',
          match_score: 90,
          candidates: [],
        },
      });

      // Mock wine_masters lookup (no existing matches)
      const mastersChain = createChainableMock();
      mastersChain.limit.mockReturnValue({ data: [], error: null });

      // Mock match results
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'wine_masters') return mastersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {}, // No identifiers
        textFallback: { name: 'Château Margaux 2015', vintage: 2015 },
      };

      const result = await matchService.matchProduct(input);

      // Should return SUGGESTED, not AUTO_MATCH
      expect(result.status).toBe('SUGGESTED');
      expect(result.match_method).toBe('CANONICAL_SUGGEST');
      // Should NOT have created any entities
      expect(result.matched_entity_id).toBeUndefined();
    });
  });

  // ==========================================================================
  // Canonical Matching Tests
  // ==========================================================================
  describe('Canonical Matching (Wine-Searcher)', () => {
    it('returns SUGGESTED status for canonical matches', async () => {
      // No identifiers found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock Wine-Searcher
      mockCheckWine.mockResolvedValueOnce({
        data: {
          match_status: 'MATCHED',
          canonical_name: 'Opus One',
          producer: 'Opus One Winery',
          match_score: 85,
          candidates: [
            { name: 'Opus One 2018', producer: 'Opus One Winery', score: 85 },
          ],
        },
      });

      // Mock existing wine_masters - found similar
      const mastersChain = createChainableMock();
      mastersChain.limit.mockReturnValue({
        data: [
          { id: 'master-opus', canonical_name: 'Opus One', producer: 'Opus One Winery', region: 'Napa Valley' },
        ],
        error: null,
      });

      // Mock match results
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'wine_masters') return mastersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {},
        textFallback: { name: 'Opus One 2018', vintage: 2018 },
      };

      const result = await matchService.matchProduct(input);

      expect(result.match_method).toBe('CANONICAL_SUGGEST');
      // Medium confidence matches should be SUGGESTED
      expect(['SUGGESTED', 'AUTO_MATCH_WITH_GUARDS']).toContain(result.status);
      expect(result.matched_entity_type).toBe('wine_master');
    });

    it('returns PENDING_REVIEW when Wine-Searcher returns NOT_FOUND', async () => {
      // No identifiers found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock Wine-Searcher - not found
      mockCheckWine.mockResolvedValueOnce({
        data: {
          match_status: 'NOT_FOUND',
          candidates: [],
        },
      });

      // Mock match results
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {},
        textFallback: { name: 'Unknown Wine XYZ' },
      };

      const result = await matchService.matchProduct(input);

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.confidence).toBe(0);
    });

    it('handles Wine-Searcher errors gracefully', async () => {
      // No identifiers found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock Wine-Searcher error
      mockCheckWine.mockRejectedValueOnce(new Error('API timeout'));

      // Mock match results
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {},
        textFallback: { name: 'Test Wine' },
      };

      const result = await matchService.matchProduct(input);

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.explanation).toContain('Failed to match via Wine-Searcher');
    });
  });

  // ==========================================================================
  // No Match / Fallback Tests
  // ==========================================================================
  describe('No Match Scenarios', () => {
    it('returns PENDING_REVIEW when no identifiers or text provided', async () => {
      // Mock match results
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'manual', source_id: 'manual-1' },
        identifiers: {},
        // No textFallback
      };

      const result = await matchService.matchProduct(input);

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.match_method).toBe('NO_MATCH');
      expect(result.confidence).toBe(0);
      expect(result.explanation).toContain('No identifiers or text provided');
    });
  });

  // ==========================================================================
  // Match Result Logging Tests
  // ==========================================================================
  describe('Match Result Logging', () => {
    it('logs match result to database', async () => {
      // Mock GTIN found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValueOnce({
        data: { entity_type: 'wine_sku', entity_id: 'sku-123' },
        error: null,
      });

      // Mock match results with assertion
      const matchResultsChain = createChainableMock();
      const insertMock = vi.fn().mockReturnValue({ error: null });
      matchResultsChain.insert = insertMock;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: { gtin: '1234567890123' },
      };

      await matchService.matchProduct(input);

      expect(insertMock).toHaveBeenCalled();
      const insertData = insertMock.mock.calls[0][0];
      expect(insertData.tenant_id).toBe('tenant-1');
      expect(insertData.source_type).toBe('offer_line');
      expect(insertData.source_id).toBe('line-1');
      expect(insertData.match_method).toBe('GTIN_EXACT');
      expect(insertData.status).toBe('AUTO_MATCH');
    });

    it('continues matching even if logging fails', async () => {
      // Mock GTIN found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValueOnce({
        data: { entity_type: 'wine_sku', entity_id: 'sku-123' },
        error: null,
      });

      // Mock match results - fail
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockRejectedValueOnce(new Error('DB Error'));

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: { gtin: '1234567890123' },
      };

      // Should not throw, logging failure is non-blocking
      const result = await matchService.matchProduct(input);

      expect(result.match_method).toBe('GTIN_EXACT');
      expect(result.status).toBe('AUTO_MATCH');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles empty GTIN gracefully', async () => {
      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: { gtin: '' }, // Empty GTIN
      };

      // Should skip GTIN matching and return no match
      const result = await matchService.matchProduct(input);

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.match_method).toBe('NO_MATCH');
    });

    it('requires producer_id for producer SKU matching', async () => {
      // GTIN and LWIN not found
      const identifiersChain = createChainableMock();
      identifiersChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const matchResultsChain = createChainableMock();
      matchResultsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_identifiers') return identifiersChain;
        if (table === 'match_results') return matchResultsChain;
        return createChainableMock();
      });

      const input: MatchProductInput = {
        tenantId: 'tenant-1',
        source: { source_type: 'offer_line', source_id: 'line-1' },
        identifiers: {
          producer_sku: 'SKU-1',
          // Missing producer_id
        },
      };

      const result = await matchService.matchProduct(input);

      // Should skip producer SKU matching due to missing producer_id
      expect(result.match_method).toBe('NO_MATCH');
    });
  });
});
