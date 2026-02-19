/**
 * POST /api/admin/food-scan/restaurant
 *
 * Trigger a restaurant menu scan via Wolt.
 * Body: { wolt_slug, restaurant_name, city, restaurant_id? }
 * REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { scanRestaurantMenu } from '@/lib/food-scan/food-scan-service';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { wolt_slug, restaurant_name, city, restaurant_id } = body;

    if (!wolt_slug || !restaurant_name) {
      return NextResponse.json({ error: 'Missing wolt_slug or restaurant_name' }, { status: 400 });
    }

    const result = await scanRestaurantMenu(
      wolt_slug,
      restaurant_name,
      city || 'stockholm',
      restaurant_id,
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[FoodScan] Restaurant scan error:', error);
    return NextResponse.json({ error: 'Scan failed', message: error.message }, { status: 500 });
  }
}
