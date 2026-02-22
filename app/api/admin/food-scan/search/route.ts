/**
 * GET /api/admin/food-scan/search?q=...&city=stockholm
 *
 * Search Wolt venues. REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { searchWoltVenues } from '@/lib/food-scan/food-scan-service';

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
    const q = searchParams.get('q');
    const city = searchParams.get('city') || '';

    if (!q) {
      return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });
    }

    const venues = await searchWoltVenues(q, city);
    return NextResponse.json({ venues });
  } catch (error: any) {
    console.error('[FoodScan] Search error:', error);
    return NextResponse.json({ error: 'Search failed', message: error.message }, { status: 500 });
  }
}
