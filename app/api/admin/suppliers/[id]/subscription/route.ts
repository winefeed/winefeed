/**
 * ADMIN SUPPLIER SUBSCRIPTION API
 *
 * PUT /api/admin/suppliers/[id]/subscription
 *
 * Update supplier subscription tier (for admin manual upgrades)
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { SubscriptionTier } from '@/lib/subscription-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: supplierId } = params;
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tier } = body as { tier: SubscriptionTier };

    if (!tier || !['free', 'pro', 'premium'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be: free, pro, or premium' },
        { status: 400 }
      );
    }

    // Check supplier exists
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, namn')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Upsert subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        supplier_id: supplierId,
        tier: tier,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'supplier_id',
      })
      .select()
      .single();

    if (subError) {
      console.error('Error updating subscription:', subError);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        name: supplier.namn,
      },
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
      },
      message: `Leverantör "${supplier.namn}" uppgraderad till ${tier}`,
    });

  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: supplierId } = params;
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('supplier_id', supplierId)
      .single();

    // Get wine count
    const { count: winesCount } = await supabase
      .from('supplier_wines')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('is_active', true);

    return NextResponse.json({
      subscription: subscription || {
        tier: 'free',
        status: 'active',
      },
      usage: {
        wines_count: winesCount || 0,
      },
    });

  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
