/**
 * ADMIN GROWTH PIPELINE API
 *
 * GET /api/admin/growth
 *
 * List restaurant leads with optional filters
 *
 * Query Parameters:
 * - status: Filter by lead status
 * - source: Filter by lead source
 * - city: Filter by city
 *
 * Security:
 * - Requires ADMIN role via actorService
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
      { leads: leads || [], stats },
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
