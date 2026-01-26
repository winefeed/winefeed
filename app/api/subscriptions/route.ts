/**
 * SUBSCRIPTION API
 *
 * GET /api/subscriptions - Get current supplier's subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { getSubscriptionWithLimits } from '@/lib/subscription-service';

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

    const subscription = await getSubscriptionWithLimits(actor.supplier_id);

    return NextResponse.json({
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      limits: subscription.limits,
      usage: subscription.usage,
      can_add_wine: subscription.can_add_wine,
      can_receive_lead: subscription.can_receive_lead,
      can_send_offer: subscription.can_send_offer,
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
