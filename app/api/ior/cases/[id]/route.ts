/**
 * IOR CASE DETAIL API
 *
 * GET /api/ior/cases/[id] - Get case with messages and thread token
 * PATCH /api/ior/cases/[id] - Update case (status, priority)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const result = await iorPortfolioService.getCase(guard.ctx, caseId);

    if (!result) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] GET /api/ior/cases/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();

    // Only allow updating status for now
    if (!body.status) {
      return NextResponse.json({ error: 'Missing field: status' }, { status: 400 });
    }

    const validStatuses = ['OPEN', 'WAITING_PRODUCER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const caseData = await iorPortfolioService.updateCaseStatus(guard.ctx, caseId, body.status);

    return NextResponse.json({ case: caseData });
  } catch (error) {
    console.error('[API] PATCH /api/ior/cases/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
