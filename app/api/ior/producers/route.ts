/**
 * IOR PRODUCERS API
 *
 * GET /api/ior/producers - List all producers
 * POST /api/ior/producers - Create new producer
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('include_stats') === 'true';
    const activeOnly = searchParams.get('active_only') === 'true';

    const producers = await iorPortfolioService.listProducers(guard.ctx, { includeStats, activeOnly });

    return NextResponse.json({ producers });
  } catch (error) {
    console.error('[API] GET /api/ior/producers error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    if (!body.country || typeof body.country !== 'string') {
      return NextResponse.json({ error: 'Missing required field: country' }, { status: 400 });
    }

    const producer = await iorPortfolioService.createProducer(guard.ctx, body);

    return NextResponse.json({ producer }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/ior/producers error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
