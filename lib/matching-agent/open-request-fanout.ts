/**
 * Fan-out logic for open (broadcast) requests.
 *
 * Given open_criteria, finds suppliers whose catalogue contains wines
 * matching the criteria and creates quote_request_assignments for them.
 *
 * Reuses smart-query-ish filters directly against supplier_wines so we
 * stay consistent with the restaurant-side match semantics (appellation
 * matches name/region/appellation_column etc).
 */

import { createClient } from '@supabase/supabase-js';

export interface OpenCriteria {
  color?: string;
  appellation?: string;
  region?: string;
  country?: string;
  grape?: string;
  max_price_ex_vat_sek?: number;
  min_bottles?: number;
  vintage_from?: number;
  organic?: boolean;
  biodynamic?: boolean;
  free_text?: string;
}

const COLOR_LABEL_SV: Record<string, string> = {
  red: 'rött', white: 'vitt', rose: 'rosé',
  sparkling: 'mousserande', orange: 'orange', fortified: 'starkvin',
};

/**
 * Render an OpenCriteria as a short Swedish summary line — the same
 * phrasing every surface (admin queue, fan-out fritext, supplier email)
 * uses, so the user sees identical wording from creation through delivery.
 */
export function describeOpenCriteria(c: OpenCriteria): string {
  const parts: string[] = [];
  if (c.color) parts.push(COLOR_LABEL_SV[c.color] || c.color);
  if (c.appellation) parts.push(c.appellation);
  else if (c.region) parts.push(c.region);
  if (c.country && !c.appellation && !c.region) parts.push(c.country);
  if (c.grape) parts.push(c.grape);
  const base = parts.join(', ') || 'Kategoriförfrågan';
  const extras: string[] = [];
  if (c.max_price_ex_vat_sek) extras.push(`max ${c.max_price_ex_vat_sek} kr/fl`);
  if (c.min_bottles) extras.push(`min ${c.min_bottles} fl`);
  if (c.vintage_from) extras.push(`årgång ${c.vintage_from}+`);
  if (c.organic) extras.push('ekologiskt');
  if (c.biodynamic) extras.push('biodynamiskt');
  return extras.length ? `${base} (${extras.join(', ')})` : base;
}

/**
 * Render an OpenCriteria as a list of badge labels — for UI surfaces
 * (admin review, supplier detail header) that want chips instead of
 * a single sentence.
 */
export function openCriteriaBadges(c: OpenCriteria): string[] {
  const badges: string[] = [];
  if (c.color) badges.push(COLOR_LABEL_SV[c.color] || c.color);
  if (c.appellation) badges.push(c.appellation);
  if (c.region && !c.appellation) badges.push(c.region);
  if (c.country && !c.appellation && !c.region) badges.push(c.country);
  if (c.grape) badges.push(c.grape);
  if (c.max_price_ex_vat_sek) badges.push(`max ${c.max_price_ex_vat_sek} kr/fl`);
  if (c.min_bottles) badges.push(`min ${c.min_bottles} fl`);
  if (c.vintage_from) badges.push(`årgång ${c.vintage_from}+`);
  if (c.organic) badges.push('ekologiskt');
  if (c.biodynamic) badges.push('biodynamiskt');
  return badges;
}

export interface FanoutResult {
  suppliers_matched: number;
  assignments_created: number;
  total_matching_wines: number;
}

const MAX_SUPPLIERS_PER_BROADCAST = 25;
const ASSIGNMENT_TTL_HOURS = 72;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function escapeOr(s: string): string {
  // Defense-in-depth for values interpolated into PostgREST filter strings:
  // - strip comma + parens (those are .or() / filter separators)
  // - strip % and * (prevent broadening ILIKE patterns beyond intent)
  // - strip colon (PostgREST filter-op separator)
  // - hard-cap at 100 chars so a pathological long value can't blow up the URL
  return s.replace(/[,()%*:]/g, '').trim().slice(0, 100);
}

/**
 * Find suppliers whose catalogue has wines matching the criteria.
 * Returns a ranked list of supplier IDs with their match count.
 */
export async function findMatchingSuppliers(criteria: OpenCriteria): Promise<Array<{ supplier_id: string; match_count: number }>> {
  const sb = getAdmin();
  let query = sb
    .from('supplier_wines')
    .select('supplier_id, id')
    .eq('is_active', true);

  if (criteria.color) {
    query = query.eq('color', criteria.color);
  }

  if (criteria.max_price_ex_vat_sek) {
    // price_ex_vat_sek is stored in öre — allow 30% headroom like smart-query
    const maxOre = Math.round(criteria.max_price_ex_vat_sek * 100 * 1.3);
    query = query.lte('price_ex_vat_sek', maxOre);
  }

  if (criteria.country) {
    query = query.eq('country', criteria.country);
  }

  if (criteria.grape) {
    query = query.ilike('grape', `%${escapeOr(criteria.grape)}%`);
  }

  // Appellation/region: match on region OR name OR appellation column
  // (same logic as smart-query full-mode)
  const regionTerm = criteria.appellation || criteria.region;
  if (regionTerm) {
    const t = escapeOr(regionTerm);
    query = query.or(`region.ilike.%${t}%,name.ilike.%${t}%,appellation.ilike.%${t}%`);
  }

  if (criteria.vintage_from) {
    query = query.gte('vintage', criteria.vintage_from);
  }

  if (criteria.organic) query = query.eq('organic', true);
  if (criteria.biodynamic) query = query.eq('biodynamic', true);

  const { data, error } = await query.limit(2000);
  if (error) {
    console.error('[open-fanout] Query error:', error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data || []) {
    counts.set(row.supplier_id, (counts.get(row.supplier_id) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([supplier_id, match_count]) => ({ supplier_id, match_count }))
    .sort((a, b) => b.match_count - a.match_count)
    .slice(0, MAX_SUPPLIERS_PER_BROADCAST);
}

/**
 * Create quote_request_assignments for each matching supplier.
 * Idempotent: safe to call twice (uses upsert on supplier_id + quote_request_id).
 */
export async function assignOpenRequest(
  requestId: string,
  criteria: OpenCriteria
): Promise<FanoutResult> {
  const matches = await findMatchingSuppliers(criteria);

  if (matches.length === 0) {
    return { suppliers_matched: 0, assignments_created: 0, total_matching_wines: 0 };
  }

  const totalWines = matches.reduce((sum, m) => sum + m.match_count, 0);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ASSIGNMENT_TTL_HOURS * 60 * 60 * 1000);

  const rows = matches.map(m => ({
    quote_request_id: requestId,
    supplier_id: m.supplier_id,
    status: 'SENT' as const,
    match_score: Math.min(100, m.match_count * 10),
    match_reasons: [`${m.match_count} matchande viner i katalogen`],
    sent_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  }));

  const sb = getAdmin();
  const { error } = await sb
    .from('quote_request_assignments')
    .insert(rows);

  if (error) {
    console.error('[open-fanout] Insert error:', error);
    return { suppliers_matched: matches.length, assignments_created: 0, total_matching_wines: totalWines };
  }

  return {
    suppliers_matched: matches.length,
    assignments_created: rows.length,
    total_matching_wines: totalWines,
  };
}
