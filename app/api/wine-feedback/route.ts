/**
 * POST /api/wine-feedback
 *
 * Records structured negative feedback from a restaurant on a specific wine.
 * Used by the results page dislike popover. Feeds into the pre-scorer
 * personalization (P1-2) and aggregated supplier trends (P1-3).
 *
 * Body: {
 *   wine_id: string,
 *   supplier_id: string,
 *   feedback_type: 'too_expensive' | 'wrong_style' | 'wrong_region' | 'already_tried' | 'other',
 *   request_id?: string,
 *   note?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

const FeedbackSchema = z.object({
  wine_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  feedback_type: z.enum(['too_expensive', 'wrong_style', 'wrong_region', 'already_tried', 'other']),
  request_id: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Only restaurants can submit feedback' }, { status: 403 });
    }

    const restaurantId = actor.restaurant_id;
    if (!restaurantId) {
      return NextResponse.json({ error: 'No restaurant associated' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { adminClient } = await createRouteClients();

    const { error: insertError } = await adminClient
      .from('wine_feedback')
      .insert({
        restaurant_id: restaurantId,
        wine_id: parsed.data.wine_id,
        supplier_id: parsed.data.supplier_id,
        feedback_type: parsed.data.feedback_type,
        request_id: parsed.data.request_id || null,
        note: parsed.data.note || null,
      });

    if (insertError) {
      console.error('wine_feedback insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save feedback', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/wine-feedback error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
