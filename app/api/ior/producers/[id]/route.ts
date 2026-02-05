/**
 * IOR PRODUCER DETAIL API
 *
 * GET /api/ior/producers/[id] - Get producer details
 * PATCH /api/ior/producers/[id] - Update producer
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const producer = await iorPortfolioService.getProducer(guard.ctx, producerId);

    if (!producer) {
      return NextResponse.json({ error: 'Producer not found' }, { status: 404 });
    }

    return NextResponse.json({ producer });
  } catch (error) {
    console.error('[API] GET /api/ior/producers/[id] error:', error);
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
    const { id: producerId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();
    const producer = await iorPortfolioService.updateProducer(guard.ctx, producerId, body);

    return NextResponse.json({ producer });
  } catch (error) {
    console.error('[API] PATCH /api/ior/producers/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
