/**
 * IOR PRODUCTS BULK UPDATE API
 *
 * PATCH /api/ior/producers/[id]/products/bulk - Bulk update products
 *   Body: { productIds: string[], patch: { is_active?: boolean } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // Validate params exist (producerId context, though not used for bulk)
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();

    if (!body.productIds || !Array.isArray(body.productIds) || body.productIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty productIds array' }, { status: 400 });
    }

    if (!body.patch || typeof body.patch !== 'object') {
      return NextResponse.json({ error: 'Missing patch object' }, { status: 400 });
    }

    const result = await iorPortfolioService.bulkUpdateProducts(
      guard.ctx,
      body.productIds,
      body.patch
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] PATCH /api/ior/producers/[id]/products/bulk error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
