/**
 * REQUESTS API - LIST ENDPOINT
 *
 * GET /api/requests
 *
 * Lists quote requests for supplier view (OPEN first)
 *
 * Query params:
 * - status: Filter by status (default: OPEN)
 * - limit: Max results (default: 50)
 *
 * Response:
 * {
 *   requests: [{
 *     id, restaurant_id, title, freetext, budget_sek, quantity_bottles,
 *     delivery_date_requested, status, accepted_offer_id,
 *     offers_count, created_at
 *   }]
 * }
 *
 * Security:
 * - Tenant isolation enforced
 * - Supplier sees all OPEN requests in tenant (marketplace view)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'OPEN';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // SECURITY: Tenant-scope via restaurants.tenant_id JOIN
    // Step 1: Get restaurant_ids for this tenant
    const { data: tenantRestaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('tenant_id', tenantId);

    if (restaurantsError) {
      throw new Error(`Failed to fetch tenant restaurants: ${restaurantsError.message}`);
    }

    const tenantRestaurantIds = tenantRestaurants?.map(r => r.id) || [];

    if (tenantRestaurantIds.length === 0) {
      // No restaurants in this tenant - return empty list
      return NextResponse.json({ requests: [] }, { status: 200 });
    }

    // Step 2: Build query - using actual schema column names (Swedish)
    // Filter by tenant via restaurant_id IN (tenant's restaurants)
    let query = supabase
      .from('requests')
      .select('id, restaurant_id, fritext, budget_per_flaska, antal_flaskor, leverans_senast, specialkrav, status, accepted_offer_id, created_at')
      .in('restaurant_id', tenantRestaurantIds);

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Order: OPEN first, then by created_at DESC
    query = query.order('status', { ascending: true });
    query = query.order('created_at', { ascending: false });
    query = query.limit(limit);

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      throw new Error(`Failed to fetch requests: ${requestsError.message}`);
    }

    // Get offers count per request (in separate query for performance)
    const requestIds = requests?.map(r => r.id) || [];
    let offersCountMap: Record<string, number> = {};

    if (requestIds.length > 0) {
      // SECURITY: Filter offers by tenant_id to prevent cross-tenant data leakage
      // requests table doesn't have tenant_id, but offers table does
      const { data: offerCounts } = await supabase
        .from('offers')
        .select('request_id')
        .eq('tenant_id', tenantId)
        .in('request_id', requestIds);

      if (offerCounts) {
        offersCountMap = offerCounts.reduce((acc, row) => {
          acc[row.request_id] = (acc[row.request_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Map Swedish column names to English API response format
    const requestsWithCounts = (requests || []).map(req => ({
      id: req.id,
      restaurant_id: req.restaurant_id,
      title: null, // Not in schema
      freetext: req.fritext || null,
      budget_sek: req.budget_per_flaska || null,
      quantity_bottles: req.antal_flaskor || null,
      delivery_date_requested: req.leverans_senast || null,
      specialkrav: req.specialkrav || null,
      status: req.status || 'OPEN',
      accepted_offer_id: req.accepted_offer_id || null,
      created_at: req.created_at,
      offers_count: offersCountMap[req.id] || 0
    }));

    return NextResponse.json({ requests: requestsWithCounts }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
