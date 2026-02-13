import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

/**
 * GET /api/suppliers/[id]/quote-requests
 *
 * Lists quote requests assigned to this supplier via quote_request_assignments.
 * **ACCESS CONTROL:** Suppliers can ONLY see requests they have been assigned to.
 *
 * REQUIRES: User must be SELLER and owner of the supplier
 *
 * AUTO-STATUS UPDATE: When supplier lists, assignments are marked as VIEWED
 * (if status is still SENT).
 *
 * Query params:
 * - status: 'all' | 'active' | 'expired' (default: 'active')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   requests: Array<{
 *     id: string;
 *     restaurantId: string;
 *     restaurantName: string;
 *     fritext: string;
 *     budgetPerFlaska?: number;
 *     antalFlaskor?: number;
 *     leveransSenast?: string;
 *     leveransOrt?: string;  // Delivery city for shipping calculation
 *     specialkrav?: string[];
 *     createdAt: string;
 *     assignment: {
 *       id: string;
 *       status: string;
 *       matchScore: number;
 *       matchReasons: string[];
 *       sentAt: string;
 *       viewedAt?: string;
 *       expiresAt: string;
 *       isExpired: boolean;
 *     };
 *     myOfferCount: number;
 *     totalOfferCount: number;
 *   }>;
 *   total: number;
 *   hasMore: boolean;
 * }
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supplierId = params.id;

    // Auth check - verify user owns this supplier
    const userId = req.headers.get('x-user-id');
    const tenantId = req.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER and own this supplier (or ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);

    const statusFilter = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { adminClient } = await createRouteClients();

    // Verify supplier exists and is active
    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, is_active')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    if (!supplier.is_active) {
      return NextResponse.json(
        { error: 'Supplier is not active' },
        { status: 403 }
      );
    }

    // Step 1: Get assignments for this supplier
    let assignmentsQuery = adminClient
      .from('quote_request_assignments')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('sent_at', { ascending: false });

    // Filter by status
    if (statusFilter === 'active') {
      // Active = not expired
      assignmentsQuery = assignmentsQuery
        .in('status', ['SENT', 'VIEWED', 'RESPONDED'])
        .gt('expires_at', new Date().toISOString());
    } else if (statusFilter === 'expired') {
      // Expired = past expires_at or status EXPIRED
      assignmentsQuery = assignmentsQuery.eq('status', 'EXPIRED');
    }

    const { data: assignments, error: assignmentsError } = await assignmentsQuery
      .range(offset, offset + limit - 1);

    if (assignmentsError) {
      console.error('Failed to fetch assignments:', assignmentsError);
      return NextResponse.json(
        { error: 'Failed to fetch assignments', details: assignmentsError.message },
        { status: 500 }
      );
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({
        requests: [],
        total: 0,
        hasMore: false,
      });
    }

    // Step 2: Auto-update SENT → VIEWED for assignments
    const sentAssignmentIds = assignments
      .filter(a => a.status === 'SENT')
      .map(a => a.id);

    if (sentAssignmentIds.length > 0) {
      await adminClient
        .from('quote_request_assignments')
        .update({
          status: 'VIEWED',
          viewed_at: new Date().toISOString(),
        })
        .in('id', sentAssignmentIds);

      // Update local data to reflect change
      assignments.forEach(a => {
        if (a.status === 'SENT') {
          a.status = 'VIEWED';
          a.viewed_at = new Date().toISOString();
        }
      });
    }

    // Step 3: Get quote requests for these assignments
    const quoteRequestIds = assignments.map(a => a.quote_request_id);

    const { data: requests, error: requestsError } = await adminClient
      .from('requests')
      .select('*')
      .in('id', quoteRequestIds);

    if (requestsError) {
      console.error('Failed to fetch requests:', requestsError);
      return NextResponse.json(
        { error: 'Failed to fetch requests', details: requestsError.message },
        { status: 500 }
      );
    }

    // Step 4: Get restaurant names
    const restaurantIds = [...new Set(requests.map(r => r.restaurant_id))];
    const { data: restaurants } = await adminClient
      .from('restaurants')
      .select('id, name')
      .in('id', restaurantIds);

    const restaurantMap = new Map(
      (restaurants || []).map(r => [r.id, r.name])
    );

    // Step 5: Get offer counts
    const { data: totalOffers } = await adminClient
      .from('offers')
      .select('request_id, id')
      .in('request_id', quoteRequestIds);

    const totalOfferMap = new Map<string, number>();
    (totalOffers || []).forEach(offer => {
      const count = totalOfferMap.get(offer.request_id) || 0;
      totalOfferMap.set(offer.request_id, count + 1);
    });

    const { data: myOffers } = await adminClient
      .from('offers')
      .select('request_id, id')
      .in('request_id', quoteRequestIds)
      .eq('supplier_id', supplierId);

    const myOfferMap = new Map<string, number>();
    (myOffers || []).forEach(offer => {
      const count = myOfferMap.get(offer.request_id) || 0;
      myOfferMap.set(offer.request_id, count + 1);
    });

    // Step 5b: Get request items (wines) for this supplier
    const { data: requestItems } = await adminClient
      .from('request_items')
      .select('*')
      .in('request_id', quoteRequestIds)
      .eq('supplier_id', supplierId);

    const requestItemsMap = new Map<string, typeof requestItems>();
    (requestItems || []).forEach(item => {
      const existing = requestItemsMap.get(item.request_id) || [];
      existing.push(item);
      requestItemsMap.set(item.request_id, existing);
    });

    // Step 6: Combine data
    const assignmentMap = new Map(
      assignments.map(a => [a.quote_request_id, a])
    );

    const transformedRequests = requests.map(req => {
      const assignment = assignmentMap.get(req.id)!;
      const isExpired = new Date(assignment.expires_at) < new Date();

      // Get items for this request
      const items = requestItemsMap.get(req.id) || [];
      const hasProvorder = items.some(i => i.provorder);
      const provorderFeeTotal = items
        .filter(i => i.provorder)
        .reduce((sum, i) => sum + (i.provorder_fee || 500), 0);

      return {
        id: req.id,
        restaurantId: req.restaurant_id,
        restaurantName: restaurantMap.get(req.restaurant_id) || 'Okänd restaurang',
        fritext: req.fritext,
        budgetPerFlaska: req.budget_per_flaska,
        antalFlaskor: req.antal_flaskor,
        leveransSenast: req.leverans_senast,
        leveransOrt: req.leverans_ort, // Delivery city for shipping calculation
        specialkrav: req.specialkrav || [],
        createdAt: req.created_at,
        assignment: {
          id: assignment.id,
          status: assignment.status,
          matchScore: assignment.match_score,
          matchReasons: assignment.match_reasons || [],
          sentAt: assignment.sent_at,
          viewedAt: assignment.viewed_at,
          respondedAt: assignment.responded_at,
          expiresAt: assignment.expires_at,
          isExpired,
        },
        myOfferCount: myOfferMap.get(req.id) || 0,
        totalOfferCount: totalOfferMap.get(req.id) || 0,
        // Request items with provorder info
        items: items.map(i => ({
          id: i.id,
          wineId: i.wine_id,
          wineName: i.wine_name,
          producer: i.producer,
          country: i.country,
          region: i.region,
          vintage: i.vintage,
          color: i.color,
          quantity: i.quantity,
          priceSek: i.price_sek ? Math.round(i.price_sek / 100) : null, // Convert from öre
          moq: i.moq,
          provorder: i.provorder || false,
          provorderFee: i.provorder_fee,
        })),
        hasProvorder,
        provorderFeeTotal,
      };
    });

    // Step 7: Get total count for pagination
    const { count: totalCount } = await adminClient
      .from('quote_request_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId);

    return NextResponse.json({
      requests: transformedRequests,
      total: totalCount || 0,
      hasMore: (offset + limit) < (totalCount || 0),
    });

  } catch (error: any) {
    console.error('Quote requests listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
