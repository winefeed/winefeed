/**
 * IOR ORDER LINES API
 *
 * PATCH /api/ior/orders/[id]/lines - Update compliance data on order lines
 *
 * Used by the compliance edit panel to update GTIN, LWIN, ABV, volume, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface LineUpdate {
  lineId: string;
  data: {
    gtin?: string | null;
    lwin?: string | null;
    abv?: number | null;
    volume_ml?: number | null;
    country?: string | null;
    packaging_type?: string | null;
  };
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: orderId } = await params;

    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Verify IOR access
    if (!actorService.hasRole(actor, 'IOR') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'IOR or ADMIN access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const updates: LineUpdate[] = body.updates;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to IOR (if not admin)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, importer_of_record_id')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!actorService.hasRole(actor, 'ADMIN') && order.importer_of_record_id !== actor.importer_id) {
      return NextResponse.json(
        { error: 'Not authorized for this order' },
        { status: 403 }
      );
    }

    // Allowed fields for update
    const allowedFields = ['gtin', 'lwin', 'abv', 'volume_ml', 'country', 'packaging_type'];

    // Process each update
    const results: Array<{ lineId: string; success: boolean; error?: string }> = [];

    for (const update of updates) {
      // Filter to only allowed fields
      const filteredData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (update.data[field as keyof typeof update.data] !== undefined) {
          filteredData[field] = update.data[field as keyof typeof update.data];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        results.push({ lineId: update.lineId, success: false, error: 'No valid fields' });
        continue;
      }

      // Update the order line
      const { error: updateError } = await supabase
        .from('order_lines')
        .update(filteredData)
        .eq('id', update.lineId)
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error updating order line:', updateError);
        results.push({ lineId: update.lineId, success: false, error: updateError.message });
      } else {
        results.push({ lineId: update.lineId, success: true });
      }
    }

    // Log event
    await supabase.from('order_events').insert({
      tenant_id: tenantId,
      order_id: orderId,
      event_type: 'COMPLIANCE_UPDATED',
      note: `Compliance data uppdaterad för ${results.filter(r => r.success).length} rad(er)`,
      actor_user_id: userId,
      actor_name: 'IOR User',
      metadata: { updates: results },
    });

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `${successCount} rad(er) uppdaterade${failCount > 0 ? `, ${failCount} misslyckades` : ''}`,
      results,
    });
  } catch (error: any) {
    console.error('Error updating order lines:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
