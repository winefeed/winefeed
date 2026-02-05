/**
 * IOR PORTFOLIO SERVICE
 *
 * Business logic for the Portfolio Operator feature:
 * - Producer management
 * - Product catalog operations
 * - Price list management
 * - Trade terms
 * - Case-based communication
 *
 * Security:
 * - All operations require importer_id for tenant isolation
 * - Audit logging for key actions
 */

import { getSupabaseAdmin } from './supabase-server';
import {
  getIOREmailProvider,
  generateThreadToken,
  type IOREmailMessage,
} from './ior-email-provider';
import {
  getTemplate,
  renderTemplate,
  calculateDueDate,
  type MessageTemplate,
} from './ior-message-templates';

// ============================================================================
// CONTEXT
// ============================================================================

/**
 * Context for all IOR operations
 * All service methods require this for multi-tenant isolation
 */
export interface IORContext {
  tenantId: string;
  importerId: string;
  userId: string;
  userName?: string;
}

// ============================================================================
// TYPES
// ============================================================================

export interface IORProducer {
  id: string;
  tenant_id: string;
  importer_id: string;
  name: string;
  legal_name?: string;
  country: string;
  region?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
  website_url?: string;
  is_active: boolean;
  onboarded_at?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Computed fields (from joins)
  product_count?: number;
  open_cases_count?: number;
}

export interface IORProduct {
  id: string;
  tenant_id: string;
  importer_id: string;
  producer_id: string;
  name: string;
  vintage?: number;
  sku?: string;
  grape_varieties?: string[];
  wine_type?: string;
  appellation?: string;
  alcohol_pct?: number;
  bottle_size_ml: number;
  case_size: number;
  is_active: boolean;
  tasting_notes?: string;
  awards?: unknown[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IORPriceList {
  id: string;
  tenant_id: string;
  importer_id: string;
  producer_id: string;
  name: string;
  market: string;
  currency: string;
  status: 'DRAFT' | 'ACTIVE' | 'NEXT' | 'ARCHIVED';
  valid_from?: string;
  valid_to?: string;
  created_by?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // Computed
  item_count?: number;
}

export interface IORPriceListItem {
  id: string;
  price_list_id: string;
  product_id: string;
  price_per_bottle_ore: number;
  price_per_case_ore?: number;
  min_order_qty: number;
  created_at: string;
  updated_at: string;
  // Joined
  product?: IORProduct;
}

export interface IORTradeTerms {
  id: string;
  tenant_id: string;
  importer_id: string;
  producer_id: string;
  market: string;
  payment_terms_days: number;
  incoterms?: string;
  moq_cases?: number;
  lead_time_days?: number;
  volume_discounts?: Array<{ qty_cases: number; discount_pct: number }>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface IORCommunicationCase {
  id: string;
  tenant_id: string;
  importer_id: string;
  producer_id: string;
  subject: string;
  category?: string;
  status: 'OPEN' | 'WAITING_PRODUCER' | 'WAITING_INTERNAL' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  due_at?: string;
  created_by?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  // Computed
  is_overdue?: boolean;
  producer?: IORProducer;
  message_count?: number;
  last_message_at?: string;
}

export interface IORCaseMessage {
  id: string;
  case_id: string;
  content: string;
  content_html?: string;
  direction: 'OUTBOUND' | 'INBOUND';
  sender_type: 'IOR_USER' | 'PRODUCER' | 'SYSTEM';
  sender_name?: string;
  sender_email?: string;
  template_id?: string;
  email_message_id?: string;
  attachments?: Array<{ name: string; url: string; size: number; type: string }>;
  created_at: string;
}

export interface DashboardStats {
  total_producers: number;
  active_producers: number;
  total_products: number;
  active_products: number;
  open_cases: number;
  overdue_cases: number;
  high_priority_cases: number;
  cases_waiting_internal: number;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Dashboard data for Netflix-style UI
 */
export interface IORDashboard {
  stats: DashboardStats;
  actionRequiredCases: IORCommunicationCase[];
  producers: Array<IORProducer & { product_count: number; open_cases_count: number; overdue_cases_count: number }>;
  catalogSummary: {
    total_products: number;
    active_products: number;
    inactive_products: number;
  };
  pricingSummary: {
    active_price_lists: number;
    expiring_soon: number;  // valid_to < now + 30 days
  };
}

export interface CreateCaseInput {
  producer_id: string;
  subject: string;
  category?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  due_at?: string;
}

export interface SendMessageInput {
  content: string;
  template_id?: string;
  template_variables?: Record<string, string>;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class IORPortfolioService {
  private supabase = getSupabaseAdmin();

  // ==========================================================================
  // PRODUCERS
  // ==========================================================================

  /**
   * List all producers for an importer
   */
  async listProducers(
    ctx: IORContext,
    options?: {
      page?: number;
      pageSize?: number;
      search?: string;
      country?: string;
      includeInactive?: boolean;
    }
  ): Promise<PaginatedResponse<IORProducer & { productCount?: number; openCasesCount?: number; overdueCasesCount?: number }>> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from('ior_producers')
      .select('*', { count: 'exact' })
      .eq('importer_id', ctx.importerId)
      .order('name')
      .range(offset, offset + pageSize - 1);

    if (!options?.includeInactive) {
      query = query.eq('is_active', true);
    }

    if (options?.country) {
      query = query.eq('country', options.country);
    }

    if (options?.search) {
      query = query.ilike('name', `%${options.search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[IOR Portfolio] Error listing producers:', error);
      throw new Error('Failed to list producers');
    }

    // Enrich with stats
    const producers = await this.enrichProducersWithStats(data as IORProducer[], ctx.importerId);

    return {
      items: producers,
      page,
      pageSize,
      total: count || 0,
    };
  }

  /**
   * Get a single producer by ID
   */
  async getProducer(
    ctx: IORContext,
    producerId: string
  ): Promise<IORProducer | null> {
    const { data, error } = await this.supabase
      .from('ior_producers')
      .select('*')
      .eq('id', producerId)
      .eq('importer_id', ctx.importerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[IOR Portfolio] Error getting producer:', error);
      throw new Error('Failed to get producer');
    }

    return data as IORProducer;
  }

  /**
   * Create a new producer
   */
  async createProducer(
    ctx: IORContext,
    data: Partial<IORProducer>
  ): Promise<IORProducer> {
    const { data: producer, error } = await this.supabase
      .from('ior_producers')
      .insert({
        ...data,
        importer_id: ctx.importerId,
        tenant_id: ctx.tenantId,
      })
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error creating producer:', error);
      throw new Error(`Failed to create producer: ${error.message}`);
    }

    // Audit log
    await this.logAudit(ctx.tenantId, ctx.importerId, 'PRODUCER_CREATED', 'producer', producer.id, ctx.userId);

    return producer as IORProducer;
  }

  /**
   * Update a producer
   */
  async updateProducer(
    ctx: IORContext,
    producerId: string,
    data: Partial<IORProducer>
  ): Promise<IORProducer> {
    // Remove fields that shouldn't be updated
    const { id, tenant_id, importer_id, created_at, ...updateData } = data;

    const { data: producer, error } = await this.supabase
      .from('ior_producers')
      .update(updateData)
      .eq('id', producerId)
      .eq('importer_id', ctx.importerId)
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error updating producer:', error);
      throw new Error(`Failed to update producer: ${error.message}`);
    }

    // Audit log
    await this.logAudit(ctx.tenantId, ctx.importerId, 'PRODUCER_UPDATED', 'producer', producerId, ctx.userId, updateData);

    return producer as IORProducer;
  }

  // ==========================================================================
  // PRODUCTS
  // ==========================================================================

  /**
   * List products with server-side pagination, filtering, and sorting
   */
  async listProducts(
    ctx: IORContext,
    producerId: string,
    options?: {
      page?: number;
      pageSize?: number;
      activeOnly?: boolean;
      search?: string;
      sortBy?: 'name' | 'vintage' | 'created_at';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<PaginatedResponse<IORProduct>> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const offset = (page - 1) * pageSize;
    const sortBy = options?.sortBy || 'name';
    const sortOrder = options?.sortOrder || 'asc';

    let query = this.supabase
      .from('ior_products')
      .select('*', { count: 'exact' })
      .eq('producer_id', producerId)
      .eq('importer_id', ctx.importerId)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + pageSize - 1);

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    if (options?.search) {
      query = query.ilike('name', `%${options.search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[IOR Portfolio] Error listing products:', error);
      throw new Error('Failed to list products');
    }

    return {
      items: data as IORProduct[],
      page,
      pageSize,
      total: count || 0,
    };
  }

  /**
   * Create a product
   */
  async createProduct(
    ctx: IORContext,
    data: Partial<IORProduct>
  ): Promise<IORProduct> {
    const { data: product, error } = await this.supabase
      .from('ior_products')
      .insert({
        ...data,
        importer_id: ctx.importerId,
        tenant_id: ctx.tenantId,
      })
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error creating product:', error);
      throw new Error(`Failed to create product: ${error.message}`);
    }

    return product as IORProduct;
  }

  /**
   * Bulk update products (e.g., activate/deactivate)
   * Logs a single audit event for the batch operation
   */
  async bulkUpdateProducts(
    ctx: IORContext,
    productIds: string[],
    patch: { is_active?: boolean }
  ): Promise<{ updated: number }> {
    const { data: updated, error } = await this.supabase
      .from('ior_products')
      .update(patch)
      .in('id', productIds)
      .eq('importer_id', ctx.importerId)
      .select('id');

    if (error) {
      console.error('[IOR Portfolio] Error bulk updating products:', error);
      throw new Error('Failed to bulk update products');
    }

    const count = updated?.length || 0;

    // Audit log (single event for batch)
    if (count > 0) {
      await this.logAudit(ctx.tenantId, ctx.importerId, 'PRODUCTS_BULK_UPDATED', 'product', productIds[0], ctx.userId, {
        product_ids: productIds,
        patch,
        updated_count: count,
      });
    }

    return { updated: count };
  }

  // ==========================================================================
  // PRICE LISTS
  // ==========================================================================

  /**
   * List price lists for a producer
   */
  async listPriceLists(
    ctx: IORContext,
    producerId: string
  ): Promise<IORPriceList[]> {
    const { data, error } = await this.supabase
      .from('ior_price_lists')
      .select('*')
      .eq('producer_id', producerId)
      .eq('importer_id', ctx.importerId)
      .order('market')
      .order('valid_from', { ascending: false });

    if (error) {
      console.error('[IOR Portfolio] Error listing price lists:', error);
      throw new Error('Failed to list price lists');
    }

    return data as IORPriceList[];
  }

  /**
   * Get price list with items
   */
  async getPriceList(
    ctx: IORContext,
    priceListId: string
  ): Promise<{ priceList: IORPriceList; items: IORPriceListItem[] } | null> {
    const { data: priceList, error: plError } = await this.supabase
      .from('ior_price_lists')
      .select('*')
      .eq('id', priceListId)
      .eq('importer_id', ctx.importerId)
      .single();

    if (plError) {
      if (plError.code === 'PGRST116') return null;
      throw new Error('Failed to get price list');
    }

    const { data: items, error: itemsError } = await this.supabase
      .from('ior_price_list_items')
      .select('*, product:ior_products(*)')
      .eq('price_list_id', priceListId);

    if (itemsError) {
      throw new Error('Failed to get price list items');
    }

    return {
      priceList: priceList as IORPriceList,
      items: items as IORPriceListItem[],
    };
  }

  /**
   * Create a price list
   */
  async createPriceList(
    ctx: IORContext,
    data: Partial<IORPriceList>
  ): Promise<IORPriceList> {
    const { data: priceList, error } = await this.supabase
      .from('ior_price_lists')
      .insert({
        ...data,
        importer_id: ctx.importerId,
        tenant_id: ctx.tenantId,
        status: 'DRAFT',
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error creating price list:', error);
      throw new Error(`Failed to create price list: ${error.message}`);
    }

    return priceList as IORPriceList;
  }

  // ==========================================================================
  // TRADE TERMS
  // ==========================================================================

  /**
   * Get trade terms for a producer by market
   */
  async getTradeTerms(
    ctx: IORContext,
    producerId: string,
    market?: string
  ): Promise<IORTradeTerms[]> {
    let query = this.supabase
      .from('ior_trade_terms')
      .select('*')
      .eq('producer_id', producerId)
      .eq('importer_id', ctx.importerId);

    if (market) {
      query = query.eq('market', market);
    }

    const { data, error } = await query.order('market');

    if (error) {
      console.error('[IOR Portfolio] Error getting trade terms:', error);
      throw new Error('Failed to get trade terms');
    }

    return data as IORTradeTerms[];
  }

  /**
   * Upsert trade terms
   */
  async upsertTradeTerms(
    ctx: IORContext,
    data: Partial<IORTradeTerms>
  ): Promise<IORTradeTerms> {
    const { data: terms, error } = await this.supabase
      .from('ior_trade_terms')
      .upsert({
        ...data,
        importer_id: ctx.importerId,
        tenant_id: ctx.tenantId,
      }, {
        onConflict: 'importer_id,producer_id,market',
      })
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error upserting trade terms:', error);
      throw new Error(`Failed to upsert trade terms: ${error.message}`);
    }

    return terms as IORTradeTerms;
  }

  // ==========================================================================
  // COMMUNICATION CASES
  // ==========================================================================

  /**
   * List cases with filters and pagination
   */
  async listCases(
    ctx: IORContext,
    filters?: {
      producer_id?: string;
      status?: string;
      priority?: string;
      overdue_only?: boolean;
      action_required?: boolean;
    },
    pagination?: { page?: number; pageSize?: number }
  ): Promise<PaginatedResponse<IORCommunicationCase>> {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from('ior_communication_cases')
      .select('*, producer:ior_producers(id, name, country)', { count: 'exact' })
      .eq('importer_id', ctx.importerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filters?.producer_id) {
      query = query.eq('producer_id', filters.producer_id);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[IOR Portfolio] Error listing cases:', error);
      throw new Error('Failed to list cases');
    }

    // Compute overdue status
    const now = new Date();
    let cases = (data || []).map(c => ({
      ...c,
      is_overdue: !!(c.due_at && new Date(c.due_at) < now && !['RESOLVED', 'CLOSED'].includes(c.status)),
    })) as IORCommunicationCase[];

    // Filter overdue only if requested (client-side for now)
    if (filters?.overdue_only) {
      cases = cases.filter(c => c.is_overdue);
    }

    // Filter action required: overdue OR high/urgent priority OR waiting_internal
    if (filters?.action_required) {
      cases = cases.filter(c =>
        c.is_overdue ||
        ['HIGH', 'URGENT'].includes(c.priority) ||
        c.status === 'WAITING_INTERNAL'
      );

      // Sort action required cases:
      // 1. WAITING_INTERNAL first
      // 2. OVERDUE (oldest first)
      // 3. HIGH/URGENT (nearest due_at first)
      cases.sort((a, b) => {
        // WAITING_INTERNAL always first
        if (a.status === 'WAITING_INTERNAL' && b.status !== 'WAITING_INTERNAL') return -1;
        if (b.status === 'WAITING_INTERNAL' && a.status !== 'WAITING_INTERNAL') return 1;

        // Then overdue (oldest due_at first)
        if (a.is_overdue && !b.is_overdue) return -1;
        if (b.is_overdue && !a.is_overdue) return 1;
        if (a.is_overdue && b.is_overdue) {
          // Both overdue: oldest due_at first
          const aDue = a.due_at ? new Date(a.due_at).getTime() : 0;
          const bDue = b.due_at ? new Date(b.due_at).getTime() : 0;
          return aDue - bDue;
        }

        // Then HIGH/URGENT by nearest due_at
        const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
        const aPrio = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
        const bPrio = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
        if (aPrio !== bPrio) return aPrio - bPrio;

        // Same priority: nearest due_at first
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Infinity;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Infinity;
        return aDue - bDue;
      });
    }

    return {
      items: cases,
      page,
      pageSize,
      total: filters?.overdue_only || filters?.action_required ? cases.length : (count || 0),
    };
  }

  /**
   * Get case with messages and thread token
   */
  async getCase(
    ctx: IORContext,
    caseId: string
  ): Promise<{ case: IORCommunicationCase; messages: IORCaseMessage[]; threadToken?: string } | null> {
    const { data: caseData, error: caseError } = await this.supabase
      .from('ior_communication_cases')
      .select('*, producer:ior_producers(id, name, country, contact_email)')
      .eq('id', caseId)
      .eq('importer_id', ctx.importerId)
      .single();

    if (caseError) {
      if (caseError.code === 'PGRST116') return null;
      throw new Error('Failed to get case');
    }

    const [messagesResult, threadResult] = await Promise.all([
      this.supabase
        .from('ior_case_messages')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true }),
      this.supabase
        .from('ior_email_threads')
        .select('thread_token')
        .eq('case_id', caseId)
        .single(),
    ]);

    if (messagesResult.error) {
      throw new Error('Failed to get case messages');
    }

    // Compute overdue
    const now = new Date();
    const isOverdue = caseData.due_at && new Date(caseData.due_at) < now && !['RESOLVED', 'CLOSED'].includes(caseData.status);

    return {
      case: { ...caseData, is_overdue: isOverdue } as IORCommunicationCase,
      messages: messagesResult.data as IORCaseMessage[],
      threadToken: threadResult.data?.thread_token,
    };
  }

  /**
   * Create a new case
   */
  async createCase(
    ctx: IORContext,
    input: CreateCaseInput
  ): Promise<IORCommunicationCase> {
    const { data: caseData, error } = await this.supabase
      .from('ior_communication_cases')
      .insert({
        producer_id: input.producer_id,
        subject: input.subject,
        category: input.category || 'general',
        priority: input.priority || 'NORMAL',
        due_at: input.due_at,
        status: 'OPEN',
        importer_id: ctx.importerId,
        tenant_id: ctx.tenantId,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error creating case:', error);
      throw new Error(`Failed to create case: ${error.message}`);
    }

    // Audit log
    await this.logAudit(ctx.tenantId, ctx.importerId, 'CASE_CREATED', 'case', caseData.id, ctx.userId);

    return caseData as IORCommunicationCase;
  }

  /**
   * Ensure email thread exists for a case, create if needed
   * Returns the thread token for reply routing
   */
  async ensureEmailThread(ctx: IORContext, caseId: string): Promise<string> {
    // Get case to verify ownership and get producer email
    const caseResult = await this.getCase(ctx, caseId);
    if (!caseResult) {
      throw new Error('Case not found');
    }

    const producer = caseResult.case.producer as IORProducer | undefined;
    const producerEmail = producer?.contact_email || '';

    return this.getOrCreateEmailThread(caseId, producerEmail);
  }

  /**
   * Update case status
   */
  async updateCaseStatus(
    ctx: IORContext,
    caseId: string,
    status: IORCommunicationCase['status']
  ): Promise<IORCommunicationCase> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'RESOLVED') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = ctx.userId;
    }

    const { data: caseData, error } = await this.supabase
      .from('ior_communication_cases')
      .update(updateData)
      .eq('id', caseId)
      .eq('importer_id', ctx.importerId)
      .select()
      .single();

    if (error) {
      console.error('[IOR Portfolio] Error updating case status:', error);
      throw new Error('Failed to update case status');
    }

    // Audit log
    await this.logAudit(ctx.tenantId, ctx.importerId, 'CASE_STATUS_UPDATED', 'case', caseId, ctx.userId, { status });

    return caseData as IORCommunicationCase;
  }

  /**
   * Send a message in a case (with optional template)
   * Alias: addMessage
   */
  async sendCaseMessage(
    ctx: IORContext,
    caseId: string,
    input: SendMessageInput
  ): Promise<{ message: IORCaseMessage; emailSent: boolean }> {
    // Get case and producer info
    const caseResult = await this.getCase(ctx, caseId);
    if (!caseResult) {
      throw new Error('Case not found');
    }

    const { case: caseData } = caseResult;
    const producer = caseData.producer as IORProducer | undefined;

    // Prepare content (render template if provided)
    let content = input.content;
    let templateId: string | undefined;
    let dueAt: Date | null = null;

    if (input.template_id && input.template_variables) {
      const template = getTemplate(input.template_id);
      if (template) {
        const rendered = renderTemplate(template, input.template_variables);
        content = rendered.body;
        templateId = input.template_id;
        dueAt = calculateDueDate(template);
      }
    }

    // Get or create email thread
    let threadToken = await this.getOrCreateEmailThread(caseId, producer?.contact_email || '');

    // Create message record
    const { data: message, error: msgError } = await this.supabase
      .from('ior_case_messages')
      .insert({
        case_id: caseId,
        content,
        direction: 'OUTBOUND',
        sender_type: 'IOR_USER',
        sender_name: ctx.userName,
        template_id: templateId,
        attachments: [],
      })
      .select()
      .single();

    if (msgError) {
      console.error('[IOR Portfolio] Error creating message:', msgError);
      throw new Error('Failed to create message');
    }

    // Update case status to WAITING_PRODUCER
    const updateData: Record<string, unknown> = {
      status: 'WAITING_PRODUCER',
    };
    if (dueAt) {
      updateData.due_at = dueAt.toISOString();
    }

    await this.supabase
      .from('ior_communication_cases')
      .update(updateData)
      .eq('id', caseId)
      .eq('importer_id', ctx.importerId);

    // Send email
    let emailSent = false;
    if (producer?.contact_email) {
      const emailProvider = getIOREmailProvider();
      const emailMessage: IOREmailMessage = {
        to: producer.contact_email,
        subject: caseData.subject,
        body: content,
        threadToken,
        caseId,
        producerName: producer.name,
      };

      const result = await emailProvider.send(emailMessage);
      emailSent = result.success;

      if (result.messageId) {
        // Update message with email ID
        await this.supabase
          .from('ior_case_messages')
          .update({ email_message_id: result.messageId })
          .eq('id', message.id);
      }
    }

    // Audit log
    await this.logAudit(ctx.tenantId, ctx.importerId, 'MESSAGE_SENT', 'case', caseId, ctx.userId, {
      template_id: templateId,
      email_sent: emailSent,
    });

    return {
      message: message as IORCaseMessage,
      emailSent,
    };
  }

  /**
   * Alias for sendCaseMessage
   */
  async addMessage(
    ctx: IORContext,
    caseId: string,
    input: SendMessageInput
  ): Promise<{ message: IORCaseMessage; emailSent: boolean }> {
    return this.sendCaseMessage(ctx, caseId, input);
  }

  /**
   * Ingest inbound email reply (webhook handler)
   * Called by /api/email/inbound with service role context
   *
   * @param payload - Email payload from webhook
   * @returns Case and message IDs if successful, null if thread not found
   */
  async ingestInboundEmail(payload: {
    threadToken: string;
    senderEmail: string;
    senderName?: string;
    subject?: string;
    content: string;
    contentHtml?: string;
    attachments?: Array<{ name: string; url: string; size: number; type: string }>;
  }): Promise<{ case_id: string; message_id: string } | null> {
    const { threadToken, senderEmail, senderName, content, attachments } = payload;

    // Find thread by token
    const { data: thread, error: threadError } = await this.supabase
      .from('ior_email_threads')
      .select('case_id')
      .eq('thread_token', threadToken)
      .single();

    if (threadError || !thread) {
      console.warn('[IOR Portfolio] Thread not found for token:', threadToken);
      return null;
    }

    // Get case to find tenant/importer for audit
    const { data: caseData } = await this.supabase
      .from('ior_communication_cases')
      .select('tenant_id, importer_id')
      .eq('id', thread.case_id)
      .single();

    // Create inbound message
    const { data: message, error: msgError } = await this.supabase
      .from('ior_case_messages')
      .insert({
        case_id: thread.case_id,
        content,
        content_html: payload.contentHtml,
        direction: 'INBOUND',
        sender_type: 'PRODUCER',
        sender_name: senderName || senderEmail.split('@')[0],
        sender_email: senderEmail,
        attachments: attachments || [],
      })
      .select()
      .single();

    if (msgError) {
      console.error('[IOR Portfolio] Error creating inbound message:', msgError);
      throw new Error('Failed to create inbound message');
    }

    // Update case status to WAITING_INTERNAL
    await this.supabase
      .from('ior_communication_cases')
      .update({ status: 'WAITING_INTERNAL' })
      .eq('id', thread.case_id);

    // Update thread last activity
    await this.supabase
      .from('ior_email_threads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('thread_token', threadToken);

    // Audit log (if we have case data)
    if (caseData) {
      await this.logAudit(
        caseData.tenant_id,
        caseData.importer_id,
        'INBOUND_EMAIL_RECEIVED',
        'case',
        thread.case_id,
        undefined,
        { sender_email: senderEmail }
      );
    }

    return {
      case_id: thread.case_id,
      message_id: message.id,
    };
  }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Get complete dashboard data for Netflix-style UI
   * Single call that returns everything the dashboard needs
   */
  async getDashboard(ctx: IORContext): Promise<IORDashboard> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Parallel queries for efficiency
    const [
      producersResult,
      productsResult,
      casesResult,
      priceListsResult,
    ] = await Promise.all([
      // Producers with stats
      this.supabase
        .from('ior_producers')
        .select('*')
        .eq('importer_id', ctx.importerId)
        .eq('is_active', true)
        .order('name'),
      // Products
      this.supabase
        .from('ior_products')
        .select('is_active', { count: 'exact' })
        .eq('importer_id', ctx.importerId),
      // Open cases
      this.supabase
        .from('ior_communication_cases')
        .select('*, producer:ior_producers(id, name, country)')
        .eq('importer_id', ctx.importerId)
        .not('status', 'in', '("RESOLVED","CLOSED")'),
      // Price lists
      this.supabase
        .from('ior_price_lists')
        .select('status, valid_to')
        .eq('importer_id', ctx.importerId),
    ]);

    const producers = (producersResult.data || []) as IORProducer[];
    const products = productsResult.data || [];
    const cases = (casesResult.data || []) as IORCommunicationCase[];
    const priceLists = priceListsResult.data || [];

    // Compute per-producer stats
    const producerIds = producers.map(p => p.id);

    const [productCountsResult, caseCountsResult] = await Promise.all([
      this.supabase
        .from('ior_products')
        .select('producer_id')
        .eq('importer_id', ctx.importerId)
        .in('producer_id', producerIds),
      this.supabase
        .from('ior_communication_cases')
        .select('producer_id, status, due_at')
        .eq('importer_id', ctx.importerId)
        .in('producer_id', producerIds)
        .not('status', 'in', '("RESOLVED","CLOSED")'),
    ]);

    const productCounts = productCountsResult.data || [];
    const caseCounts = caseCountsResult.data || [];

    // Build counts maps
    const productCountMap = new Map<string, number>();
    const openCasesMap = new Map<string, number>();
    const overdueCasesMap = new Map<string, number>();

    for (const p of productCounts) {
      productCountMap.set(p.producer_id, (productCountMap.get(p.producer_id) || 0) + 1);
    }

    for (const c of caseCounts) {
      openCasesMap.set(c.producer_id, (openCasesMap.get(c.producer_id) || 0) + 1);
      if (c.due_at && new Date(c.due_at) < now) {
        overdueCasesMap.set(c.producer_id, (overdueCasesMap.get(c.producer_id) || 0) + 1);
      }
    }

    // Build enriched producers
    const enrichedProducers = producers.map(p => ({
      ...p,
      product_count: productCountMap.get(p.id) || 0,
      open_cases_count: openCasesMap.get(p.id) || 0,
      overdue_cases_count: overdueCasesMap.get(p.id) || 0,
    }));

    // Filter action required cases
    const actionRequiredCases = cases
      .map(c => ({
        ...c,
        is_overdue: !!(c.due_at && new Date(c.due_at) < now),
      }))
      .filter(c =>
        c.priority === 'HIGH' ||
        c.priority === 'URGENT' ||
        c.is_overdue ||
        c.status === 'WAITING_INTERNAL'
      )
      .sort((a, b) => {
        // Sort by: overdue first, then high priority, then due_at
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
        if (a.priority !== 'URGENT' && b.priority === 'URGENT') return 1;
        if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        return 0;
      })
      .slice(0, 10);

    // Compute stats
    const stats: DashboardStats = {
      total_producers: producers.length,
      active_producers: producers.filter(p => p.is_active).length,
      total_products: products.length,
      active_products: products.filter(p => p.is_active).length,
      open_cases: cases.length,
      overdue_cases: cases.filter(c => c.due_at && new Date(c.due_at) < now).length,
      high_priority_cases: cases.filter(c => c.priority === 'HIGH' || c.priority === 'URGENT').length,
      cases_waiting_internal: cases.filter(c => c.status === 'WAITING_INTERNAL').length,
    };

    // Catalog summary
    const catalogSummary = {
      total_products: products.length,
      active_products: products.filter(p => p.is_active).length,
      inactive_products: products.filter(p => !p.is_active).length,
    };

    // Pricing summary
    const activePriceLists = priceLists.filter(pl => pl.status === 'ACTIVE');
    const expiringSoon = activePriceLists.filter(pl =>
      pl.valid_to && new Date(pl.valid_to) < thirtyDaysFromNow
    );

    const pricingSummary = {
      active_price_lists: activePriceLists.length,
      expiring_soon: expiringSoon.length,
    };

    return {
      stats,
      actionRequiredCases,
      producers: enrichedProducers,
      catalogSummary,
      pricingSummary,
    };
  }

  /**
   * Get dashboard statistics (simplified version)
   */
  async getDashboardStats(importerId: string, tenantId: string): Promise<DashboardStats> {
    const now = new Date().toISOString();

    // Parallel queries for efficiency
    const [
      producersResult,
      productsResult,
      casesResult,
    ] = await Promise.all([
      this.supabase
        .from('ior_producers')
        .select('is_active', { count: 'exact' })
        .eq('importer_id', importerId),
      this.supabase
        .from('ior_products')
        .select('is_active', { count: 'exact' })
        .eq('importer_id', importerId),
      this.supabase
        .from('ior_communication_cases')
        .select('status, priority, due_at')
        .eq('importer_id', importerId)
        .not('status', 'in', '("RESOLVED","CLOSED")'),
    ]);

    const producers = producersResult.data || [];
    const products = productsResult.data || [];
    const cases = casesResult.data || [];

    return {
      total_producers: producers.length,
      active_producers: producers.filter(p => p.is_active).length,
      total_products: products.length,
      active_products: products.filter(p => p.is_active).length,
      open_cases: cases.length,
      overdue_cases: cases.filter(c => c.due_at && new Date(c.due_at) < new Date(now)).length,
      high_priority_cases: cases.filter(c => c.priority === 'HIGH' || c.priority === 'URGENT').length,
      cases_waiting_internal: cases.filter(c => c.status === 'WAITING_INTERNAL').length,
    };
  }

  /**
   * Get action items for dashboard
   */
  async getActionItems(importerId: string): Promise<IORCommunicationCase[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('ior_communication_cases')
      .select('*, producer:ior_producers(id, name, country)')
      .eq('importer_id', importerId)
      .not('status', 'in', '("RESOLVED","CLOSED")')
      .or(`priority.in.("HIGH","URGENT"),due_at.lt.${now},status.eq.WAITING_INTERNAL`)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('[IOR Portfolio] Error getting action items:', error);
      throw new Error('Failed to get action items');
    }

    // Compute overdue
    return (data || []).map(c => ({
      ...c,
      is_overdue: !!(c.due_at && new Date(c.due_at) < new Date(now)),
    })) as IORCommunicationCase[];
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Enrich producers with product counts and case counts
   */
  private async enrichProducersWithStats(
    producers: IORProducer[],
    importerId: string
  ): Promise<IORProducer[]> {
    const producerIds = producers.map(p => p.id);

    // Get product counts
    const { data: productCounts } = await this.supabase
      .from('ior_products')
      .select('producer_id')
      .eq('importer_id', importerId)
      .in('producer_id', producerIds);

    // Get open case counts
    const { data: caseCounts } = await this.supabase
      .from('ior_communication_cases')
      .select('producer_id')
      .eq('importer_id', importerId)
      .in('producer_id', producerIds)
      .not('status', 'in', '("RESOLVED","CLOSED")');

    // Build counts map
    const productCountMap = new Map<string, number>();
    const caseCountMap = new Map<string, number>();

    for (const p of productCounts || []) {
      productCountMap.set(p.producer_id, (productCountMap.get(p.producer_id) || 0) + 1);
    }

    for (const c of caseCounts || []) {
      caseCountMap.set(c.producer_id, (caseCountMap.get(c.producer_id) || 0) + 1);
    }

    return producers.map(p => ({
      ...p,
      product_count: productCountMap.get(p.id) || 0,
      open_cases_count: caseCountMap.get(p.id) || 0,
    }));
  }

  /**
   * Get or create email thread for case
   */
  private async getOrCreateEmailThread(caseId: string, producerEmail: string): Promise<string> {
    // Check existing
    const { data: existing } = await this.supabase
      .from('ior_email_threads')
      .select('thread_token')
      .eq('case_id', caseId)
      .single();

    if (existing) {
      return existing.thread_token;
    }

    // Create new
    const token = generateThreadToken();
    await this.supabase
      .from('ior_email_threads')
      .insert({
        case_id: caseId,
        thread_token: token,
        producer_email: producerEmail,
      });

    return token;
  }

  /**
   * Log audit event
   */
  private async logAudit(
    tenantId: string,
    importerId: string,
    eventType: string,
    entityType: string,
    entityId: string,
    actorUserId?: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('ior_audit_log').insert({
        tenant_id: tenantId,
        importer_id: importerId,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        actor_user_id: actorUserId,
        payload: payload || {},
      });
    } catch (error) {
      // Don't throw on audit failure
      console.error('[IOR Portfolio] Audit log error:', error);
    }
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const iorPortfolioService = new IORPortfolioService();
