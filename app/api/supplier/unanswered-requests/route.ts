/**
 * SUPPLIER UNANSWERED REQUESTS API
 *
 * GET /api/supplier/unanswered-requests - Get requests supplier hasn't responded to
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

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

    const { userClient } = await createRouteClients();

    const now = new Date();

    // Get all requests
    const { data: allRequests } = await userClient
      .from('requests')
      .select(`
        id,
        fritext,
        deadline,
        created_at,
        vin_typ,
        land,
        region,
        budget_per_flaska,
        restaurants!inner(id, name)
      `)
      .is('deleted_at', null)
      .order('deadline', { ascending: true });

    if (!allRequests || allRequests.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Get supplier's offers to find which requests they've responded to
    const requestIds = allRequests.map(r => r.id);
    const { data: supplierOffers } = await userClient
      .from('offers')
      .select('request_id')
      .eq('supplier_id', actor.supplier_id)
      .in('request_id', requestIds);

    const respondedIds = new Set(supplierOffers?.map(o => o.request_id) || []);

    // Filter to unanswered and calculate urgency
    const unansweredRequests = allRequests
      .filter(req => !respondedIds.has(req.id))
      .map(req => {
        const deadline = new Date(req.deadline);
        const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

        let urgency: 'critical' | 'urgent' | 'normal' | 'expired';
        if (hoursLeft < 0) {
          urgency = 'expired';
        } else if (hoursLeft < 4) {
          urgency = 'critical';
        } else if (hoursLeft < 72) {
          urgency = 'urgent';
        } else {
          urgency = 'normal';
        }

        return {
          id: req.id,
          fritext: req.fritext,
          deadline: req.deadline,
          created_at: req.created_at,
          vin_typ: req.vin_typ,
          land: req.land,
          region: req.region,
          budget_per_flaska: req.budget_per_flaska,
          restaurant: {
            id: (req.restaurants as any)?.id,
            name: (req.restaurants as any)?.name || 'Restaurang',
          },
          urgency,
          hours_left: Math.max(0, hoursLeft),
        };
      })
      // Sort: critical first, then urgent, then by deadline
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, urgent: 1, normal: 2, expired: 3 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.hours_left - b.hours_left;
      });

    return NextResponse.json({
      requests: unansweredRequests,
      total: unansweredRequests.length,
      critical_count: unansweredRequests.filter(r => r.urgency === 'critical').length,
      urgent_count: unansweredRequests.filter(r => r.urgency === 'urgent').length,
    });
  } catch (error: any) {
    console.error('Error fetching unanswered requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
