/**
 * SPONSORED CATEGORIES API
 *
 * GET /api/sponsored/categories
 * List all active sponsored categories with availability info
 */

import { NextRequest, NextResponse } from 'next/server';
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest) {
  try {
    // Extract auth context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Resolve actor - any authenticated user can view categories
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    if (!actor) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Get all active categories
    const categories = await sponsoredSlotsService.listCategories(tenantId);

    return NextResponse.json({
      categories,
      count: categories.length
    });

  } catch (error: any) {
    console.error('Error listing sponsored categories:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
