/**
 * SUPPLIER STATS API
 *
 * GET /api/supplier/stats
 *
 * Returns dashboard statistics for the current supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';

export async function GET(request: NextRequest) {
  try {
    // MVP: Get user context from headers
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { userClient } = await createRouteClients();

    // Get supplier ID from user
    const { data: supplierUser } = await userClient
      .from('supplier_users')
      .select('supplier_id')
      .eq('id', userId)
      .single();

    if (!supplierUser) {
      return NextResponse.json(
        { error: 'Not a supplier user' },
        { status: 403 }
      );
    }

    const supplierId = supplierUser.supplier_id;

    // Calculate date ranges for trends
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Fetch all stats in parallel
    const [
      winesResult,
      activeWinesResult,
      pendingRequestsResult,
      activeOffersResult,
      acceptedOffersResult,
      totalOffersResult,
      pendingOrdersResult,
      recentActivityResult,
      // New stats for response time and conversion
      assignmentsWithResponseResult,
      totalAssignmentsResult,
      completedOrdersResult,
      // Trend stats (last 30 days vs previous 30 days)
      offersLast30Result,
      offersPrev30Result,
      acceptedLast30Result,
      acceptedPrev30Result,
    ] = await Promise.all([
      // Total wines
      userClient
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId),

      // Active wines
      userClient
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .eq('is_active', true),

      // Pending requests (quote requests without an offer from this supplier)
      userClient
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .not('id', 'in', `(select quote_request_id from offers where supplier_id = '${supplierId}')`),

      // Active offers (pending/sent)
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['DRAFT', 'SENT', 'pending']),

      // Accepted offers
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['ACCEPTED', 'accepted']),

      // Total offers (for win rate calculation)
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['ACCEPTED', 'accepted', 'REJECTED', 'rejected']),

      // Pending orders
      userClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['PENDING', 'pending']),

      // Recent activity (last 10 actions)
      userClient
        .from('offers')
        .select(`
          id,
          status,
          created_at,
          quote_request:quote_requests(
            wine:wines(name),
            restaurant:restaurants(name)
          )
        `)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(5),

      // Assignments with response (for avg response time)
      userClient
        .from('quote_request_assignments')
        .select('sent_at, responded_at')
        .eq('supplier_id', supplierId)
        .not('responded_at', 'is', null),

      // Total assignments received
      userClient
        .from('quote_request_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId),

      // Completed orders
      userClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['DELIVERED', 'delivered', 'COMPLETED', 'completed']),

      // Offers last 30 days
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // Offers previous 30 days
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString()),

      // Accepted last 30 days
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['ACCEPTED', 'accepted'])
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // Accepted previous 30 days
      userClient
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['ACCEPTED', 'accepted'])
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString()),
    ]);

    // Transform recent activity
    const recentActivity = (recentActivityResult.data || []).map((offer: any) => ({
      id: offer.id,
      type: 'offer' as const,
      title: `Offert till ${offer.quote_request?.restaurant?.name || 'restaurang'} för ${offer.quote_request?.wine?.name || 'vin'}`,
      timestamp: offer.created_at,
      status: offer.status === 'pending' ? 'Väntar' :
              offer.status === 'accepted' ? 'Accepterad' :
              offer.status === 'rejected' ? 'Avböjd' : offer.status,
    }));

    // Calculate win rate
    const acceptedCount = acceptedOffersResult.count || 0;
    const totalDecided = totalOffersResult.count || 0;
    const winRate = totalDecided > 0 ? Math.round((acceptedCount / totalDecided) * 100) : 0;

    // Calculate average response time (in hours)
    let avgResponseTimeHours = 0;
    const responseTimes = (assignmentsWithResponseResult.data || [])
      .filter((a: any) => a.sent_at && a.responded_at)
      .map((a: any) => {
        const sent = new Date(a.sent_at).getTime();
        const responded = new Date(a.responded_at).getTime();
        return (responded - sent) / (1000 * 60 * 60); // hours
      });

    if (responseTimes.length > 0) {
      avgResponseTimeHours = Math.round(
        responseTimes.reduce((sum: number, t: number) => sum + t, 0) / responseTimes.length
      );
    }

    // Calculate response rate (answered / total requests)
    const totalAssignments = totalAssignmentsResult.count || 0;
    const answeredAssignments = responseTimes.length;
    const responseRate = totalAssignments > 0
      ? Math.round((answeredAssignments / totalAssignments) * 100)
      : 0;

    // Calculate conversion funnel
    const totalOffersCount = (activeOffersResult.count || 0) + acceptedCount + (totalOffersResult.count || 0);
    const completedOrders = completedOrdersResult.count || 0;
    const conversionRate = totalOffersCount > 0
      ? Math.round((acceptedCount / totalOffersCount) * 100)
      : 0;

    // Calculate trends (comparing last 30 days vs previous 30 days)
    const offersLast30 = offersLast30Result.count || 0;
    const offersPrev30 = offersPrev30Result.count || 0;
    const offersTrend = offersPrev30 > 0
      ? Math.round(((offersLast30 - offersPrev30) / offersPrev30) * 100)
      : offersLast30 > 0 ? 100 : 0;

    const acceptedLast30 = acceptedLast30Result.count || 0;
    const acceptedPrev30 = acceptedPrev30Result.count || 0;
    const acceptedTrend = acceptedPrev30 > 0
      ? Math.round(((acceptedLast30 - acceptedPrev30) / acceptedPrev30) * 100)
      : acceptedLast30 > 0 ? 100 : 0;

    return NextResponse.json({
      // Basic stats
      totalWines: winesResult.count || 0,
      activeWines: activeWinesResult.count || 0,
      pendingRequests: pendingRequestsResult.count || 0,
      activeOffers: activeOffersResult.count || 0,
      acceptedOffers: acceptedCount,
      pendingOrders: pendingOrdersResult.count || 0,
      completedOrders,
      winRate,
      recentActivity,

      // Performance metrics
      avgResponseTimeHours,
      responseRate,
      conversionRate,
      totalAssignments,
      answeredAssignments,

      // Trends (last 30 days)
      trends: {
        offersLast30,
        offersTrend,
        acceptedLast30,
        acceptedTrend,
      },
    });

  } catch (error: any) {
    console.error('Error fetching supplier stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
