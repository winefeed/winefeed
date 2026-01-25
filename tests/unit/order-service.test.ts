import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit Tests: Order Service
 *
 * Tests for order status transitions, IOR access control, and order lifecycle.
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
    chain.range = vi.fn(() => chain);
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

// Mock import-service
vi.mock('@/lib/import-service', () => ({
  importService: {
    createImportCase: vi.fn().mockResolvedValue({ id: 'import-123' }),
  },
}));

// Import after mocks are set up
import { orderService, OrderStatus } from '@/lib/order-service';

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // setOrderStatus() - Status Transition Tests
  // ==========================================================================
  describe('setOrderStatus - Status Transitions', () => {
    describe('Valid Transitions', () => {
      const validTransitions: [OrderStatus, OrderStatus][] = [
        [OrderStatus.CONFIRMED, OrderStatus.IN_FULFILLMENT],
        [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        [OrderStatus.IN_FULFILLMENT, OrderStatus.SHIPPED],
        [OrderStatus.IN_FULFILLMENT, OrderStatus.CANCELLED],
        [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
        [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      ];

      validTransitions.forEach(([from, to]) => {
        it(`allows transition from ${from} to ${to}`, async () => {
          // Mock order fetch - returns order with current status
          const fetchChain = createChainableMock({ data: { status: from }, error: null });

          // Mock order update - chain with success result
          const updateChain = createChainableMock({ data: null, error: null });

          // Mock event insert - success
          const eventsChain = createChainableMock({ data: null, error: null });

          let queryCount = 0;
          mockFrom.mockImplementation((table: string) => {
            if (table === 'orders') {
              queryCount++;
              return queryCount === 1 ? fetchChain : updateChain;
            }
            if (table === 'order_events') return eventsChain;
            return createChainableMock();
          });

          const result = await orderService.setOrderStatus({
            order_id: 'order-1',
            tenant_id: 'tenant-1',
            to_status: to,
          });

          expect(result.from_status).toBe(from);
          expect(result.to_status).toBe(to);
        });
      });
    });

    describe('Invalid Transitions', () => {
      const invalidTransitions: [OrderStatus, OrderStatus][] = [
        // DELIVERED is terminal
        [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        [OrderStatus.DELIVERED, OrderStatus.SHIPPED],
        // CANCELLED is terminal
        [OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
        [OrderStatus.CANCELLED, OrderStatus.IN_FULFILLMENT],
        // Cannot skip states
        [OrderStatus.CONFIRMED, OrderStatus.SHIPPED],
        [OrderStatus.CONFIRMED, OrderStatus.DELIVERED],
        [OrderStatus.IN_FULFILLMENT, OrderStatus.DELIVERED],
        // Cannot go backwards
        [OrderStatus.SHIPPED, OrderStatus.IN_FULFILLMENT],
        [OrderStatus.SHIPPED, OrderStatus.CONFIRMED],
        [OrderStatus.IN_FULFILLMENT, OrderStatus.CONFIRMED],
      ];

      invalidTransitions.forEach(([from, to]) => {
        it(`blocks transition from ${from} to ${to}`, async () => {
          const fetchChain = createChainableMock();
          fetchChain.single.mockResolvedValueOnce({
            data: { status: from },
            error: null,
          });

          mockFrom.mockReturnValue(fetchChain);

          await expect(
            orderService.setOrderStatus({
              order_id: 'order-1',
              tenant_id: 'tenant-1',
              to_status: to,
            })
          ).rejects.toThrow(`Invalid status transition: Cannot change from ${from} to ${to}`);
        });
      });
    });

    it('throws error when order not found', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        orderService.setOrderStatus({
          order_id: 'nonexistent',
          tenant_id: 'tenant-1',
          to_status: OrderStatus.IN_FULFILLMENT,
        })
      ).rejects.toThrow('Order not found: Not found');
    });

    it('creates audit event on status change', async () => {
      const fetchChain = createChainableMock({ data: { status: OrderStatus.CONFIRMED }, error: null });
      const updateChain = createChainableMock({ data: null, error: null });

      const eventsChain = createChainableMock({ data: null, error: null });
      const insertMock = vi.fn(() => eventsChain);
      eventsChain.insert = insertMock;

      let queryCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') {
          queryCount++;
          return queryCount === 1 ? fetchChain : updateChain;
        }
        if (table === 'order_events') return eventsChain;
        return createChainableMock();
      });

      await orderService.setOrderStatus({
        order_id: 'order-1',
        tenant_id: 'tenant-1',
        to_status: OrderStatus.IN_FULFILLMENT,
        actor_user_id: 'user-1',
        actor_name: 'Test User',
        note: 'Started fulfillment',
      });

      expect(insertMock).toHaveBeenCalled();
      const insertCall = insertMock.mock.calls[0][0];
      expect(insertCall.event_type).toBe('STATUS_CHANGED');
      expect(insertCall.from_status).toBe(OrderStatus.CONFIRMED);
      expect(insertCall.to_status).toBe(OrderStatus.IN_FULFILLMENT);
      expect(insertCall.actor_user_id).toBe('user-1');
      expect(insertCall.note).toBe('Started fulfillment');
    });
  });

  // ==========================================================================
  // listOrdersForIOR() - IOR Access Control Tests
  // ==========================================================================
  describe('listOrdersForIOR - IOR Access Control', () => {
    it('filters orders by importer_of_record_id', async () => {
      const mockOrders = [
        { id: 'order-1', importer_of_record_id: 'imp-1' },
        { id: 'order-2', importer_of_record_id: 'imp-1' },
      ];

      const ordersChain = createChainableMock();
      const eqMock = vi.fn().mockReturnThis();
      ordersChain.eq = eqMock;
      ordersChain.range.mockReturnValue({ data: mockOrders, error: null });

      mockFrom.mockReturnValue(ordersChain);

      const result = await orderService.listOrdersForIOR({
        importer_id: 'imp-1',
        tenant_id: 'tenant-1',
      });

      expect(result).toHaveLength(2);
      // Verify importer_of_record_id filter was applied
      expect(eqMock).toHaveBeenCalledWith('importer_of_record_id', 'imp-1');
    });

    it('enforces tenant isolation', async () => {
      const ordersChain = createChainableMock();
      const eqMock = vi.fn().mockReturnThis();
      ordersChain.eq = eqMock;
      ordersChain.range.mockReturnValue({ data: [], error: null });

      mockFrom.mockReturnValue(ordersChain);

      await orderService.listOrdersForIOR({
        importer_id: 'imp-1',
        tenant_id: 'tenant-specific',
      });

      // Verify tenant_id filter was applied
      expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-specific');
    });

    it('filters by status when provided', async () => {
      const ordersChain = createChainableMock({ data: [], error: null });
      const eqMock = vi.fn(() => ordersChain);
      ordersChain.eq = eqMock;

      mockFrom.mockReturnValue(ordersChain);

      await orderService.listOrdersForIOR({
        importer_id: 'imp-1',
        tenant_id: 'tenant-1',
        status: OrderStatus.IN_FULFILLMENT,
      });

      // Verify status filter was applied
      expect(eqMock).toHaveBeenCalledWith('status', OrderStatus.IN_FULFILLMENT);
    });

    it('respects pagination parameters', async () => {
      const ordersChain = createChainableMock();
      const rangeMock = vi.fn().mockReturnValue({ data: [], error: null });
      ordersChain.range = rangeMock;

      mockFrom.mockReturnValue(ordersChain);

      await orderService.listOrdersForIOR({
        importer_id: 'imp-1',
        tenant_id: 'tenant-1',
        limit: 10,
        offset: 20,
      });

      // Verify range was called with correct parameters
      expect(rangeMock).toHaveBeenCalledWith(20, 29); // offset to offset+limit-1
    });

    it('throws error on query failure', async () => {
      const ordersChain = createChainableMock();
      ordersChain.range.mockReturnValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockFrom.mockReturnValue(ordersChain);

      await expect(
        orderService.listOrdersForIOR({
          importer_id: 'imp-1',
          tenant_id: 'tenant-1',
        })
      ).rejects.toThrow('Failed to list orders for IOR: Database error');
    });
  });

  // ==========================================================================
  // linkImportCase() - IOR Access Control Tests
  // ==========================================================================
  describe('linkImportCase - IOR Verification', () => {
    it('verifies IOR matches between order and import case', async () => {
      // Mock order fetch
      const orderChain = createChainableMock({ data: { id: 'order-1', importer_of_record_id: 'imp-1' }, error: null });

      // Mock import case fetch
      const importChain = createChainableMock({ data: { id: 'import-1', tenant_id: 'tenant-1', importer_id: 'imp-1' }, error: null });

      // Mock order update - thenable chain
      const updateChain = createChainableMock({ data: null, error: null });

      // Mock events - thenable chain
      const eventsChain = createChainableMock({ data: null, error: null });

      let queryCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') {
          queryCount++;
          return queryCount === 1 ? orderChain : updateChain;
        }
        if (table === 'imports') return importChain;
        if (table === 'order_events') return eventsChain;
        return createChainableMock();
      });

      // Should not throw
      await expect(
        orderService.linkImportCase({
          order_id: 'order-1',
          import_id: 'import-1',
          tenant_id: 'tenant-1',
        })
      ).resolves.not.toThrow();
    });

    it('throws error when IOR does not match', async () => {
      // Mock order fetch
      const orderChain = createChainableMock();
      orderChain.single.mockResolvedValueOnce({
        data: { id: 'order-1', importer_of_record_id: 'imp-1' },
        error: null,
      });

      // Mock import case fetch - different importer
      const importChain = createChainableMock();
      importChain.single.mockResolvedValueOnce({
        data: { id: 'import-1', tenant_id: 'tenant-1', importer_id: 'imp-OTHER' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') return orderChain;
        if (table === 'imports') return importChain;
        return createChainableMock();
      });

      await expect(
        orderService.linkImportCase({
          order_id: 'order-1',
          import_id: 'import-1',
          tenant_id: 'tenant-1',
        })
      ).rejects.toThrow('IOR mismatch');
    });
  });

  // ==========================================================================
  // confirmOrderBySupplier() Tests
  // ==========================================================================
  describe('confirmOrderBySupplier', () => {
    it('confirms order when supplier matches and status is correct', async () => {
      // Mock order fetch
      const fetchChain = createChainableMock({
        data: {
          id: 'order-1',
          status: 'PENDING_SUPPLIER_CONFIRMATION',
          seller_supplier_id: 'sup-1',
        },
        error: null,
      });

      // Mock order update - thenable chain
      const updateChain = createChainableMock({ data: null, error: null });

      // Mock events insert - thenable chain
      const eventsChain = createChainableMock({ data: null, error: null });

      let queryCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') {
          queryCount++;
          return queryCount === 1 ? fetchChain : updateChain;
        }
        if (table === 'order_events') return eventsChain;
        return createChainableMock();
      });

      const result = await orderService.confirmOrderBySupplier({
        order_id: 'order-1',
        tenant_id: 'tenant-1',
        supplier_id: 'sup-1',
      });

      expect(result.status).toBe('CONFIRMED');
    });

    it('rejects confirmation from wrong supplier', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: {
          id: 'order-1',
          status: 'PENDING_SUPPLIER_CONFIRMATION',
          seller_supplier_id: 'sup-1',
        },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        orderService.confirmOrderBySupplier({
          order_id: 'order-1',
          tenant_id: 'tenant-1',
          supplier_id: 'sup-WRONG',
        })
      ).rejects.toThrow('Access denied: You are not the supplier for this order');
    });

    it('rejects confirmation when order not in pending status', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: {
          id: 'order-1',
          status: 'CONFIRMED', // Already confirmed
          seller_supplier_id: 'sup-1',
        },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        orderService.confirmOrderBySupplier({
          order_id: 'order-1',
          tenant_id: 'tenant-1',
          supplier_id: 'sup-1',
        })
      ).rejects.toThrow('Cannot confirm order: Order is in status CONFIRMED');
    });
  });

  // ==========================================================================
  // declineOrderBySupplier() Tests
  // ==========================================================================
  describe('declineOrderBySupplier', () => {
    it('declines order when supplier matches and status is correct', async () => {
      // Mock order fetch
      const fetchChain = createChainableMock({
        data: {
          id: 'order-1',
          status: 'PENDING_SUPPLIER_CONFIRMATION',
          seller_supplier_id: 'sup-1',
        },
        error: null,
      });

      // Mock order update - thenable chain
      const updateChain = createChainableMock({ data: null, error: null });

      // Mock events insert - thenable chain with tracked insert
      const eventsChain = createChainableMock({ data: null, error: null });
      const insertMock = vi.fn(() => eventsChain);
      eventsChain.insert = insertMock;

      let queryCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') {
          queryCount++;
          return queryCount === 1 ? fetchChain : updateChain;
        }
        if (table === 'order_events') return eventsChain;
        return createChainableMock();
      });

      const result = await orderService.declineOrderBySupplier({
        order_id: 'order-1',
        tenant_id: 'tenant-1',
        supplier_id: 'sup-1',
        reason: 'Out of stock',
      });

      expect(result.status).toBe('CANCELLED');
      // Verify reason is logged
      const insertCall = insertMock.mock.calls[0][0];
      expect(insertCall.note).toContain('Out of stock');
    });

    it('rejects decline from wrong supplier', async () => {
      const fetchChain = createChainableMock();
      fetchChain.single.mockResolvedValueOnce({
        data: {
          id: 'order-1',
          status: 'PENDING_SUPPLIER_CONFIRMATION',
          seller_supplier_id: 'sup-1',
        },
        error: null,
      });

      mockFrom.mockReturnValue(fetchChain);

      await expect(
        orderService.declineOrderBySupplier({
          order_id: 'order-1',
          tenant_id: 'tenant-1',
          supplier_id: 'sup-WRONG',
          reason: 'Test',
        })
      ).rejects.toThrow('Access denied: You are not the supplier for this order');
    });
  });

  // ==========================================================================
  // createOrderFromAcceptedOffer() Tests
  // ==========================================================================
  describe('createOrderFromAcceptedOffer', () => {
    it('throws error when offer is not ACCEPTED', async () => {
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'DRAFT', // Not accepted
          supplier_id: 'sup-1',
        },
        error: null,
      });

      mockFrom.mockReturnValue(offerChain);

      await expect(
        orderService.createOrderFromAcceptedOffer({
          offer_id: 'offer-1',
          tenant_id: 'tenant-1',
        })
      ).rejects.toThrow('Cannot create order from offer with status: DRAFT');
    });

    it('throws error when offer has no supplier_id', async () => {
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'ACCEPTED',
          supplier_id: null, // Missing
        },
        error: null,
      });

      mockFrom.mockReturnValue(offerChain);

      await expect(
        orderService.createOrderFromAcceptedOffer({
          offer_id: 'offer-1',
          tenant_id: 'tenant-1',
        })
      ).rejects.toThrow('Offer missing supplier_id');
    });

    it('throws error when EU supplier has no default_importer_id', async () => {
      // Mock offer fetch
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'ACCEPTED',
          supplier_id: 'sup-1',
          restaurant_id: 'rest-1',
        },
        error: null,
      });

      // Mock supplier fetch - EU without importer
      const supplierChain = createChainableMock();
      supplierChain.single.mockResolvedValueOnce({
        data: {
          id: 'sup-1',
          type: 'EU_PRODUCER',
          default_importer_id: null, // Missing
        },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'suppliers') return supplierChain;
        return createChainableMock();
      });

      await expect(
        orderService.createOrderFromAcceptedOffer({
          offer_id: 'offer-1',
          tenant_id: 'tenant-1',
        })
      ).rejects.toThrow('EU supplier sup-1 missing default_importer_id');
    });

    it('creates order with correct IOR for Swedish importer', async () => {
      // Mock offer fetch
      const offerChain = createChainableMock();
      offerChain.single.mockResolvedValueOnce({
        data: {
          id: 'offer-1',
          status: 'ACCEPTED',
          supplier_id: 'sup-1',
          restaurant_id: 'rest-1',
          currency: 'SEK',
        },
        error: null,
      });

      // Mock supplier fetch
      const supplierChain = createChainableMock();
      supplierChain.single.mockResolvedValueOnce({
        data: {
          id: 'sup-1',
          type: 'SWEDISH_IMPORTER',
          default_importer_id: 'imp-1',
        },
        error: null,
      });

      // Mock offer lines fetch
      const linesChain = createChainableMock();
      linesChain.order.mockReturnValue({
        data: [{ id: 'line-1', name: 'Wine', quantity: 6, line_no: 1 }],
        error: null,
      });

      // Mock order creation
      const orderCreateChain = createChainableMock();
      const insertMock = vi.fn().mockReturnThis();
      orderCreateChain.insert = insertMock;
      orderCreateChain.single.mockResolvedValueOnce({
        data: { id: 'order-new' },
        error: null,
      });

      // Mock order_lines insert
      const orderLinesChain = createChainableMock();
      orderLinesChain.insert.mockReturnValue({ error: null });

      // Mock order_events insert
      const eventsChain = createChainableMock();
      eventsChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'offers') return offerChain;
        if (table === 'suppliers') return supplierChain;
        if (table === 'offer_lines') return linesChain;
        if (table === 'orders') return orderCreateChain;
        if (table === 'order_lines') return orderLinesChain;
        if (table === 'order_events') return eventsChain;
        return createChainableMock();
      });

      const result = await orderService.createOrderFromAcceptedOffer({
        offer_id: 'offer-1',
        tenant_id: 'tenant-1',
      });

      expect(result.order_id).toBe('order-new');
      // Verify importer_of_record_id was set
      expect(insertMock).toHaveBeenCalled();
      const insertCall = insertMock.mock.calls[0][0];
      expect(insertCall.importer_of_record_id).toBe('imp-1');
    });
  });

  // ==========================================================================
  // getOrder() Tests
  // ==========================================================================
  describe('getOrder', () => {
    it('returns null when order not found', async () => {
      const orderChain = createChainableMock();
      orderChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockFrom.mockReturnValue(orderChain);

      const result = await orderService.getOrder('nonexistent', 'tenant-1');

      expect(result).toBeNull();
    });

    it('returns order with lines and events', async () => {
      const mockOrder = { id: 'order-1', status: 'CONFIRMED' };
      const mockLines = [{ id: 'line-1', wine_name: 'Test Wine' }];
      const mockEvents = [{ id: 'event-1', event_type: 'ORDER_CREATED' }];

      const orderChain = createChainableMock();
      orderChain.single.mockResolvedValueOnce({ data: mockOrder, error: null });

      const linesChain = createChainableMock();
      linesChain.order.mockReturnValue({ data: mockLines, error: null });

      const eventsChain = createChainableMock();
      eventsChain.order.mockReturnValue({ data: mockEvents, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') return orderChain;
        if (table === 'order_lines') return linesChain;
        if (table === 'order_events') return eventsChain;
        return createChainableMock();
      });

      const result = await orderService.getOrder('order-1', 'tenant-1');

      expect(result).not.toBeNull();
      expect(result?.order.id).toBe('order-1');
      expect(result?.lines).toHaveLength(1);
      expect(result?.events).toHaveLength(1);
    });
  });
});
