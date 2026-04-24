/**
 * ADMIN GROWTH PIPELINE API
 *
 * GET  /api/admin/growth  — list leads (with filters)
 * POST /api/admin/growth  — create new lead
 *
 * Security: ADMIN role required (actorService).
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId,
    });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Access denied: ADMIN role required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const source = searchParams.get('source') || undefined;
    const city = searchParams.get('city') || undefined;
    const leadType = searchParams.get('lead_type') || undefined;

    let query = supabase
      .from('restaurant_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (leadType) {
      query = query.eq('lead_type', leadType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (source) {
      query = query.eq('source', source);
    }
    if (city) {
      query = query.ilike('city', city);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    // Look up last_sign_in_at for leads with contact_email
    const emailsToLookup = (leads || [])
      .map((l: any) => l.contact_email)
      .filter(Boolean) as string[];

    const lastSignInMap: Record<string, string | null> = {};

    if (emailsToLookup.length > 0) {
      try {
        const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        for (const user of users || []) {
          if (user.email && emailsToLookup.includes(user.email)) {
            lastSignInMap[user.email] = user.last_sign_in_at || null;
          }
        }
      } catch (authErr) {
        console.warn('Could not fetch auth users for last_sign_in:', authErr);
      }
    }

    // Attach last_sign_in_at to leads
    const enrichedLeads = (leads || []).map((lead: any) => ({
      ...lead,
      last_sign_in_at: lead.contact_email ? lastSignInMap[lead.contact_email] || null : null,
    }));

    // Compute stats from leads matching lead_type filter
    let statsQuery = supabase
      .from('restaurant_leads')
      .select('status');
    if (leadType) {
      statsQuery = statsQuery.eq('lead_type', leadType);
    }
    const { data: allLeads, error: allError } = await statsQuery;

    if (allError) {
      throw new Error(`Failed to fetch stats: ${allError.message}`);
    }

    const stats = {
      identified: 0,
      researched: 0,
      outreach_drafted: 0,
      contacted: 0,
      responded: 0,
      meeting_booked: 0,
      onboarded: 0,
      rejected: 0,
      paused: 0,
      total: allLeads?.length || 0,
    };

    for (const lead of allLeads || []) {
      const s = lead.status as keyof typeof stats;
      if (s in stats) {
        stats[s]++;
      }
    }

    return NextResponse.json(
      { leads: enrichedLeads, stats },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching growth pipeline:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/growth — create a new lead.
 *
 * Body: partial restaurant_leads row. Required: name. Everything else optional.
 * Returns the inserted row.
 */
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

    const body = await request.json();
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Whitelist writable columns — never trust arbitrary body keys.
    const WRITABLE = [
      'name', 'city', 'restaurant_type', 'website', 'instagram',
      'contact_name', 'contact_role', 'contact_email', 'contact_phone', 'contact_linkedin',
      'wine_focus_score', 'pilot_fit_score',
      'wine_focus_notes', 'wine_match_notes', 'outreach_angle', 'outreach_draft',
      'status', 'source', 'lead_type', 'notes',
      'next_action', 'next_action_date', 'last_contact_at',
      'signal_type', 'signal_date', 'signal_context',
    ] as const;

    const insert: Record<string, unknown> = {};
    for (const key of WRITABLE) {
      if (key in body && body[key] !== undefined) insert[key] = body[key];
    }
    insert.status = insert.status || 'identified';
    insert.lead_type = insert.lead_type || 'restaurant';

    const { data, error } = await supabase
      .from('restaurant_leads')
      .insert(insert)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to insert lead:', error);
      return NextResponse.json({ error: 'Insert failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead: data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
