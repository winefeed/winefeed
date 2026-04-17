/**
 * ADMIN — Preview fan-out for an open broadcast request (no side effects)
 *
 * GET /api/admin/requests/[id]/preview
 *
 * Returns the list of suppliers who would receive the broadcast if the
 * admin approves it now, without creating any assignments or sending
 * any emails. Used by the admin queue to show "X leverantörer kommer
 * få detta mail (..., ..., ...)" before flipping the switch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { findMatchingSuppliers, type OpenCriteria } from '@/lib/matching-agent/open-request-fanout';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = _request.headers.get('x-user-id');
    const tenantId = _request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { data: req, error } = await supabase
      .from('requests')
      .select('id, request_type, status, open_criteria')
      .eq('id', params.id)
      .single();

    if (error || !req || req.request_type !== 'open') {
      return NextResponse.json({ error: 'Open request not found' }, { status: 404 });
    }

    const matches = await findMatchingSuppliers(req.open_criteria as OpenCriteria);

    if (matches.length === 0) {
      return NextResponse.json({ suppliers: [], total_matching_wines: 0 });
    }

    const supplierIds = matches.map(m => m.supplier_id);
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, namn, kontakt_email')
      .in('id', supplierIds);

    const sMap = new Map((suppliers || []).map(s => [s.id, s]));

    const enriched = matches.map(m => ({
      supplier_id: m.supplier_id,
      name: sMap.get(m.supplier_id)?.namn || 'Okänd leverantör',
      email: sMap.get(m.supplier_id)?.kontakt_email || null,
      match_count: m.match_count,
      match_source: m.match_source,
    }));

    return NextResponse.json({
      suppliers: enriched,
      total_matching_wines: matches.reduce((sum, m) => sum + m.match_count, 0),
    });
  } catch (err: any) {
    console.error('GET /api/admin/requests/[id]/preview error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
