import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/suppliers/[id]/quote-requests
 *
 * Lists quote requests assigned to this supplier via quote_request_assignments.
 * **ACCESS CONTROL:** Suppliers can ONLY see requests they have been assigned to.
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
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const { searchParams } = new URL(req.url);

    const statusFilter = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify supplier exists and is active
    const { data: supplier, error: supplierError } = await supabase
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
    let assignmentsQuery = supabase
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
      await supabase
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

    const { data: requests, error: requestsError } = await supabase
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
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name')
      .in('id', restaurantIds);

    const restaurantMap = new Map(
      (restaurants || []).map(r => [r.id, r.name])
    );

    // Step 5: Get offer counts
    const { data: totalOffers } = await supabase
      .from('offers')
      .select('request_id, id')
      .in('request_id', quoteRequestIds);

    const totalOfferMap = new Map<string, number>();
    (totalOffers || []).forEach(offer => {
      const count = totalOfferMap.get(offer.request_id) || 0;
      totalOfferMap.set(offer.request_id, count + 1);
    });

    const { data: myOffers } = await supabase
      .from('offers')
      .select('request_id, id')
      .in('request_id', quoteRequestIds)
      .eq('supplier_id', supplierId);

    const myOfferMap = new Map<string, number>();
    (myOffers || []).forEach(offer => {
      const count = myOfferMap.get(offer.request_id) || 0;
      myOfferMap.set(offer.request_id, count + 1);
    });

    // Step 6: Combine data
    const assignmentMap = new Map(
      assignments.map(a => [a.quote_request_id, a])
    );

    const transformedRequests = requests.map(req => {
      const assignment = assignmentMap.get(req.id)!;
      const isExpired = new Date(assignment.expires_at) < new Date();

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
      };
    });

    // Step 7: Get total count for pagination
    const { count: totalCount } = await supabase
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
