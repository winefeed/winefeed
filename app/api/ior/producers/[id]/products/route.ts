/**
 * IOR PRODUCER PRODUCTS API
 *
 * GET /api/ior/producers/[id]/products - List products with pagination
 *   Query params: page, pageSize, q, status (active/inactive), sort (name/vintage/created_at)
 * POST /api/ior/producers/[id]/products - Create new product
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

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Filters
    const search = searchParams.get('q') || undefined;
    const status = searchParams.get('status'); // 'active' or 'inactive'
    const activeOnly = status === 'active' ? true : status === 'inactive' ? false : undefined;

    // Sorting
    const sortParam = searchParams.get('sort') || 'name';
    const sortBy = ['name', 'vintage', 'created_at'].includes(sortParam)
      ? (sortParam as 'name' | 'vintage' | 'created_at')
      : 'name';
    const sortOrder = searchParams.get('order') === 'desc' ? 'desc' : 'asc';

    const result = await iorPortfolioService.listProducts(guard.ctx, producerId, {
      page,
      pageSize,
      search,
      activeOnly,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] GET /api/ior/producers/[id]/products error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const product = await iorPortfolioService.createProduct(guard.ctx, {
      ...body,
      producer_id: producerId,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/ior/producers/[id]/products error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
