/**
 * PRODUCER READINESS PACK SERVICE
 *
 * Core business logic for readiness packs.
 * Feature flag: FEATURE_PRODUCER_READINESS_PACKS
 *
 * POLICY ENFORCEMENT:
 * - Validates access_request is in ACCEPTED state before creating pack
 * - Logs all operations to audit trail
 * - Only IOR/admin can create packs
 */

import { createClient } from '@supabase/supabase-js';
import {
  ReadinessPack,
  ReadinessPackEvent,
  ReadinessPackWithRequest,
  CreateReadinessPackInput,
  UpdateReadinessPackInput,
  ReadinessPackEventTypes,
  isReadinessPacksEnabled,
  isRequestAcceptedForPack,
  createReadinessPackSchema,
  updateReadinessPackSchema,
} from './readiness-pack-types';

// ============================================
// SUPABASE CLIENT
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================
// CONTEXT TYPE
// ============================================

export interface ReadinessPackContext {
  userId: string;
  userName?: string;
}

// ============================================
// SERVICE CLASS
// ============================================

class ReadinessPackService {
  /**
   * Create a new readiness pack.
   *
   * POLICY: Only allowed when access_request is in ACCEPTED state.
   * This is enforced at multiple levels:
   * 1. Server-side validation (here)
   * 2. DB trigger (backup)
   */
  async createPack(
    ctx: ReadinessPackContext,
    input: CreateReadinessPackInput
  ): Promise<ReadinessPack> {
    // Feature flag check
    if (!isReadinessPacksEnabled()) {
      throw new Error('Readiness packs feature is not enabled');
    }

    // Validate input
    const validated = createReadinessPackSchema.parse(input);

    // CRITICAL: Verify access request is in ACCEPTED state
    const { data: request, error: requestError } = await supabase
      .from('access_requests')
      .select('id, status')
      .eq('id', validated.access_request_id)
      .single();

    if (requestError || !request) {
      throw new Error(`Access request not found: ${validated.access_request_id}`);
    }

    if (!isRequestAcceptedForPack(request.status)) {
      throw new Error(
        `Readiness packs can only be created for ACCEPTED requests. ` +
        `Current status: ${request.status}. ` +
        `This is a policy constraint to ensure packs are only offered post-acceptance.`
      );
    }

    // Check for existing pack (prevent duplicates)
    const { data: existing } = await supabase
      .from('readiness_packs')
      .select('id')
      .eq('access_request_id', validated.access_request_id)
      .not('status', 'eq', 'CANCELLED')
      .single();

    if (existing) {
      throw new Error(
        `A readiness pack already exists for this request. ` +
        `Only one active pack per request is allowed.`
      );
    }

    // Create the pack
    const { data: pack, error: createError } = await supabase
      .from('readiness_packs')
      .insert({
        access_request_id: validated.access_request_id,
        created_by: ctx.userId,
        payer: validated.payer,
        currency: validated.currency,
        price_cents: validated.price_cents ?? null,
        scope: validated.scope,
        status: 'DRAFT',
        notes: validated.notes ?? null,
      })
      .select()
      .single();

    if (createError || !pack) {
      console.error('Failed to create readiness pack:', createError);
      throw new Error('Failed to create readiness pack');
    }

    // Log the creation event
    await this.logEvent(pack.id, ctx, ReadinessPackEventTypes.CREATED, {
      scope: validated.scope,
      payer: validated.payer,
      access_request_status: request.status,
    });

    return pack as ReadinessPack;
  }

  /**
   * Get a pack by ID with related request info.
   */
  async getPack(packId: string): Promise<ReadinessPackWithRequest | null> {
    if (!isReadinessPacksEnabled()) {
      return null;
    }

    const { data, error } = await supabase
      .from('readiness_packs')
      .select(`
        *,
        access_requests (
          id,
          status,
          wine_name,
          producer_name,
          importer_name
        )
      `)
      .eq('id', packId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      access_request: data.access_requests,
    } as ReadinessPackWithRequest;
  }

  /**
   * Get pack for a specific access request.
   */
  async getPackByRequestId(accessRequestId: string): Promise<ReadinessPack | null> {
    if (!isReadinessPacksEnabled()) {
      return null;
    }

    const { data, error } = await supabase
      .from('readiness_packs')
      .select('*')
      .eq('access_request_id', accessRequestId)
      .not('status', 'eq', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ReadinessPack;
  }

  /**
   * List all packs with optional filters.
   */
  async listPacks(options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ packs: ReadinessPackWithRequest[]; total: number }> {
    if (!isReadinessPacksEnabled()) {
      return { packs: [], total: 0 };
    }

    let query = supabase
      .from('readiness_packs')
      .select(`
        *,
        access_requests (
          id,
          status,
          wine_name,
          producer_name,
          importer_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to list readiness packs:', error);
      return { packs: [], total: 0 };
    }

    const packs = (data || []).map(p => ({
      ...p,
      access_request: p.access_requests,
    })) as ReadinessPackWithRequest[];

    return { packs, total: count || 0 };
  }

  /**
   * Update a pack (status, scope, notes, price).
   */
  async updatePack(
    ctx: ReadinessPackContext,
    packId: string,
    input: UpdateReadinessPackInput
  ): Promise<ReadinessPack> {
    if (!isReadinessPacksEnabled()) {
      throw new Error('Readiness packs feature is not enabled');
    }

    // Validate input
    const validated = updateReadinessPackSchema.parse(input);

    // Get current pack for audit
    const { data: current } = await supabase
      .from('readiness_packs')
      .select('*')
      .eq('id', packId)
      .single();

    if (!current) {
      throw new Error('Readiness pack not found');
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    const events: { type: string; payload: Record<string, unknown> }[] = [];

    if (validated.status && validated.status !== current.status) {
      updates.status = validated.status;
      events.push({
        type: ReadinessPackEventTypes.STATUS_CHANGED,
        payload: { from: current.status, to: validated.status },
      });
    }

    if (validated.scope) {
      updates.scope = validated.scope;
      events.push({
        type: ReadinessPackEventTypes.SCOPE_UPDATED,
        payload: { from: current.scope, to: validated.scope },
      });
    }

    if (validated.price_cents !== undefined && validated.price_cents !== current.price_cents) {
      updates.price_cents = validated.price_cents;
      events.push({
        type: ReadinessPackEventTypes.PRICE_SET,
        payload: { from: current.price_cents, to: validated.price_cents },
      });
    }

    if (validated.notes !== undefined && validated.notes !== current.notes) {
      updates.notes = validated.notes;
      events.push({
        type: ReadinessPackEventTypes.NOTE_ADDED,
        payload: { note: validated.notes },
      });
    }

    if (Object.keys(updates).length === 0) {
      return current as ReadinessPack;
    }

    // Apply update
    const { data: updated, error } = await supabase
      .from('readiness_packs')
      .update(updates)
      .eq('id', packId)
      .select()
      .single();

    if (error || !updated) {
      console.error('Failed to update readiness pack:', error);
      throw new Error('Failed to update readiness pack');
    }

    // Log events
    for (const event of events) {
      await this.logEvent(packId, ctx, event.type, event.payload);
    }

    return updated as ReadinessPack;
  }

  /**
   * Get audit events for a pack.
   */
  async getPackEvents(packId: string): Promise<ReadinessPackEvent[]> {
    if (!isReadinessPacksEnabled()) {
      return [];
    }

    const { data, error } = await supabase
      .from('readiness_pack_events')
      .select('*')
      .eq('readiness_pack_id', packId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch pack events:', error);
      return [];
    }

    return (data || []) as ReadinessPackEvent[];
  }

  /**
   * Log an audit event.
   */
  private async logEvent(
    packId: string,
    ctx: ReadinessPackContext,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await supabase.from('readiness_pack_events').insert({
      readiness_pack_id: packId,
      actor_id: ctx.userId,
      actor_name: ctx.userName || null,
      event_type: eventType,
      payload,
    });
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const readinessPackService = new ReadinessPackService();
