/**
 * OFFER SERVICE - PILOT LOOP 1.0
 *
 * Service layer for multi-line offers with Wine Check enrichment
 * Handles CRUD operations, status workflow, and immutability after acceptance
 *
 * Security:
 * - NO PRICE DATA from Wine-Searcher (enrichment allowlist only)
 * - Immutable after acceptance (locked_at + snapshot)
 * - Tenant isolation
 * - Audit trail (offer_events)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================================================
// TYPES
// ============================================================================

export interface CreateOfferInput {
  tenant_id: string;
  restaurant_id: string;
  request_id?: string;
  supplier_id?: string;
  title?: string;
  currency?: string;
  lines: CreateOfferLineInput[];
  actor_user_id?: string;  // User who created the offer
}

export interface CreateOfferLineInput {
  line_no: number;
  name: string;
  vintage?: number;
  quantity: number;
  offered_unit_price_ore?: number;
  bottle_ml?: number;
  packaging?: string;
  enrichment?: OfferLineEnrichment;
}

export interface OfferLineEnrichment {
  canonical_name?: string;
  producer?: string;
  country?: string;
  region?: string;
  appellation?: string;
  ws_id?: string;
  match_status?: string;
  match_score?: number;
}

export interface UpdateOfferInput {
  title?: string;
  currency?: string;
  status?: string;
}

export interface UpdateOfferLineInput {
  id?: string;  // If updating existing line
  line_no: number;
  name?: string;
  vintage?: number;
  quantity?: number;
  offered_unit_price_ore?: number;
  bottle_ml?: number;
  packaging?: string;
  enrichment?: OfferLineEnrichment;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class OfferService {
  /**
   * Create new offer with lines
   */
  async createOffer(input: CreateOfferInput): Promise<{ offer_id: string }> {
    // Validate enrichment (no forbidden fields)
    for (const line of input.lines) {
      if (line.enrichment) {
        this.validateEnrichment(line.enrichment);
      }
    }

    // Start transaction: Create offer + lines + event
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        tenant_id: input.tenant_id,
        restaurant_id: input.restaurant_id,
        request_id: input.request_id || null,
        supplier_id: input.supplier_id || null,
        title: input.title || null,
        currency: input.currency || 'SEK',
        status: 'DRAFT'
      })
      .select('id')
      .single();

    if (offerError) {
      throw new Error(`Failed to create offer: ${offerError.message}`);
    }

    const offerId = offer.id;

    // Insert lines
    const linesToInsert = input.lines.map((line) => ({
      tenant_id: input.tenant_id,
      offer_id: offerId,
      line_no: line.line_no,
      name: line.name,
      vintage: line.vintage || null,
      quantity: line.quantity,
      offered_unit_price_ore: line.offered_unit_price_ore || null,
      bottle_ml: line.bottle_ml || null,
      packaging: line.packaging || null,
      canonical_name: line.enrichment?.canonical_name || null,
      producer: line.enrichment?.producer || null,
      country: line.enrichment?.country || null,
      region: line.enrichment?.region || null,
      appellation: line.enrichment?.appellation || null,
      ws_id: line.enrichment?.ws_id || null,
      match_status: line.enrichment?.match_status || null,
      match_score: line.enrichment?.match_score || null
    }));

    if (linesToInsert.length > 0) {
      const { error: linesError } = await supabase
        .from('offer_lines')
        .insert(linesToInsert);

      if (linesError) {
        // Rollback: Delete offer
        await supabase.from('offers').delete().eq('id', offerId);
        throw new Error(`Failed to create offer lines: ${linesError.message}`);
      }
    }

    // Log creation event
    await supabase.from('offer_events').insert({
      tenant_id: input.tenant_id,
      offer_id: offerId,
      event_type: 'CREATED',
      actor_user_id: input.actor_user_id || null,
      payload: { line_count: input.lines.length }
    });

    return { offer_id: offerId };
  }

  /**
   * Get offer with lines and events
   */
  async getOffer(
    tenantId: string,
    offerId: string
  ): Promise<{ offer: any; lines: any[]; events: any[] } | null> {
    // Get offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .eq('tenant_id', tenantId)
      .single();

    if (offerError) {
      if (offerError.code === 'PGRST116') {
        return null;  // Not found
      }
      throw new Error(`Failed to fetch offer: ${offerError.message}`);
    }

    // Get lines
    const { data: lines, error: linesError } = await supabase
      .from('offer_lines')
      .select('*')
      .eq('offer_id', offerId)
      .eq('tenant_id', tenantId)
      .order('line_no', { ascending: true });

    if (linesError) {
      throw new Error(`Failed to fetch offer lines: ${linesError.message}`);
    }

    // Get events
    const { data: events, error: eventsError } = await supabase
      .from('offer_events')
      .select('*')
      .eq('offer_id', offerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (eventsError) {
      throw new Error(`Failed to fetch offer events: ${eventsError.message}`);
    }

    // Get latest match per line (if any)
    const lineMatches: Record<string, any> = {};
    if (lines && lines.length > 0) {
      const lineIds = lines.map((l) => l.id);

      // Fetch latest match_results per line using DISTINCT ON pattern
      // Note: PostgreSQL allows this efficient pattern
      const { data: matches, error: matchError } = await supabase
        .from('match_results')
        .select('source_id, status, confidence, match_method, matched_entity_type, matched_entity_id, explanation, created_at')
        .eq('tenant_id', tenantId)
        .eq('source_type', 'offer_line')
        .in('source_id', lineIds)
        .order('source_id', { ascending: true })
        .order('created_at', { ascending: false });

      if (!matchError && matches) {
        // Group by source_id and take first (latest) per source
        const latestMatches = new Map<string, any>();
        for (const match of matches) {
          if (!latestMatches.has(match.source_id)) {
            latestMatches.set(match.source_id, match);
          }
        }

        // Build lookup map
        latestMatches.forEach((match, sourceId) => {
          lineMatches[sourceId] = {
            status: match.status,
            confidence: match.confidence,
            match_method: match.match_method,
            matched_entity_type: match.matched_entity_type,
            matched_entity_id: match.matched_entity_id,
            explanation: match.explanation,
            created_at: match.created_at
          };
        });
      }
    }

    // Attach latest_match to each line
    const linesWithMatches = (lines || []).map((line) => ({
      ...line,
      latest_match: lineMatches[line.id] || null
    }));

    return {
      offer,
      lines: linesWithMatches,
      events: events || []
    };
  }

  /**
   * Update offer metadata (only if status = DRAFT)
   */
  async updateOffer(
    tenantId: string,
    offerId: string,
    updates: UpdateOfferInput,
    actorUserId?: string
  ): Promise<any> {
    // Check if offer is locked
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('status, locked_at')
      .eq('id', offerId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      throw new Error(`Offer not found: ${fetchError.message}`);
    }

    if (offer.locked_at || offer.status !== 'DRAFT') {
      throw new Error(
        `Cannot update offer: status is ${offer.status} (only DRAFT offers can be updated)`
      );
    }

    // Update offer
    const { data: updated, error: updateError } = await supabase
      .from('offers')
      .update(updates)
      .eq('id', offerId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update offer: ${updateError.message}`);
    }

    // Log event
    await supabase.from('offer_events').insert({
      tenant_id: tenantId,
      offer_id: offerId,
      event_type: 'UPDATED',
      actor_user_id: actorUserId || null,
      payload: { updates }
    });

    return updated;
  }

  /**
   * Update offer lines (only if status = DRAFT)
   */
  async updateOfferLines(
    tenantId: string,
    offerId: string,
    lineUpdates: UpdateOfferLineInput[]
  ): Promise<any[]> {
    // Check if offer is locked
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('status, locked_at')
      .eq('id', offerId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) {
      throw new Error(`Offer not found: ${fetchError.message}`);
    }

    if (offer.locked_at || offer.status !== 'DRAFT') {
      throw new Error(
        `Cannot update lines: status is ${offer.status} (only DRAFT offers can be updated)`
      );
    }

    // Validate enrichment
    for (const line of lineUpdates) {
      if (line.enrichment) {
        this.validateEnrichment(line.enrichment);
      }
    }

    // Update or insert lines
    const results: any[] = [];

    for (const lineUpdate of lineUpdates) {
      if (lineUpdate.id) {
        // Update existing line
        const updateData: any = {};
        if (lineUpdate.name !== undefined) updateData.name = lineUpdate.name;
        if (lineUpdate.vintage !== undefined) updateData.vintage = lineUpdate.vintage;
        if (lineUpdate.quantity !== undefined) updateData.quantity = lineUpdate.quantity;
        if (lineUpdate.offered_unit_price_ore !== undefined)
          updateData.offered_unit_price_ore = lineUpdate.offered_unit_price_ore;
        if (lineUpdate.bottle_ml !== undefined) updateData.bottle_ml = lineUpdate.bottle_ml;
        if (lineUpdate.packaging !== undefined) updateData.packaging = lineUpdate.packaging;

        // Enrichment
        if (lineUpdate.enrichment) {
          if (lineUpdate.enrichment.canonical_name !== undefined)
            updateData.canonical_name = lineUpdate.enrichment.canonical_name;
          if (lineUpdate.enrichment.producer !== undefined)
            updateData.producer = lineUpdate.enrichment.producer;
          if (lineUpdate.enrichment.country !== undefined)
            updateData.country = lineUpdate.enrichment.country;
          if (lineUpdate.enrichment.region !== undefined)
            updateData.region = lineUpdate.enrichment.region;
          if (lineUpdate.enrichment.appellation !== undefined)
            updateData.appellation = lineUpdate.enrichment.appellation;
          if (lineUpdate.enrichment.ws_id !== undefined)
            updateData.ws_id = lineUpdate.enrichment.ws_id;
          if (lineUpdate.enrichment.match_status !== undefined)
            updateData.match_status = lineUpdate.enrichment.match_status;
          if (lineUpdate.enrichment.match_score !== undefined)
            updateData.match_score = lineUpdate.enrichment.match_score;
        }

        const { data, error } = await supabase
          .from('offer_lines')
          .update(updateData)
          .eq('id', lineUpdate.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update line ${lineUpdate.id}: ${error.message}`);
        }

        results.push(data);

        // Log event
        await supabase.from('offer_events').insert({
          tenant_id: tenantId,
          offer_id: offerId,
          event_type: 'LINE_UPDATED',
          actor_user_id: null,
          payload: { line_id: lineUpdate.id, updates: updateData }
        });
      } else {
        // Insert new line
        const insertData = {
          tenant_id: tenantId,
          offer_id: offerId,
          line_no: lineUpdate.line_no,
          name: lineUpdate.name!,
          vintage: lineUpdate.vintage || null,
          quantity: lineUpdate.quantity!,
          offered_unit_price_ore: lineUpdate.offered_unit_price_ore || null,
          bottle_ml: lineUpdate.bottle_ml || null,
          packaging: lineUpdate.packaging || null,
          canonical_name: lineUpdate.enrichment?.canonical_name || null,
          producer: lineUpdate.enrichment?.producer || null,
          country: lineUpdate.enrichment?.country || null,
          region: lineUpdate.enrichment?.region || null,
          appellation: lineUpdate.enrichment?.appellation || null,
          ws_id: lineUpdate.enrichment?.ws_id || null,
          match_status: lineUpdate.enrichment?.match_status || null,
          match_score: lineUpdate.enrichment?.match_score || null
        };

        const { data, error } = await supabase
          .from('offer_lines')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to insert line: ${error.message}`);
        }

        results.push(data);

        // Log event
        await supabase.from('offer_events').insert({
          tenant_id: tenantId,
          offer_id: offerId,
          event_type: 'LINE_ADDED',
          actor_user_id: null,
          payload: { line_no: lineUpdate.line_no }
        });
      }
    }

    return results;
  }

  /**
   * Accept offer — supports partial line acceptance
   *
   * Multi-accept: Multiple offers (from different suppliers) can be accepted per request.
   * Partial acceptance: Restaurant can choose which lines to accept via acceptedLineIds.
   *
   * @param acceptedLineIds - if provided, only these offer_lines are accepted (partial)
   *                          if omitted or empty, ALL lines are accepted
   */
  async acceptOffer(
    tenantId: string,
    offerId: string,
    actorUserId?: string,
    acceptedLineIds?: string[]
  ): Promise<{ offer: any; snapshot: any }> {
    // Load offer + lines
    const data = await this.getOffer(tenantId, offerId);

    if (!data) {
      throw new Error('Offer not found');
    }

    const { offer, lines } = data;

    // Validate not already fully accepted
    if (offer.status === 'ACCEPTED') {
      throw new Error('Offer already accepted');
    }

    if (offer.locked_at) {
      throw new Error('Offer is already locked');
    }

    // Determine which lines to accept
    const isPartial = acceptedLineIds && acceptedLineIds.length > 0 && acceptedLineIds.length < lines.length;
    const lineIdsToAccept = acceptedLineIds && acceptedLineIds.length > 0
      ? new Set(acceptedLineIds)
      : new Set(lines.map(l => l.id)); // All lines if none specified

    // Validate all requested lineIds actually exist in this offer
    for (const lineId of lineIdsToAccept) {
      if (!lines.find(l => l.id === lineId)) {
        throw new Error(`Line ${lineId} not found in this offer`);
      }
    }

    // Validate MOQ if partial acceptance
    if (isPartial && offer.min_total_quantity) {
      const acceptedQuantity = lines
        .filter(l => lineIdsToAccept.has(l.id))
        .reduce((sum, l) => sum + (l.quantity || 0), 0);
      if (acceptedQuantity < offer.min_total_quantity) {
        throw new Error(
          `Total quantity (${acceptedQuantity}) is below minimum (${offer.min_total_quantity}). ` +
          'Select more wines or accept the full offer.'
        );
      }
    }

    // Mark lines as accepted/rejected
    for (const line of lines) {
      const accepted = lineIdsToAccept.has(line.id);
      await supabase
        .from('offer_lines')
        .update({ accepted })
        .eq('id', line.id);
    }

    // Build snapshot with accepted lines only
    const acceptedLines = lines.filter(l => lineIdsToAccept.has(l.id));
    const snapshot = {
      offer: { ...offer },
      lines: acceptedLines.map((line) => ({ ...line, accepted: true })),
      rejected_lines: lines.filter(l => !lineIdsToAccept.has(l.id)).map(l => ({ ...l, accepted: false })),
      accepted_at: new Date().toISOString(),
      is_partial: isPartial,
    };

    // Update offer: lock + status + snapshot
    const now = new Date().toISOString();
    const newStatus = isPartial ? 'PARTIALLY_ACCEPTED' : 'ACCEPTED';
    const { data: updated, error: updateError } = await supabase
      .from('offers')
      .update({
        status: newStatus,
        accepted_at: now,
        locked_at: now,
        snapshot: snapshot
      })
      .eq('id', offerId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to accept offer: ${updateError.message}`);
    }

    // Write accepted_offer_id on quote_request_assignments (NOT on requests)
    // This allows multiple suppliers to be accepted per request
    if (offer.request_id && offer.supplier_id) {
      const { error: assignmentUpdateError } = await supabase
        .from('quote_request_assignments')
        .update({ accepted_offer_id: offerId })
        .eq('quote_request_id', offer.request_id)
        .eq('supplier_id', offer.supplier_id);

      if (assignmentUpdateError) {
        console.error('Failed to update assignment:', assignmentUpdateError);
      }
    }

    // Also update requests.accepted_offer_id for backwards compat (last one wins)
    if (offer.request_id) {
      const { error: requestUpdateError } = await supabase
        .from('requests')
        .update({ accepted_offer_id: offerId })
        .eq('id', offer.request_id);

      if (requestUpdateError) {
        console.error('Failed to update request:', requestUpdateError);
      }
    }

    // Log acceptance event
    await supabase.from('offer_events').insert({
      tenant_id: tenantId,
      offer_id: offerId,
      event_type: 'ACCEPTED',
      actor_user_id: actorUserId || null,
      payload: {
        accepted_at: now,
        request_id: offer.request_id,
        is_partial: isPartial,
        accepted_line_count: acceptedLines.length,
        total_line_count: lines.length,
        accepted_line_ids: [...lineIdsToAccept],
      }
    });

    return {
      offer: updated,
      snapshot
    };
  }

  /**
   * Validate enrichment contains no forbidden fields
   */
  private validateEnrichment(enrichment: OfferLineEnrichment): void {
    const serialized = JSON.stringify(enrichment);
    const forbiddenPattern = /price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i;

    if (forbiddenPattern.test(serialized)) {
      throw new Error('SECURITY_VIOLATION: Forbidden price data detected in enrichment');
    }
  }
}

export const offerService = new OfferService();
