/**
 * RESTAURANT STATS API
 *
 * GET /api/restaurant/stats - Get dashboard statistics for restaurant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { processPendingOfferReminders } from '@/lib/pending-offer-reminders';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

    if (!actorService.hasRole(actor, 'RESTAURANT')) {
      return NextResponse.json(
        { error: 'Restaurant access required' },
        { status: 403 }
      );
    }

    if (!actor.restaurant_id) {
      return NextResponse.json(
        { error: 'No restaurant linked to user' },
        { status: 404 }
      );
    }

    const restaurantId = actor.restaurant_id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all stats in parallel
    const [
      activeRequestsResult,
      pendingOffersResult,
      acceptedOffersResult,
      pendingOrdersResult,
      completedOrdersResult,
      recentOffersResult,
      totalSpentResult,
    ] = await Promise.all([
      // Active requests (not expired, not completed)
      supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .gte('deadline', now.toISOString()),

      // Pending offers (awaiting decision)
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['SENT', 'pending']),

      // Accepted offers (last 30 days)
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['ACCEPTED', 'accepted'])
        .gte('updated_at', thirtyDaysAgo.toISOString()),

      // Pending orders
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['PENDING', 'CONFIRMED', 'pending', 'confirmed']),

      // Completed orders (last 30 days)
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['DELIVERED', 'delivered'])
        .gte('updated_at', thirtyDaysAgo.toISOString()),

      // Recent offers for activity feed
      supabase
        .from('offers')
        .select(`
          id,
          title,
          status,
          created_at,
          updated_at,
          suppliers!inner(namn)
        `)
        .eq('restaurant_id', restaurantId)
        .order('updated_at', { ascending: false })
        .limit(5),

      // Total spent (last 30 days)
      supabase
        .from('orders')
        .select('total_amount')
        .eq('restaurant_id', restaurantId)
        .in('status', ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'confirmed', 'shipped', 'delivered'])
        .gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    // Calculate total spent
    const totalSpent = (totalSpentResult.data || []).reduce(
      (sum, order) => sum + (order.total_amount || 0),
      0
    );

    // Transform recent offers for activity
    const recentActivity = (recentOffersResult.data || []).map((offer: any) => ({
      id: offer.id,
      type: 'offer' as const,
      title: offer.title || 'Offert',
      supplier: (offer.suppliers as any)?.namn || 'Leverantör',
      status: offer.status,
      timestamp: offer.updated_at || offer.created_at,
    }));

    // PILOT: "Poor man's cron" - Process pending offer reminders
    // Fire and forget - don't block stats response
    processPendingOfferReminders(tenantId).catch((err) => {
      console.error('Reminder processing error:', err);
    });

    return NextResponse.json({
      activeRequests: activeRequestsResult.count || 0,
      pendingOffers: pendingOffersResult.count || 0,
      acceptedOffers: acceptedOffersResult.count || 0,
      pendingOrders: pendingOrdersResult.count || 0,
      completedOrders: completedOrdersResult.count || 0,
      totalSpentThisMonth: totalSpent,
      recentActivity,
    });
  } catch (error: any) {
    console.error('Error fetching restaurant stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
