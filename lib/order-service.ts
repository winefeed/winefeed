/**
 * ORDER SERVICE - EU-SELLER → IOR OPERATIONAL FLOW
 *
 * Service layer for orders created from accepted offers
 * Handles order creation, fulfillment status tracking, and IOR operations
 *
 * Flow:
 * 1. Offer accepted → createOrderFromAcceptedOffer()
 * 2. IOR manages fulfillment → setOrderStatus()
 * 3. Audit trail via order_events
 *
 * Security:
 * - Tenant isolation
 * - IOR can only see orders where importer_of_record_id matches their importer
 * - Status transitions validated
 */

import { createClient } from '@supabase/supabase-js';
import { importService } from './import-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================================================
// TYPES
// ============================================================================

export enum OrderStatus {
  CONFIRMED = 'CONFIRMED',
  IN_FULFILLMENT = 'IN_FULFILLMENT',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export interface CreateOrderFromOfferInput {
  offer_id: string;
  tenant_id: string;
  actor_user_id?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  offer_id: string;
  request_id: string | null;
  seller_supplier_id: string;
  importer_of_record_id: string;
  delivery_location_id: string | null;
  import_case_id: string | null;
  status: OrderStatus;
  total_lines: number;
  total_quantity: number;
  currency: string;
  // Shipping info
  is_franco: boolean;
  shipping_cost_ore: number | null;
  shipping_notes: string | null;
  // Order value for Winefeed invoicing
  total_goods_amount_ore: number | null;
  total_order_value_ore: number | null;
  service_fee_mode: string;
  service_fee_amount_ore: number;
  // Delivery location from request
  delivery_city: string | null;
  delivery_address: string | null;
  delivery_postal_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderLine {
  id: string;
  tenant_id: string;
  order_id: string;
  wine_sku_id: string | null;
  wine_master_id: string | null;
  wine_name: string;
  producer: string | null;
  vintage: string | null;
  country: string | null;
  region: string | null;
  article_number: string | null;
  quantity: number;
  unit: string;
  unit_price_sek: number | null;
  total_price_sek: number | null;
  line_number: number;
  notes: string | null;
  created_at: string;
}

export interface OrderEvent {
  id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  metadata: any;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface SetOrderStatusInput {
  order_id: string;
  tenant_id: string;
  to_status: OrderStatus;
  actor_user_id?: string;
  actor_name?: string;
  note?: string;
  metadata?: any;
}

export interface ListOrdersForIORInput {
  importer_id: string;
  tenant_id: string;
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}

export interface LinkImportCaseInput {
  order_id: string;
  import_id: string;
  tenant_id: string;
}

export interface CreateImportCaseForOrderInput {
  order_id: string;
  tenant_id: string;
  actor_user_id?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class OrderService {
  /**
   * Create order from accepted offer
   * Called when offer transitions to ACCEPTED status
   */
  async createOrderFromAcceptedOffer(input: CreateOrderFromOfferInput): Promise<{ order_id: string }> {
    const { offer_id, tenant_id, actor_user_id } = input;

    // 1. Fetch offer with related data (including shipping)
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        id,
        tenant_id,
        restaurant_id,
        request_id,
        supplier_id,
        status,
        currency,
        is_franco,
        shipping_cost_sek,
        shipping_notes,
        created_at
      `)
      .eq('id', offer_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (offerError || !offer) {
      throw new Error(`Offer not found: ${offerError?.message || 'Unknown error'}`);
    }

    if (offer.status !== 'ACCEPTED') {
      throw new Error(`Cannot create order from offer with status: ${offer.status}. Must be ACCEPTED.`);
    }

    if (!offer.supplier_id) {
      throw new Error('Offer missing supplier_id - cannot create order');
    }

    // 2. Fetch supplier to determine importer_of_record_id
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, type, default_importer_id')
      .eq('id', offer.supplier_id)
      .single();

    if (supplierError || !supplier) {
      throw new Error(`Supplier not found: ${supplierError?.message || 'Unknown error'}`);
    }

    // Determine importer_of_record_id
    let importer_of_record_id: string;

    if (supplier.type === 'SWEDISH_IMPORTER') {
      // Swedish importer can act as their own IOR
      // For MVP: require them to have an entry in importers table
      // (In future: auto-link via org_number or have explicit mapping)
      if (!supplier.default_importer_id) {
        throw new Error(
          `SWEDISH_IMPORTER supplier ${supplier.id} missing default_importer_id. ` +
          'Even Swedish importers need an importer record to act as IOR.'
        );
      }
      importer_of_record_id = supplier.default_importer_id;
    } else {
      // EU supplier - must have default_importer_id (enforced by constraint)
      if (!supplier.default_importer_id) {
        throw new Error(
          `EU supplier ${supplier.id} missing default_importer_id. ` +
          'EU suppliers must have a Swedish IOR assigned.'
        );
      }
      importer_of_record_id = supplier.default_importer_id;
    }

    // 3. Fetch offer lines
    const { data: offerLines, error: offerLinesError } = await supabase
      .from('offer_lines')
      .select('*')
      .eq('offer_id', offer_id)
      .order('line_no', { ascending: true });

    if (offerLinesError) {
      throw new Error(`Failed to fetch offer lines: ${offerLinesError.message}`);
    }

    if (!offerLines || offerLines.length === 0) {
      throw new Error('Offer has no lines - cannot create order');
    }

    // 3b. Fetch request data for delivery location
    let deliveryCity: string | null = null;
    let deliveryAddress: string | null = null;
    let deliveryPostalCode: string | null = null;

    if (offer.request_id) {
      const { data: requestData } = await supabase
        .from('requests')
        .select('leverans_ort, leverans_adress, leverans_postnummer')
        .eq('id', offer.request_id)
        .single();

      if (requestData) {
        deliveryCity = requestData.leverans_ort || null;
        deliveryAddress = requestData.leverans_adress || null;
        deliveryPostalCode = requestData.leverans_postnummer || null;
      }
    }

    // 4. Create order
    const totalLines = offerLines.length;
    const totalQuantity = offerLines.reduce((sum, line) => sum + (line.quantity || 0), 0);

    // Calculate total goods amount in öre (for Winefeed invoicing)
    const totalGoodsAmountOre = offerLines.reduce((sum, line) => {
      const lineTotal = line.offered_unit_price_ore && line.quantity
        ? line.offered_unit_price_ore * line.quantity
        : 0;
      return sum + lineTotal;
    }, 0);

    // Shipping cost in öre (shipping_cost_sek is in SEK, convert to öre)
    const shippingCostOre = offer.shipping_cost_sek ? offer.shipping_cost_sek * 100 : 0;

    // Total order value = goods + shipping (for Winefeed invoicing)
    const totalOrderValueOre = totalGoodsAmountOre + shippingCostOre;

    // Determine initial order status based on supplier type
    // Swedish importers: require supplier confirmation before proceeding
    // EU suppliers: auto-confirmed (IOR handles fulfillment flow)
    const initialStatus = supplier.type === 'SWEDISH_IMPORTER'
      ? 'PENDING_SUPPLIER_CONFIRMATION'
      : 'CONFIRMED';

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id,
        restaurant_id: offer.restaurant_id,
        offer_id: offer.id,
        request_id: offer.request_id,
        seller_supplier_id: offer.supplier_id,
        importer_of_record_id,
        status: initialStatus,
        total_lines: totalLines,
        total_quantity: totalQuantity,
        currency: offer.currency || 'SEK',
        // Shipping info
        is_franco: offer.is_franco || false,
        shipping_cost_ore: shippingCostOre > 0 ? shippingCostOre : null,
        shipping_notes: offer.shipping_notes || null,
        // Order value for Winefeed invoicing
        total_goods_amount_ore: totalGoodsAmountOre,
        total_order_value_ore: totalOrderValueOre,
        service_fee_mode: 'PILOT_FREE', // No fee during pilot
        service_fee_amount_ore: 0,
        // Delivery location from request
        delivery_city: deliveryCity,
        delivery_address: deliveryAddress,
        delivery_postal_code: deliveryPostalCode,
        created_by: actor_user_id || null
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to create order: ${orderError?.message || 'Unknown error'}`);
    }

    // 5. Create order_lines (snapshot from offer_lines)
    const orderLinesToInsert = offerLines.map((offerLine, index) => ({
      tenant_id,
      order_id: order.id,
      wine_sku_id: offerLine.wine_sku_id || null,
      wine_master_id: offerLine.wine_master_id || null,
      wine_name: offerLine.name || 'Unknown',
      producer: offerLine.producer || null,
      vintage: offerLine.vintage ? String(offerLine.vintage) : null,
      country: offerLine.country || null,
      region: offerLine.region || null,
      article_number: offerLine.article_number || null,
      quantity: offerLine.quantity || 0,
      unit: offerLine.unit || 'flaska',
      unit_price_sek: offerLine.offered_unit_price_ore ? offerLine.offered_unit_price_ore / 100 : null,
      total_price_sek: offerLine.offered_unit_price_ore && offerLine.quantity
        ? (offerLine.offered_unit_price_ore / 100) * offerLine.quantity
        : null,
      line_number: offerLine.line_no || (index + 1),
      notes: offerLine.notes || null
    }));

    const { error: orderLinesError } = await supabase
      .from('order_lines')
      .insert(orderLinesToInsert);

    if (orderLinesError) {
      console.error('Failed to create order_lines:', orderLinesError);
      // Don't fail the entire order creation, but log error
      // In production, consider rollback or retry logic
    }

    // 6. Create order event (audit trail)
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        tenant_id,
        order_id: order.id,
        event_type: 'ORDER_CREATED',
        from_status: null,
        to_status: initialStatus,
        note: supplier.type === 'SWEDISH_IMPORTER'
          ? `Order created - awaiting supplier confirmation`
          : `Order created from accepted offer ${offer_id}`,
        metadata: {
          offer_id,
          seller_supplier_id: offer.supplier_id,
          importer_of_record_id,
          total_lines: totalLines,
          total_quantity: totalQuantity,
          supplier_type: supplier.type,
          // Order value tracking (for Winefeed invoicing)
          total_goods_amount_ore: totalGoodsAmountOre,
          shipping_cost_ore: shippingCostOre,
          total_order_value_ore: totalOrderValueOre,
          is_franco: offer.is_franco || false,
          delivery_city: deliveryCity
        },
        actor_user_id: actor_user_id || null,
        actor_name: null
      });

    if (eventError) {
      console.error('Failed to create order event:', eventError);
      // Don't fail, just log
    }

    // 7. Auto-create import case for EU orders (if DDL available)
    // This is a fail-safe operation - errors are logged but don't block order creation
    if (supplier.type === 'EU_PRODUCER' || supplier.type === 'EU_IMPORTER') {
      try {
        console.log(`EU order detected - attempting to auto-create import case for order ${order.id}`);

        const importResult = await this.createImportCaseForOrder({
          order_id: order.id,
          tenant_id,
          actor_user_id
        });

        console.log(`✓ Import case ${importResult.import_id} auto-created for EU order ${order.id}`);
      } catch (importError: any) {
        console.warn(`⚠️  Could not auto-create import case for EU order ${order.id}:`, importError.message);
        // Common reasons: No approved DDL, DDL not found, etc.
        // Order is still valid - IOR can create import case manually later via UI
      }
    }

    return { order_id: order.id };
  }

  /**
   * List orders for IOR (Importer-of-Record)
   */
  async listOrdersForIOR(input: ListOrdersForIORInput): Promise<Order[]> {
    const { importer_id, tenant_id, status, limit = 50, offset = 0 } = input;

    let query = supabase
      .from('orders')
      .select(`
        id,
        tenant_id,
        restaurant_id,
        offer_id,
        request_id,
        seller_supplier_id,
        importer_of_record_id,
        delivery_location_id,
        import_case_id,
        status,
        total_lines,
        total_quantity,
        currency,
        created_by,
        created_at,
        updated_at
      `)
      .eq('tenant_id', tenant_id)
      .eq('importer_of_record_id', importer_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list orders for IOR: ${error.message}`);
    }

    return (data || []) as Order[];
  }

  /**
   * Get order with details (lines + events)
   */
  async getOrder(order_id: string, tenant_id: string): Promise<{
    order: Order;
    lines: OrderLine[];
    events: OrderEvent[];
  } | null> {
    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch order: ${orderError.message}`);
    }

    // Fetch lines
    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select('*')
      .eq('order_id', order_id)
      .order('line_number', { ascending: true });

    if (linesError) {
      throw new Error(`Failed to fetch order lines: ${linesError.message}`);
    }

    // Fetch events
    const { data: events, error: eventsError } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false });

    if (eventsError) {
      throw new Error(`Failed to fetch order events: ${eventsError.message}`);
    }

    return {
      order: order as Order,
      lines: (lines || []) as OrderLine[],
      events: (events || []) as OrderEvent[]
    };
  }

  /**
   * Set order status with validation and audit trail
   */
  async setOrderStatus(input: SetOrderStatusInput): Promise<{
    order_id: string;
    from_status: string;
    to_status: string;
  }> {
    const { order_id, tenant_id, to_status, actor_user_id, actor_name, note, metadata } = input;

    // 1. Fetch current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchError) {
      throw new Error(`Order not found: ${fetchError.message}`);
    }

    const fromStatus = order.status;

    // 2. Validate status transition
    const validTransitions: Record<string, string[]> = {
      'CONFIRMED': ['IN_FULFILLMENT', 'CANCELLED'],
      'IN_FULFILLMENT': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'CANCELLED'],
      'DELIVERED': [],
      'CANCELLED': []
    };

    if (!validTransitions[fromStatus]?.includes(to_status)) {
      throw new Error(
        `Invalid status transition: Cannot change from ${fromStatus} to ${to_status}`
      );
    }

    // 3. Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: to_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw new Error(`Failed to update order status: ${updateError.message}`);
    }

    // 4. Create status event (audit trail)
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        tenant_id,
        order_id,
        event_type: 'STATUS_CHANGED',
        from_status: fromStatus,
        to_status,
        note: note || null,
        metadata: metadata || null,
        actor_user_id: actor_user_id || null,
        actor_name: actor_name || null
      });

    if (eventError) {
      console.error('Failed to create status event:', eventError);
      // Don't fail the request, just log
    }

    return {
      order_id,
      from_status: fromStatus,
      to_status
    };
  }

  /**
   * Link order to existing import case
   */
  async linkImportCase(input: LinkImportCaseInput): Promise<void> {
    const { order_id, import_id, tenant_id } = input;

    // 1. Verify order exists and belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, importer_of_record_id')
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderError) {
      throw new Error(`Order not found: ${orderError.message}`);
    }

    // 2. Verify import case exists and belongs to same tenant
    const { data: importCase, error: importError } = await supabase
      .from('imports')
      .select('id, tenant_id, importer_id')
      .eq('id', import_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (importError) {
      throw new Error(`Import case not found: ${importError.message}`);
    }

    // 3. Verify IOR match (order's IOR must match import case's importer)
    if (order.importer_of_record_id !== importCase.importer_id) {
      throw new Error(
        `IOR mismatch: Order IOR (${order.importer_of_record_id}) does not match import case importer (${importCase.importer_id})`
      );
    }

    // 4. Update order.import_id
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        import_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw new Error(`Failed to link import case: ${updateError.message}`);
    }

    // 5. Create order event
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        tenant_id,
        order_id,
        event_type: 'IMPORT_CASE_LINKED',
        from_status: null,
        to_status: null,
        note: `Import case ${import_id} linked to order`,
        metadata: { import_id },
        actor_user_id: null,
        actor_name: 'System'
      });

    if (eventError) {
      console.error('Failed to create link event:', eventError);
    }
  }

  /**
   * Create import case for order (on-demand or auto)
   * Requires restaurant to have an approved DDL
   */
  async createImportCaseForOrder(input: CreateImportCaseForOrderInput): Promise<{ import_id: string }> {
    const { order_id, tenant_id, actor_user_id } = input;

    // 1. Fetch order with restaurant and IOR info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        restaurant_id,
        seller_supplier_id,
        importer_of_record_id,
        import_id
      `)
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    // 2. Check if order already has import case
    if (order.import_id) {
      throw new Error('Order already linked to import case');
    }

    // 3. Find restaurant's default approved DDL
    const { data: ddl, error: ddlError } = await supabase
      .from('direct_delivery_locations')
      .select('id')
      .eq('restaurant_id', order.restaurant_id)
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (ddlError || !ddl) {
      throw new Error(
        'No approved DDL found for restaurant. ' +
        'Restaurant must have an approved Direct Delivery Location before creating import case.'
      );
    }

    // 4. Create import case
    const importCase = await importService.createImportCase({
      tenant_id,
      restaurant_id: order.restaurant_id,
      importer_id: order.importer_of_record_id,
      delivery_location_id: ddl.id,
      supplier_id: order.seller_supplier_id,
      created_by: actor_user_id || null
    });

    // 5. Link order to import case
    await this.linkImportCase({
      order_id,
      import_id: importCase.id,
      tenant_id
    });

    // 6. Create order event
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        tenant_id,
        order_id,
        event_type: 'IMPORT_CASE_CREATED',
        from_status: null,
        to_status: null,
        note: `Import case ${importCase.id} created for order`,
        metadata: {
          import_id: importCase.id,
          delivery_location_id: ddl.id
        },
        actor_user_id: actor_user_id || null,
        actor_name: actor_user_id ? null : 'System'
      });

    if (eventError) {
      console.error('Failed to create import case event:', eventError);
    }

    return { import_id: importCase.id };
  }

  /**
   * Confirm order by supplier (for Swedish importers)
   * Changes status from PENDING_SUPPLIER_CONFIRMATION to CONFIRMED
   */
  async confirmOrderBySupplier(input: {
    order_id: string;
    tenant_id: string;
    supplier_id: string;
    actor_user_id?: string;
    note?: string;
  }): Promise<{ order_id: string; status: string }> {
    const { order_id, tenant_id, supplier_id, actor_user_id, note } = input;

    // 1. Fetch order and verify supplier ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, seller_supplier_id')
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    // 2. Verify this supplier owns the order
    if (order.seller_supplier_id !== supplier_id) {
      throw new Error('Access denied: You are not the supplier for this order');
    }

    // 3. Verify order is in correct status
    if (order.status !== 'PENDING_SUPPLIER_CONFIRMATION') {
      throw new Error(
        `Cannot confirm order: Order is in status ${order.status}, expected PENDING_SUPPLIER_CONFIRMATION`
      );
    }

    // 4. Update order status to CONFIRMED
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'CONFIRMED',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw new Error(`Failed to confirm order: ${updateError.message}`);
    }

    // 5. Create order event (audit trail)
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        tenant_id,
        order_id,
        event_type: 'SUPPLIER_CONFIRMED',
        from_status: 'PENDING_SUPPLIER_CONFIRMATION',
        to_status: 'CONFIRMED',
        note: note || 'Order confirmed by supplier',
        metadata: { supplier_id },
        actor_user_id: actor_user_id || null,
        actor_name: null
      });

    if (eventError) {
      console.error('Failed to create confirmation event:', eventError);
    }

    return { order_id, status: 'CONFIRMED' };
  }

  /**
   * Decline order by supplier (for Swedish importers)
   * Changes status from PENDING_SUPPLIER_CONFIRMATION to CANCELLED
   */
  async declineOrderBySupplier(input: {
    order_id: string;
    tenant_id: string;
    supplier_id: string;
    actor_user_id?: string;
    reason: string;
  }): Promise<{ order_id: string; status: string }> {
    const { order_id, tenant_id, supplier_id, actor_user_id, reason } = input;

    // 1. Fetch order and verify supplier ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, seller_supplier_id')
      .eq('id', order_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    // 2. Verify this supplier owns the order
    if (order.seller_supplier_id !== supplier_id) {
      throw new Error('Access denied: You are not the supplier for this order');
    }

    // 3. Verify order is in correct status
    if (order.status !== 'PENDING_SUPPLIER_CONFIRMATION') {
      throw new Error(
        `Cannot decline order: Order is in status ${order.status}, expected PENDING_SUPPLIER_CONFIRMATION`
      );
    }

    // 4. Update order status to CANCELLED
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw new Error(`Failed to decline order: ${updateError.message}`);
    }

    // 5. Create order event (audit trail)
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        tenant_id,
        order_id,
        event_type: 'SUPPLIER_DECLINED',
        from_status: 'PENDING_SUPPLIER_CONFIRMATION',
        to_status: 'CANCELLED',
        note: `Order declined by supplier: ${reason}`,
        metadata: { supplier_id, decline_reason: reason },
        actor_user_id: actor_user_id || null,
        actor_name: null
      });

    if (eventError) {
      console.error('Failed to create decline event:', eventError);
    }

    return { order_id, status: 'CANCELLED' };
  }
}

export const orderService = new OrderService();
