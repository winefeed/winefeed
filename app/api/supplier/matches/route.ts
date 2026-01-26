/**
 * SUPPLIER WINE MATCHING API
 *
 * GET /api/supplier/matches - Get matching wines for requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { getMatchingWines } from '@/lib/notifications-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier linked to user' },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestId = searchParams.get('request_id');

    if (requestId) {
      // Get specific request and find matching wines
      const { data: req } = await supabase
        .from('requests')
        .select('id, fritext, vin_typ, land, region, budget_per_flaska')
        .eq('id', requestId)
        .single();

      if (!req) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      const matches = await getMatchingWines(
        actor.supplier_id,
        req.fritext || '',
        {
          color: req.vin_typ,
          country: req.land,
          region: req.region,
          max_price: req.budget_per_flaska,
        }
      );

      return NextResponse.json({
        request: req,
        matches,
      });
    }

    // Get all pending requests with potential matches
    const now = new Date().toISOString();
    const { data: pendingRequests } = await supabase
      .from('requests')
      .select(`
        id,
        fritext,
        vin_typ,
        land,
        region,
        budget_per_flaska,
        deadline,
        restaurants!inner(name)
      `)
      .is('deleted_at', null)
      .gte('deadline', now)
      .order('deadline', { ascending: true })
      .limit(10);

    // Get existing offers from this supplier
    const { data: supplierOffers } = await supabase
      .from('offers')
      .select('request_id')
      .eq('supplier_id', actor.supplier_id);

    const respondedIds = new Set(supplierOffers?.map(o => o.request_id) || []);

    // Filter to unresponded requests and find matches
    const requestsWithMatches = [];

    for (const req of pendingRequests || []) {
      if (respondedIds.has(req.id)) continue;

      const matches = await getMatchingWines(
        actor.supplier_id,
        req.fritext || '',
        {
          color: req.vin_typ,
          country: req.land,
          region: req.region,
          max_price: req.budget_per_flaska,
        }
      );

      if (matches.length > 0) {
        requestsWithMatches.push({
          request: {
            id: req.id,
            text: req.fritext,
            restaurant: (req.restaurants as any)?.name,
            deadline: req.deadline,
            filters: {
              color: req.vin_typ,
              country: req.land,
              region: req.region,
              budget: req.budget_per_flaska,
            },
          },
          matches: matches.slice(0, 3), // Top 3 matches per request
          total_matches: matches.length,
        });
      }
    }

    return NextResponse.json({
      requests_with_matches: requestsWithMatches,
      total: requestsWithMatches.length,
    });
  } catch (error: any) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
