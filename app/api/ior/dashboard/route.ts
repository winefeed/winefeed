/**
 * IOR DASHBOARD API
 *
 * GET /api/ior/dashboard - Get complete dashboard data for Netflix-style UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

// Transform snake_case case to camelCase for UI
function transformCase(c: Record<string, unknown>) {
  const producer = c.producer as Record<string, unknown> | undefined;
  return {
    id: c.id,
    subject: c.subject,
    category: c.category,
    status: c.status,
    priority: c.priority,
    producerId: c.producer_id,
    producerName: producer?.name || '',
    producerCountry: producer?.country,
    dueAt: c.due_at,
    isOverdue: c.is_overdue,
    createdAt: c.created_at,
  };
}

// Transform snake_case producer to camelCase for UI
function transformProducer(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    country: p.country,
    region: p.region,
    logoUrl: p.logo_url,
    productCount: p.product_count ?? 0,
    openCasesCount: p.open_cases_count ?? 0,
    overdueCasesCount: p.overdue_cases_count ?? 0,
    isActive: p.is_active,
    lastActivityAt: p.last_activity_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const dashboard = await iorPortfolioService.getDashboard(guard.ctx);

    // Transform to camelCase for UI
    return NextResponse.json({
      actionRequiredCases: dashboard.actionRequiredCases.map(c => transformCase(c as unknown as Record<string, unknown>)),
      producers: dashboard.producers.map(p => transformProducer(p as unknown as Record<string, unknown>)),
      stats: {
        totalProducers: dashboard.stats.total_producers,
        activeProducers: dashboard.stats.active_producers,
        totalProducts: dashboard.stats.total_products,
        activeProducts: dashboard.stats.active_products,
        activePriceLists: dashboard.pricingSummary.active_price_lists,
        pendingPriceLists: 0, // TODO: add draft count
        openCases: dashboard.stats.open_cases,
        overdueCases: dashboard.stats.overdue_cases,
      },
    });
  } catch (error) {
    console.error('[API] GET /api/ior/dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
