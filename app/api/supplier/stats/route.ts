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

      // Active offers
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .eq('status', 'pending'),

      // Pending orders
      supabase
        .from('orders')
        .select('id, offer:offers!inner(supplier_id)', { count: 'exact', head: true })
        .eq('offer.supplier_id', supplierId)
        .eq('status', 'pending'),

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

    return NextResponse.json({
      totalWines: winesResult.count || 0,
      activeWines: activeWinesResult.count || 0,
      pendingRequests: pendingRequestsResult.count || 0,
      activeOffers: activeOffersResult.count || 0,
      pendingOrders: pendingOrdersResult.count || 0,
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
