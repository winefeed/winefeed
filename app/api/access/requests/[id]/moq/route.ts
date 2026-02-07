/**
 * MOQ HELPER API - Get Status & Suggestions
 *
 * GET /api/access/requests/[id]/moq
 *
 * Returns MOQ status and fill-up suggestions for an accepted request.
 * Feature flag: FEATURE_MOQ_HELPER (default: false)
 *
 * NO CART, NO CHECKOUT, NO PAYMENT:
 * - indicative_price_sek is for display only
 * - No totals calculated
 * - This endpoint is read-only
 */

import { NextRequest, NextResponse } from 'next/server';
import { moqHelperService } from '@/lib/moq-helper-service';
import { isMOQHelperEnabled, logMOQEventSchema } from '@/lib/moq-helper-types';
import { verifyAuthToken } from '@/lib/access-auth';

// ============================================
// GET - MOQ Status & Suggestions
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Feature flag check
  if (!isMOQHelperEnabled()) {
    return NextResponse.json(
      { error: 'MOQ Helper feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { id: requestId } = await params;

    // Auth check
    // For consumer access, we'd typically use a session cookie or token
    // Using access_admin_token for now (can be replaced with consumer auth)
    const authToken = request.cookies.get('access_consumer_token')?.value
      || request.cookies.get('access_admin_token')?.value;

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get MOQ helper data
    const result = await moqHelperService.getMOQHelper(
      { userId: auth.subjectId },
      requestId
    );

    if (!result) {
      // Returns null for: not found, not owned, not accepted, no MOQ
      return NextResponse.json(
        { error: 'MOQ helper not available for this request' },
        { status: 404 }
      );
    }

    // Log banner shown event
    await moqHelperService.logEvent(requestId, auth.subjectId, 'BANNER_SHOWN', {
      moq: result.status.moq_bottles,
      current: result.status.current_bottles,
      deficit: result.status.deficit,
    });

    if (result.suggestions.length > 0) {
      await moqHelperService.logEvent(requestId, auth.subjectId, 'SUGGESTIONS_SHOWN', {
        suggestion_ids: result.suggestions.map(s => s.lot_id),
        count: result.suggestions.length,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] GET /api/access/requests/[id]/moq error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Log Event (for client-side tracking)
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Feature flag check
  if (!isMOQHelperEnabled()) {
    return NextResponse.json(
      { error: 'MOQ Helper feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { id: requestId } = await params;

    // Auth check
    const authToken = request.cookies.get('access_consumer_token')?.value
      || request.cookies.get('access_admin_token')?.value;

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const parseResult = logMOQEventSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid event data' },
        { status: 400 }
      );
    }

    // Log the event
    await moqHelperService.logEvent(
      requestId,
      auth.subjectId,
      parseResult.data.event_type,
      parseResult.data.payload
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] POST /api/access/requests/[id]/moq error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
