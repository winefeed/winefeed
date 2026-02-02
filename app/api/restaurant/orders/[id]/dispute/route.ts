/**
 * RESTAURANT ORDER DISPUTE API
 *
 * POST /api/restaurant/orders/[id]/dispute
 * - Report a problem with an order
 *
 * Restaurant can flag issues like:
 * - Wrong products delivered
 * - Damaged goods
 * - Missing items
 * - Quality issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Ange en beskrivning av problemet (minst 10 tecken)' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify the order belongs to a restaurant the user has access to
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        dispute_status,
        restaurant_id,
        restaurants!inner(id, users!inner(id))
      `)
      .eq('id', orderId)
      .eq('restaurants.users.id', userId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order hittades inte eller du har inte behörighet' },
        { status: 404 }
      );
    }

    // Check if already disputed
    if (order.dispute_status !== 'none') {
      return NextResponse.json(
        { error: 'Ett ärende har redan rapporterats för denna order' },
        { status: 400 }
      );
    }

    // Update order with dispute
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        dispute_status: 'reported',
        dispute_reason: reason.trim(),
        dispute_reported_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to report dispute:', updateError);
      return NextResponse.json(
        { error: 'Kunde inte rapportera problemet' },
        { status: 500 }
      );
    }

    // Log event
    await supabase.from('order_events').insert({
      order_id: orderId,
      event_type: 'DISPUTE_REPORTED',
      actor_id: userId,
      details: { reason: reason.trim() },
    });

    return NextResponse.json({
      success: true,
      message: 'Problemet har rapporterats. Vi återkommer snarast.',
    });
  } catch (error) {
    console.error('Dispute API error:', error);
    return NextResponse.json(
      { error: 'Något gick fel' },
      { status: 500 }
    );
  }
}
