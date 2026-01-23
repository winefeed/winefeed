/**
 * SUPPLIER ORDER CONFIRM API
 *
 * POST /api/suppliers/[supplierId]/orders/[orderId]/confirm
 *
 * Confirm an order (for Swedish importers)
 * Changes status from PENDING_SUPPLIER_CONFIRMATION to CONFIRMED
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { orderService } from '@/lib/order-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(
  request: NextRequest,
  { params }: { params: { supplierId: string; orderId: string } }
) {
  try {
    const { supplierId, orderId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify user has access to this supplier
    const { data: supplierUser, error: accessError } = await supabase
      .from('supplier_users')
      .select('supplier_id')
      .eq('id', userId)
      .eq('supplier_id', supplierId)
      .single();

    if (accessError || !supplierUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Parse optional note from body
    let note: string | undefined;
    try {
      const body = await request.json();
      note = body.note;
    } catch {
      // No body, that's fine
    }

    // Confirm the order
    const result = await orderService.confirmOrderBySupplier({
      order_id: orderId,
      tenant_id: tenantId,
      supplier_id: supplierId,
      actor_user_id: userId,
      note,
    });

    return NextResponse.json({
      success: true,
      order_id: result.order_id,
      status: result.status,
      message: 'Order confirmed successfully',
    });

  } catch (error: any) {
    console.error('Error confirming order:', error);

    // Handle specific errors
    if (error.message?.includes('Access denied')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message?.includes('Cannot confirm')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to confirm order', details: error.message },
      { status: 500 }
    );
  }
}
