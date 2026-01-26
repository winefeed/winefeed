/**
 * SUPPLIER STATS API
 *
 * GET /api/supplier/stats
 *
 * Returns dashboard statistics for the current supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

    // Get supplier ID from user
    const { data: supplierUser } = await supabase
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
    ] = await Promise.all([
      // Total wines
      supabase
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId),

      // Active wines
      supabase
        .from('supplier_wines')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .eq('is_active', true),

      // Pending requests (quote requests without an offer from this supplier)
      supabase
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .not('id', 'in', `(select quote_request_id from offers where supplier_id = '${supplierId}')`),

      // Active offers (pending/sent)
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['DRAFT', 'SENT', 'pending']),

      // Accepted offers
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['ACCEPTED', 'accepted']),

      // Total offers (for win rate calculation)
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['ACCEPTED', 'accepted', 'REJECTED', 'rejected']),

      // Pending orders
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .in('status', ['PENDING', 'pending']),

      // Recent activity (last 10 actions)
      supabase
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

    return NextResponse.json({
      totalWines: winesResult.count || 0,
      activeWines: activeWinesResult.count || 0,
      pendingRequests: pendingRequestsResult.count || 0,
      activeOffers: activeOffersResult.count || 0,
      acceptedOffers: acceptedCount,
      pendingOrders: pendingOrdersResult.count || 0,
      winRate,
      recentActivity,
    });

  } catch (error: any) {
    console.error('Error fetching supplier stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
