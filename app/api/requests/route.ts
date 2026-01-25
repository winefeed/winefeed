/**
 * REQUESTS API - LIST ENDPOINT
 *
 * GET /api/requests
 *
 * Lists quote requests
 * - RESTAURANT users see their own requests
 * - SELLER users see requests they're assigned to
 * - ADMIN users see all requests
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
 * - Role-based filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'OPEN';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Role-based access control
    let requestIds: string[] | null = null;

    if (actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      // Restaurant users only see their own requests - filter by restaurant_id
      const { data: requests } = await supabase
        .from('requests')
        .select('id')
        .eq('restaurant_id', actor.restaurant_id);
      requestIds = requests?.map(r => r.id) || [];
    } else if (actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      // Sellers only see requests they're assigned to
      const { data: assignments } = await supabase
        .from('quote_request_assignments')
        .select('quote_request_id')
        .eq('supplier_id', actor.supplier_id);
      requestIds = assignments?.map(a => a.quote_request_id) || [];
    }
    // ADMIN sees all requests (requestIds remains null)

    let query = supabase
      .from('requests')
      .select('id, restaurant_id, fritext, budget_per_flaska, antal_flaskor, leverans_senast, specialkrav, status, accepted_offer_id, created_at');

    // Apply role-based filter if needed
    if (requestIds !== null) {
      if (requestIds.length === 0) {
        // No requests to show
        return NextResponse.json({ requests: [] }, { status: 200 });
      }
      query = query.in('id', requestIds);
    }

    // Filter by status if provided and not empty
    if (status && status.trim() !== '') {
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

    // Get offers count per request with timestamps (in separate query for performance)
    const fetchedRequestIds = requests?.map(r => r.id) || [];
    let offersCountMap: Record<string, number> = {};
    let newOffersCountMap: Record<string, number> = {};
    let latestOfferMap: Record<string, string> = {};

    if (fetchedRequestIds.length > 0) {
      const { data: offers } = await supabase
        .from('offers')
        .select('request_id, status, created_at')
        .in('request_id', fetchedRequestIds)
        .order('created_at', { ascending: false });

      if (offers) {
        offers.forEach(offer => {
          // Count total offers per request
          offersCountMap[offer.request_id] = (offersCountMap[offer.request_id] || 0) + 1;

          // Count new offers (SENT status = not viewed by restaurant)
          if (offer.status === 'SENT') {
            newOffersCountMap[offer.request_id] = (newOffersCountMap[offer.request_id] || 0) + 1;
          }

          // Track latest offer timestamp
          if (!latestOfferMap[offer.request_id]) {
            latestOfferMap[offer.request_id] = offer.created_at;
          }
        });
      }
    }

    // Get dispatch tracking data (quote_request_assignments)
    interface TrackingData {
      dispatched_to: number;
      viewed_by: number;
      responded_by: number;
      dispatched_at: string | null;
      expires_at: string | null;
    }
    let trackingMap: Record<string, TrackingData> = {};

    if (fetchedRequestIds.length > 0) {
      const { data: assignments } = await supabase
        .from('quote_request_assignments')
        .select('quote_request_id, status, sent_at, expires_at')
        .in('quote_request_id', fetchedRequestIds);

      if (assignments) {
        assignments.forEach(assignment => {
          const reqId = assignment.quote_request_id;
          if (!trackingMap[reqId]) {
            trackingMap[reqId] = {
              dispatched_to: 0,
              viewed_by: 0,
              responded_by: 0,
              dispatched_at: assignment.sent_at,
              expires_at: assignment.expires_at
            };
          }

          trackingMap[reqId].dispatched_to++;

          // Track viewed (VIEWED or RESPONDED status)
          if (assignment.status === 'VIEWED' || assignment.status === 'RESPONDED') {
            trackingMap[reqId].viewed_by++;
          }

          // Track responded
          if (assignment.status === 'RESPONDED') {
            trackingMap[reqId].responded_by++;
          }

          // Use earliest sent_at as dispatched_at
          if (assignment.sent_at && (!trackingMap[reqId].dispatched_at || assignment.sent_at < trackingMap[reqId].dispatched_at!)) {
            trackingMap[reqId].dispatched_at = assignment.sent_at;
          }
        });
      }
    }

    // Map Swedish column names to English API response format
    const requestsWithCounts = (requests || []).map(req => {
      const tracking = trackingMap[req.id];
      return {
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
        offers_count: offersCountMap[req.id] || 0,
        new_offers_count: newOffersCountMap[req.id] || 0,
        latest_offer_at: latestOfferMap[req.id] || null,
        // Area A: Request tracking data
        tracking: tracking ? {
          dispatched_to: tracking.dispatched_to,
          viewed_by: tracking.viewed_by,
          responded_by: tracking.responded_by,
          dispatched_at: tracking.dispatched_at,
          expires_at: tracking.expires_at
        } : null
      };
    });

    return NextResponse.json({ requests: requestsWithCounts }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
