/**
 * IOR DASHBOARD API
 *
 * GET /api/ior/dashboard - Get complete dashboard data for Netflix-style UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const dashboard = await iorPortfolioService.getDashboard(guard.ctx);

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('[API] GET /api/ior/dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
