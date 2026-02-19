/**
 * GET /api/admin/food-scan/results
 *
 * List scan history. REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { getScanResults } from '@/lib/food-scan/food-scan-service';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const results = await getScanResults(limit);
    return NextResponse.json({ results, count: results.length });
  } catch (error: any) {
    console.error('[FoodScan] Results error:', error);
    return NextResponse.json({ error: 'Failed to fetch results', message: error.message }, { status: 500 });
  }
}
