/**
 * SUPPLIER NOTIFICATIONS API
 *
 * GET /api/supplier/notifications - Get notifications and activity feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import {
  getSupplierNotifications,
  getSupplierActivity,
  getNotificationCounts,
  getLowStockWines,
} from '@/lib/notifications-service';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier linked to user' },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';

    // Fetch data based on type
    if (type === 'counts') {
      const counts = await getNotificationCounts(actor.supplier_id);
      return NextResponse.json(counts);
    }

    if (type === 'activity') {
      const activity = await getSupplierActivity(actor.supplier_id);
      return NextResponse.json({ activity });
    }

    if (type === 'low_stock') {
      const lowStock = await getLowStockWines(actor.supplier_id);
      return NextResponse.json({ low_stock: lowStock });
    }

    // Default: return everything
    const [notifications, activity, counts, lowStock] = await Promise.all([
      getSupplierNotifications(actor.supplier_id),
      getSupplierActivity(actor.supplier_id),
      getNotificationCounts(actor.supplier_id),
      getLowStockWines(actor.supplier_id),
    ]);

    return NextResponse.json({
      notifications,
      activity,
      counts,
      low_stock: lowStock,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
