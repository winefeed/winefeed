/**
 * POST /api/admin/growth/resolve-links
 *
 * Resolves restaurant_leads.restaurant_id by matching contact_email
 * against restaurants.contact_email (case-insensitive). Only touches
 * rows where restaurant_id is currently NULL, so repeated calls are
 * idempotent and cheap.
 *
 * Returns { matched, scanned }.
 *
 * Security: ADMIN role required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Access denied: ADMIN role required' }, { status: 403 });
    }

    // Pull unlinked leads that have an email
    const { data: leads, error: leadsErr } = await supabase
      .from('restaurant_leads')
      .select('id, contact_email')
      .is('restaurant_id', null)
      .not('contact_email', 'is', null);

    if (leadsErr) {
      return NextResponse.json({ error: 'Failed to load leads', details: leadsErr.message }, { status: 500 });
    }
    if (!leads || leads.length === 0) {
      return NextResponse.json({ matched: 0, scanned: 0 });
    }

    const emails = [...new Set(leads.map(l => (l.contact_email || '').toLowerCase().trim()).filter(Boolean))];

    // Fetch all matching restaurants once
    const { data: restaurants, error: restErr } = await supabase
      .from('restaurants')
      .select('id, contact_email')
      .in('contact_email', emails);

    if (restErr) {
      return NextResponse.json({ error: 'Failed to load restaurants', details: restErr.message }, { status: 500 });
    }

    const emailToRestaurant = new Map<string, string>();
    for (const r of restaurants || []) {
      const e = (r.contact_email || '').toLowerCase().trim();
      if (e) emailToRestaurant.set(e, r.id);
    }

    let matched = 0;
    for (const lead of leads) {
      const e = (lead.contact_email || '').toLowerCase().trim();
      const restaurantId = emailToRestaurant.get(e);
      if (!restaurantId) continue;

      const { error } = await supabase
        .from('restaurant_leads')
        .update({ restaurant_id: restaurantId })
        .eq('id', lead.id);
      if (!error) matched++;
    }

    return NextResponse.json({ matched, scanned: leads.length });
  } catch (error: any) {
    console.error('resolve-links failed:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
