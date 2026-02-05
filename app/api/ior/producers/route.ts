/**
 * IOR PRODUCERS API
 *
 * GET /api/ior/producers - List all producers
 * POST /api/ior/producers - Create new producer
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

// Transform snake_case producer to camelCase for UI
function transformProducer(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    country: p.country,
    region: p.region,
    logoUrl: p.logo_url,
    contactName: p.contact_name,
    contactEmail: p.contact_email,
    productCount: p.product_count ?? p.productCount ?? 0,
    openCasesCount: p.open_cases_count ?? p.openCasesCount ?? 0,
    overdueCasesCount: p.overdue_cases_count ?? p.overdueCasesCount ?? 0,
    isActive: p.is_active,
    onboardedAt: p.onboarded_at,
    lastActivityAt: p.last_activity_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const q = searchParams.get('q') || undefined;
    const country = searchParams.get('country') || undefined;
    const includeInactive = searchParams.get('inactive') === 'true';

    const result = await iorPortfolioService.listProducers(guard.ctx, {
      page,
      pageSize,
      search: q,
      country,
      includeInactive,
    });

    // Transform to camelCase for UI
    return NextResponse.json({
      items: result.items.map(p => transformProducer(p as unknown as Record<string, unknown>)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
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
