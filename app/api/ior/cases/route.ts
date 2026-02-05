/**
 * IOR CASES API
 *
 * GET /api/ior/cases - List cases with filters
 *   Query params: page, pageSize, status, priority, producerId, q
 * POST /api/ior/cases - Create new case
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
    dueAt: c.due_at,
    isOverdue: c.is_overdue,
    lastMessageAt: c.last_message_at,
    messageCount: c.message_count ?? 0,
    createdAt: c.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Filters
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const producerId = searchParams.get('producerId') || searchParams.get('producer') || undefined;
    const overdueOnly = searchParams.get('overdue') === 'true';
    const actionRequired = searchParams.get('action_required') === 'true';

    // Search (q) - TODO: implement in service layer if needed
    // const search = searchParams.get('q') || undefined;

    const result = await iorPortfolioService.listCases(
      guard.ctx,
      {
        status,
        priority,
        producer_id: producerId,
        overdue_only: overdueOnly,
        action_required: actionRequired,
      },
      { page, pageSize }
    );

    // Transform to camelCase for UI
    return NextResponse.json({
      items: result.items.map(c => transformCase(c as unknown as Record<string, unknown>)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    console.error('[API] GET /api/ior/cases error:', error);
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

    if (!body.producer_id || typeof body.producer_id !== 'string') {
      return NextResponse.json({ error: 'Missing required field: producer_id' }, { status: 400 });
    }

    if (!body.subject || typeof body.subject !== 'string') {
      return NextResponse.json({ error: 'Missing required field: subject' }, { status: 400 });
    }

    const caseData = await iorPortfolioService.createCase(guard.ctx, {
      producer_id: body.producer_id,
      subject: body.subject,
      category: body.category,
      priority: body.priority,
      due_at: body.due_at,
    });

    return NextResponse.json({ case: caseData }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/ior/cases error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
