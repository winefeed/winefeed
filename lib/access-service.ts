/**
 * VINKOLL ACCESS - Service Layer
 *
 * Supabase CRUD helpers for all access_* tables.
 * Uses supabaseAdmin (service role) for all queries.
 */

import { getSupabaseAdmin } from './supabase-server';
import type {
  AccessConsumer,
  AccessLot,
  AccessWatchlist,
  AccessRequest,
  AccessWine,
  WineWithProducer,
  WineDetail,
  LotPublic,
  WineSearchParams,
  PaginatedResult,
  RequestWithWine,
  WatchlistWithTarget,
  AdminRequestView,
  ImporterResponseData,
  WineInput,
  LotInput,
  WineStatus,
} from './access-types';

// ============================================================================
// CONSUMERS
// ============================================================================

export async function getConsumerByEmail(email: string): Promise<AccessConsumer | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_consumers')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !data) return null;
  return data;
}

export async function getConsumerById(id: string): Promise<AccessConsumer | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_consumers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createConsumer(email: string, name?: string): Promise<AccessConsumer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_consumers')
    .insert({ email: email.toLowerCase().trim(), name: name || null })
    .select()
    .single();

  if (error) throw new Error(`Failed to create consumer: ${error.message}`);
  return data;
}

export async function updateConsumer(
  id: string,
  updates: Partial<Pick<AccessConsumer, 'name' | 'phone' | 'verified_at'>>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('access_consumers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update consumer: ${error.message}`);
}

// ============================================================================
// WINES
// ============================================================================

export async function searchWines(params: WineSearchParams): Promise<PaginatedResult<WineWithProducer>> {
  const supabase = getSupabaseAdmin();
  const { q, type, country, region, grape, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('access_wines')
    .select(`
      *,
      producer:access_producers!inner(id, name, country, region),
      lots:access_lots(id)
    `, { count: 'exact' });

  // Only show active wines in public search
  query = query.eq('status', 'ACTIVE');

  if (q) {
    query = query.or(`name.ilike.%${q}%,grape.ilike.%${q}%,region.ilike.%${q}%,appellation.ilike.%${q}%`);
  }
  if (type) query = query.eq('wine_type', type);
  if (country) query = query.eq('country', country);
  if (region) query = query.ilike('region', `%${region}%`);
  if (grape) query = query.ilike('grape', `%${grape}%`);

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Wine search failed: ${error.message}`);

  const wines: WineWithProducer[] = (data || []).map((w: any) => ({
    ...w,
    producer: w.producer,
    lot_count: w.lots?.length || 0,
    lots: undefined,
  }));

  return {
    data: wines,
    total: count || 0,
    page,
    limit,
    hasMore: offset + limit < (count || 0),
  };
}

export async function getWineById(id: string): Promise<WineDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: wine, error } = await supabase
    .from('access_wines')
    .select(`
      *,
      producer:access_producers(*)
    `)
    .eq('id', id)
    .single();

  if (error || !wine) return null;

  // Fetch lots separately with importer join (avoids PostgREST nested FK issues)
  const { data: lotsData } = await supabase
    .from('access_lots')
    .select('*, importer:access_importers!importer_id(id, name, description)')
    .eq('wine_id', id)
    .eq('available', true)
    .order('created_at', { ascending: false });

  const publicLots: LotPublic[] = (lotsData || []).map((lot: any) => {
    const { note_private, contact_email, ...rest } = lot;
    return rest;
  });

  return {
    ...wine,
    producer: (wine as any).producer,
    lots: publicLots,
  } as WineDetail;
}

export async function getWineFilters(): Promise<{ types: string[]; countries: string[] }> {
  const supabase = getSupabaseAdmin();

  const [typesRes, countriesRes] = await Promise.all([
    supabase.from('access_wines').select('wine_type').order('wine_type'),
    supabase.from('access_wines').select('country').not('country', 'is', null).order('country'),
  ]);

  const types = [...new Set((typesRes.data || []).map((r: any) => r.wine_type))];
  const countries = [...new Set((countriesRes.data || []).map((r: any) => r.country).filter(Boolean))];

  return { types, countries };
}

// ============================================================================
// PRODUCERS
// ============================================================================

export async function getProducers(): Promise<{ id: string; name: string }[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_producers')
    .select('id, name')
    .order('name');

  if (error) throw new Error(`Failed to fetch producers: ${error.message}`);
  return data || [];
}

export async function getOrCreateProducer(name: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const trimmed = name.trim();

  // Look for existing (case-insensitive)
  const { data: rows } = await supabase
    .from('access_producers')
    .select('id')
    .ilike('name', trimmed)
    .limit(1);

  if (rows && rows.length > 0) return rows[0].id;

  // Create new
  const { data: created, error } = await supabase
    .from('access_producers')
    .insert({ name: trimmed })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create producer: ${error.message}`);
  return created.id;
}

// ============================================================================
// WINES — ADMIN CRUD
// ============================================================================

export async function searchWinesAdmin(params: {
  q?: string;
  status?: WineStatus;
  limit?: number;
  offset?: number;
}): Promise<{ data: AccessWine[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const { q, status, limit = 50, offset = 0 } = params;

  let query = supabase
    .from('access_wines')
    .select('*, producer:access_producers!producer_id(id, name), lots:access_lots(id)', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (q) {
    query = query.or(`name.ilike.%${q}%,grape.ilike.%${q}%,region.ilike.%${q}%,country.ilike.%${q}%`);
  }

  query = query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Admin wine search failed: ${error.message}`);

  // Fetch available lot counts in one query
  const wineIds = (data || []).map((w: any) => w.id);
  let availableCounts = new Map<string, number>();
  if (wineIds.length > 0) {
    const { data: availLots } = await supabase
      .from('access_lots')
      .select('wine_id')
      .in('wine_id', wineIds)
      .eq('available', true);

    for (const lot of availLots || []) {
      availableCounts.set(lot.wine_id, (availableCounts.get(lot.wine_id) || 0) + 1);
    }
  }

  const wines = (data || []).map((w: any) => ({
    ...w,
    lot_count: w.lots?.length || 0,
    available_lot_count: availableCounts.get(w.id) || 0,
    lots: undefined,
  }));

  return { data: wines as any[], total: count || 0 };
}

export async function createWine(input: WineInput): Promise<AccessWine> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('access_wines')
    .insert({
      name: input.name.trim(),
      wine_type: input.wine_type.trim(),
      vintage: input.vintage,
      country: input.country.trim(),
      region: input.region.trim(),
      grape: input.grape?.trim() || null,
      appellation: input.appellation?.trim() || null,
      description: input.description?.trim() || null,
      price_sek: input.price_sek ?? null,
      image_url: input.image_url?.trim() || null,
      status: input.status || 'DRAFT',
      producer_id: input.producer_id || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create wine: ${error.message}`);
  return data as AccessWine;
}

export async function updateWine(id: string, input: Partial<WineInput>): Promise<AccessWine> {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.wine_type !== undefined) updates.wine_type = input.wine_type.trim();
  if (input.vintage !== undefined) updates.vintage = input.vintage;
  if (input.country !== undefined) updates.country = input.country.trim();
  if (input.region !== undefined) updates.region = input.region.trim();
  if (input.grape !== undefined) updates.grape = input.grape?.trim() || null;
  if (input.appellation !== undefined) updates.appellation = input.appellation?.trim() || null;
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.price_sek !== undefined) updates.price_sek = input.price_sek ?? null;
  if (input.image_url !== undefined) updates.image_url = input.image_url?.trim() || null;
  if (input.status !== undefined) updates.status = input.status;
  if (input.producer_id !== undefined) updates.producer_id = input.producer_id || null;

  const { data, error } = await supabase
    .from('access_wines')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update wine: ${error.message}`);
  return data as AccessWine;
}

export async function archiveWine(id: string): Promise<AccessWine> {
  return updateWine(id, { status: 'ARCHIVED' });
}

// ============================================================================
// LOTS — ADMIN CRUD
// ============================================================================

export async function getLotsByWineId(wineId: string): Promise<AccessLot[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_lots')
    .select('*, importer:access_importers!importer_id(id, name, description)')
    .eq('wine_id', wineId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch lots: ${error.message}`);
  return (data || []) as AccessLot[];
}

export async function createLot(input: LotInput): Promise<AccessLot> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('access_lots')
    .insert({
      wine_id: input.wine_id,
      importer_id: input.importer_id || null,
      note_public: input.note_public?.trim() || null,
      note_private: input.note_private?.trim() || null,
      price_sek: input.price_sek ?? null,
      min_quantity: input.min_quantity ?? 1,
      contact_email: input.contact_email?.trim() || null,
      available: input.available ?? true,
    })
    .select('*, importer:access_importers!importer_id(id, name, description)')
    .single();

  if (error) throw new Error(`Failed to create lot: ${error.message}`);
  return data as AccessLot;
}

export async function updateLot(id: string, input: Partial<LotInput>): Promise<AccessLot> {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {};
  if (input.importer_id !== undefined) updates.importer_id = input.importer_id || null;
  if (input.note_public !== undefined) updates.note_public = input.note_public?.trim() || null;
  if (input.note_private !== undefined) updates.note_private = input.note_private?.trim() || null;
  if (input.price_sek !== undefined) updates.price_sek = input.price_sek ?? null;
  if (input.min_quantity !== undefined) updates.min_quantity = input.min_quantity;
  if (input.contact_email !== undefined) updates.contact_email = input.contact_email?.trim() || null;
  if (input.available !== undefined) updates.available = input.available;

  const { data, error } = await supabase
    .from('access_lots')
    .update(updates)
    .eq('id', id)
    .select('*, importer:access_importers!importer_id(id, name, description)')
    .single();

  if (error) throw new Error(`Failed to update lot: ${error.message}`);
  return data as AccessLot;
}

export async function deleteLot(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('access_lots')
    .update({ available: false })
    .eq('id', id);

  if (error) throw new Error(`Failed to disable lot: ${error.message}`);
}

export async function getImporters(): Promise<{ id: string; name: string; description: string | null; contact_email: string | null }[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_importers')
    .select('id, name, description, contact_email')
    .order('name');

  if (error) throw new Error(`Failed to fetch importers: ${error.message}`);
  return data || [];
}

// ============================================================================
// WATCHLISTS
// ============================================================================

export async function createWatchlist(
  consumerId: string,
  input: { target_type: string; target_id?: string; query_json?: Record<string, unknown>; note?: string }
): Promise<AccessWatchlist> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_watchlists')
    .insert({
      consumer_id: consumerId,
      target_type: input.target_type,
      target_id: input.target_id || null,
      query_json: input.query_json || null,
      note: input.note || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create watchlist: ${error.message}`);
  return data;
}

export async function getWatchlistsByConsumer(consumerId: string): Promise<WatchlistWithTarget[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_watchlists')
    .select('*')
    .eq('consumer_id', consumerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch watchlists: ${error.message}`);

  const enriched: WatchlistWithTarget[] = [];
  for (const wl of data || []) {
    const item: WatchlistWithTarget = { ...wl };
    if (wl.target_type === 'wine' && wl.target_id) {
      const { data: wine } = await supabase
        .from('access_wines')
        .select('id, name')
        .eq('id', wl.target_id)
        .single();
      item.wine = wine;
    } else if (wl.target_type === 'producer' && wl.target_id) {
      const { data: producer } = await supabase
        .from('access_producers')
        .select('id, name')
        .eq('id', wl.target_id)
        .single();
      item.producer = producer;
    }
    enriched.push(item);
  }

  return enriched;
}

export async function deleteWatchlist(consumerId: string, watchlistId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('access_watchlists')
    .delete()
    .eq('id', watchlistId)
    .eq('consumer_id', consumerId);

  if (error) throw new Error(`Failed to delete watchlist: ${error.message}`);
}

// ============================================================================
// REQUESTS
// ============================================================================

export async function createRequest(
  consumerId: string,
  input: {
    wine_id?: string;
    lot_id?: string;
    importer_id?: string;
    importer_name?: string;
    quantity: number;
    message?: string;
  }
): Promise<AccessRequest> {
  const supabase = getSupabaseAdmin();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { data, error } = await supabase
    .from('access_requests')
    .insert({
      consumer_id: consumerId,
      wine_id: input.wine_id || null,
      lot_id: input.lot_id || null,
      importer_id: input.importer_id || null,
      importer_name: input.importer_name || null,
      quantity: input.quantity,
      message: input.message || null,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create request: ${error.message}`);
  return data;
}

export async function getRequestsByConsumer(consumerId: string): Promise<RequestWithWine[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_requests')
    .select(`
      *,
      wine:access_wines(id, name, wine_type, vintage)
    `)
    .eq('consumer_id', consumerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch requests: ${error.message}`);
  return (data || []) as RequestWithWine[];
}

// ============================================================================
// EVENT LOGGING
// ============================================================================

export async function logAccessEvent(
  eventType: string,
  consumerId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from('access_events').insert({
    event_type: eventType,
    consumer_id: consumerId,
    metadata,
  });
}

// ============================================================================
// PII SANITIZATION
// ============================================================================

// Standard email pattern
const EMAIL_REGEX = /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
// Spaced-out email: "markus @ vinkoll . se"
const EMAIL_SPACED_REGEX = /\b[\w.%+-]+\s*@\s*[\w.-]+\s*\.\s*[A-Za-z]{2,}\b/g;
// "markus(at)vinkoll.se" / "markus[at]vinkoll.se"
const EMAIL_OBFUSCATED_REGEX = /\b[\w.%+-]+\s*[\(\[]\s*at\s*[\)\]]\s*[\w.-]+\.[A-Za-z]{2,}\b/gi;
// Swedish phone: +46, 070, 073, etc. with various separators
const PHONE_REGEX = /(\+46|0)\s*\(?\d\)?\s*[\d\s\-\.]{6,}/g;

export function sanitizeConsumerMessage(message: string | null): string | null {
  if (!message) return null;
  return message
    .replace(EMAIL_REGEX, '[e-post dold]')
    .replace(EMAIL_SPACED_REGEX, '[e-post dold]')
    .replace(EMAIL_OBFUSCATED_REGEX, '[e-post dold]')
    .replace(PHONE_REGEX, '[telefon dold]');
}

// ============================================================================
// ADMIN / MEDIATION HELPERS
// ============================================================================

async function lookupImporter(supabase: ReturnType<typeof getSupabaseAdmin>, importerId: string | null): Promise<{ name: string; contact_email: string | null } | null> {
  if (!importerId) return null;
  try {
    const { data } = await supabase
      .from('access_importers')
      .select('name, contact_email')
      .eq('id', importerId)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

export async function getRequestsForAdmin(): Promise<AdminRequestView[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('access_requests')
    .select(`
      id, quantity, message, status,
      forwarded_at, responded_at, consumer_notified_at, order_confirmed_at,
      response_price_sek, response_quantity, response_delivery_days, response_note,
      expires_at, created_at, updated_at,
      consumer:access_consumers!consumer_id(id, name, email, phone),
      wine:access_wines!wine_id(id, name, wine_type, vintage, country, region, grape),
      lot:access_lots!lot_id(id, price_sek)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch admin requests: ${error.message}`);

  const requests = (data || []) as any[];

  // Fetch all importers (small table) — avoids PostgREST FK cache issues
  const { data: allImporters, error: impErr } = await supabase.from('access_importers').select('id, name, contact_email');
  const importerMap = new Map((allImporters || []).map((i: any) => [i.id, i]));

  // Fetch lot→importer mappings via raw query (PostgREST nulls FK columns to access_importers)
  const lotIds = requests.map(r => r.lot?.id).filter(Boolean);
  let lotImporterMap = new Map<string, string>();
  if (lotIds.length > 0) {
    const { data: lotRows, error: rpcErr } = await supabase.rpc('get_lot_importer_ids', { lot_ids: lotIds });
    if (lotRows) {
      lotImporterMap = new Map(lotRows.map((r: any) => [r.lot_id, r.importer_id]));
    }
  }

  // Enrich with importer info
  const enriched: AdminRequestView[] = [];
  for (const req of requests) {
    let importer: AdminRequestView['importer'] = null;

    const lotId = req.lot?.id;
    if (lotId) {
      const importerId = lotImporterMap.get(lotId);
      if (importerId) {
        const imp = importerMap.get(importerId);
        if (imp) {
          importer = { id: importerId, name: imp.name, contact_email: imp.contact_email };
        }
      }
    }

    enriched.push({
      ...req,
      consumer: req.consumer,
      wine: req.wine,
      importer,
      lot_price_sek: req.lot?.price_sek || null,
    });
  }

  // Sort: action-required first
  enriched.sort((a, b) => {
    const scoreA = adminActionScore(a);
    const scoreB = adminActionScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return enriched;
}

function adminActionScore(r: AdminRequestView): number {
  // Highest priority: responded but consumer not notified
  if ((r.status === 'accepted' || r.status === 'declined') && !r.consumer_notified_at) return 4;
  // New: pending, not forwarded
  if (r.status === 'pending' && !r.forwarded_at) return 3;
  // Forwarded, waiting for importer
  if ((r.status === 'pending' || r.status === 'seen') && r.forwarded_at) return 2;
  // Completed
  if (r.consumer_notified_at) return 0;
  return 1;
}

export async function getRequestByIdForAdmin(id: string): Promise<AdminRequestView | null> {
  const supabase = getSupabaseAdmin();

  const { data: req, error } = await supabase
    .from('access_requests')
    .select(`
      id, quantity, message, status,
      forwarded_at, responded_at, consumer_notified_at, order_confirmed_at,
      response_price_sek, response_quantity, response_delivery_days, response_note,
      expires_at, created_at, updated_at,
      consumer:access_consumers!consumer_id(id, name, email, phone),
      wine:access_wines!wine_id(id, name, wine_type, vintage, country, region, grape),
      lot:access_lots!lot_id(id, price_sek)
    `)
    .eq('id', id)
    .single();

  if (error || !req) return null;

  let importer: AdminRequestView['importer'] = null;
  const lotId = (req as any).lot?.id;
  if (lotId) {
    const { data: lotRows } = await supabase.rpc('get_lot_importer_ids', { lot_ids: [lotId] });
    const importerId = lotRows?.[0]?.importer_id;
    if (importerId) {
      const { data: imp } = await supabase.from('access_importers').select('id, name, contact_email').eq('id', importerId).single();
      if (imp) {
        importer = { id: imp.id, name: imp.name, contact_email: imp.contact_email };
      }
    }
  }

  return {
    ...(req as any),
    consumer: (req as any).consumer,
    wine: (req as any).wine,
    importer,
    lot_price_sek: (req as any).lot?.price_sek || null,
  };
}

export async function forwardRequestToImporter(
  requestId: string,
  metadata: Record<string, unknown>
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('access_requests')
    .update({ forwarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) {
    console.error('Failed to mark request as forwarded:', error);
    return false;
  }
  return true;
}

export async function markRequestSeen(requestId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // Only update if still pending (don't overwrite later statuses)
  const { data: req } = await supabase
    .from('access_requests')
    .select('status')
    .eq('id', requestId)
    .single();

  if (!req || req.status !== 'pending') return false;

  const { error } = await supabase
    .from('access_requests')
    .update({ status: 'seen', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending');

  return !error;
}

export async function recordImporterResponse(
  requestId: string,
  response: ImporterResponseData
): Promise<AccessRequest | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('access_requests')
    .update({
      status: response.accepted ? 'accepted' : 'declined',
      response_price_sek: response.price_sek ?? null,
      response_quantity: response.quantity ?? null,
      response_delivery_days: response.delivery_days ?? null,
      response_note: response.note ?? null,
      responded_at: now,
      updated_at: now,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to record importer response:', error);
    return null;
  }
  return data;
}

export async function markConsumerNotified(requestId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('access_requests')
    .update({ consumer_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', requestId);

  return !error;
}

export async function markOrderConfirmed(requestId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('access_requests')
    .update({ order_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) {
    console.error('Failed to mark order as confirmed:', error);
    return false;
  }
  return true;
}
