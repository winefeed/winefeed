import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { QuoteRequestRouter } from '@/lib/quote-request-router';
import { actorService } from '@/lib/actor-service';

/**
 * POST /api/quote-requests/[id]/dispatch
 *
 * Dispatches a quote request to matched suppliers by creating assignments.
 *
 * Request body:
 * {
 *   maxMatches?: number;      // Default: 10 (top N suppliers)
 *   minScore?: number;        // Default: 20 (0-100)
 *   expiresInHours?: number;  // Default: 48 hours
 * }
 *
 * Response:
 * {
 *   quoteRequestId: string;
 *   assignmentsCreated: number;
 *   matches: Array<{
 *     supplierId: string;
 *     supplierName: string;
 *     matchScore: number;
 *     matchReasons: string[];
 *     assignmentId: string;
 *   }>;
 *   expiresAt: string;
 * }
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const quoteRequestId = params.id;

    // Auth check
    const userId = req.headers.get('x-user-id');
    const tenantId = req.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be RESTAURANT owner or ADMIN to dispatch
    if (!actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const maxMatches = body.maxMatches || 10;
    const minScore = body.minScore || 20;
    const expiresInHours = body.expiresInHours || 48;

    const { adminClient } = await createRouteClients();

    // Step 1: Verify quote request exists
    const { data: quoteRequest, error: requestError } = await adminClient
      .from('requests')
      .select('*')
      .eq('id', quoteRequestId)
      .single();

    if (requestError || !quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Verify ownership - request must belong to user's restaurant (unless ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') && quoteRequest.restaurant_id !== actor.restaurant_id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Step 2: Check if already dispatched
    const { data: existingAssignments } = await adminClient
      .from('quote_request_assignments')
      .select('id')
      .eq('quote_request_id', quoteRequestId);

    if (existingAssignments && existingAssignments.length > 0) {
      return NextResponse.json(
        {
          error: 'Quote request already dispatched',
          existingAssignments: existingAssignments.length,
          hint: 'To re-dispatch, first delete existing assignments or use a different endpoint',
        },
        { status: 409 }
      );
    }

    // Step 3: Run routing algorithm
    const routingResult = await QuoteRequestRouter.routeQuoteRequest(
      {
        id: quoteRequest.id,
        fritext: quoteRequest.fritext,
        budget_per_flaska: quoteRequest.budget_per_flaska,
        antal_flaskor: quoteRequest.antal_flaskor,
        leverans_senast: quoteRequest.leverans_senast,
        specialkrav: quoteRequest.specialkrav,
      },
      { maxMatches, minScore }
    );

    if (routingResult.matches.length === 0) {
      return NextResponse.json(
        {
          error: 'No suitable suppliers found',
          totalSuppliersEvaluated: routingResult.totalSuppliersEvaluated,
          hint: 'Try lowering minScore or check if suppliers have active catalogs',
        },
        { status: 404 }
      );
    }

    // Step 4: Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Step 5: Create assignments for matched suppliers
    const assignmentsToCreate = routingResult.matches.map(match => ({
      quote_request_id: quoteRequestId,
      supplier_id: match.supplierId,
      status: 'SENT',
      match_score: match.matchScore,
      match_reasons: match.matchReasons,
      sent_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }));

    const { data: createdAssignments, error: assignmentError } = await adminClient
      .from('quote_request_assignments')
      .insert(assignmentsToCreate)
      .select('id, supplier_id, match_score, match_reasons');

    if (assignmentError) {
      console.error('Failed to create assignments:', assignmentError);
      return NextResponse.json(
        { error: 'Failed to create assignments', details: assignmentError.message },
        { status: 500 }
      );
    }

    // Step 6: Build response with assignment IDs
    const responseMatches = routingResult.matches.map((match, index) => ({
      supplierId: match.supplierId,
      supplierName: match.supplierName,
      matchScore: match.matchScore,
      matchReasons: match.matchReasons,
      catalogSize: match.catalogSize,
      assignmentId: createdAssignments![index].id,
    }));

    // TODO: Step 7: Send notifications to suppliers (email, push, etc.)
    // For MVP, suppliers will see assignments when they list quote requests

    return NextResponse.json(
      {
        quoteRequestId,
        assignmentsCreated: createdAssignments!.length,
        matches: responseMatches,
        expiresAt: expiresAt.toISOString(),
        routingTimestamp: routingResult.routingTimestamp,
        message: `Dispatched to ${createdAssignments!.length} suppliers`,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Dispatch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quote-requests/[id]/dispatch
 *
 * Gets dispatch status for a quote request (preview only, no actual dispatch).
 *
 * Query params:
 * - preview: true (optional, shows what would be matched without creating assignments)
 *
 * Response:
 * {
 *   dispatched: boolean;
 *   assignmentsCount?: number;
 *   preview?: {
 *     potentialMatches: SupplierMatch[];
 *     totalSuppliersEvaluated: number;
 *   }
 * }
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const quoteRequestId = params.id;

    // Auth check
    const userId = req.headers.get('x-user-id');
    const tenantId = req.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    const { searchParams } = new URL(req.url);
    const preview = searchParams.get('preview') === 'true';

    const { adminClient } = await createRouteClients();

    // Check if quote request exists
    const { data: quoteRequest, error: requestError } = await adminClient
      .from('requests')
      .select('*')
      .eq('id', quoteRequestId)
      .single();

    if (requestError || !quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Verify ownership - request must belong to user's restaurant (unless ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') && quoteRequest.restaurant_id !== actor.restaurant_id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check existing assignments
    const { data: assignments } = await adminClient
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', quoteRequestId);

    const dispatched = assignments && assignments.length > 0;

    // If preview requested, run routing without creating assignments
    if (preview) {
      const routingResult = await QuoteRequestRouter.routeQuoteRequest(
        {
          id: quoteRequest.id,
          fritext: quoteRequest.fritext,
          budget_per_flaska: quoteRequest.budget_per_flaska,
          antal_flaskor: quoteRequest.antal_flaskor,
          leverans_senast: quoteRequest.leverans_senast,
          specialkrav: quoteRequest.specialkrav,
        },
        { maxMatches: 10, minScore: 20 }
      );

      return NextResponse.json({
        dispatched,
        assignmentsCount: assignments?.length || 0,
        preview: {
          potentialMatches: routingResult.matches,
          totalSuppliersEvaluated: routingResult.totalSuppliersEvaluated,
        },
      });
    }

    // No preview, just return status
    return NextResponse.json({
      dispatched,
      assignmentsCount: assignments?.length || 0,
      assignments: dispatched
        ? assignments.map(a => ({
            id: a.id,
            supplierId: a.supplier_id,
            status: a.status,
            matchScore: a.match_score,
            sentAt: a.sent_at,
            expiresAt: a.expires_at,
          }))
        : undefined,
    });

  } catch (error: any) {
    console.error('Dispatch status error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
