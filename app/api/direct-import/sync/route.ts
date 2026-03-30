/**
 * IOR MARKETPLACE SYNC API
 *
 * POST /api/direct-import/sync
 * Syncs IOR products to supplier_wines for restaurant search visibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function POST(request: NextRequest) {
  // Auth check
  const guardResult = await requireIORContext(request);
  if (isGuardError(guardResult)) {
    return guardErrorResponse(guardResult);
  }
  const { ctx } = guardResult;

  try {
    const results = await iorPortfolioService.syncToSupplierWines(ctx);

    return NextResponse.json({
      success: true,
      ...results,
      summary: `Synkade ${results.winesSynced} viner från ${results.suppliersCreated + results.suppliersUpdated} producenter` +
        (results.winesDeactivated > 0 ? `, ${results.winesDeactivated} avaktiverade` : ''),
    });
  } catch (error: any) {
    console.error('[IOR Sync] Error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
