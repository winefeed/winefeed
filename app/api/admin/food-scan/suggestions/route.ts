/**
 * GET /api/admin/food-scan/suggestions?status=pending&sort=occurrence_count
 *
 * List food pairing suggestions. REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { getPendingSuggestions } from '@/lib/food-scan/food-scan-service';

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
    const status = searchParams.get('status') || 'pending';
    const sort = searchParams.get('sort') || 'occurrence_count';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const suggestions = await getPendingSuggestions(status, sort, limit);
    return NextResponse.json({ suggestions, count: suggestions.length });
  } catch (error: any) {
    console.error('[FoodScan] Suggestions error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions', message: error.message }, { status: 500 });
  }
}
