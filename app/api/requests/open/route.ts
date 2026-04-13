/**
 * OPEN BROADCAST REQUESTS — Create endpoint
 *
 * POST /api/requests/open
 *
 * Creates a new open-type request (broadcast to all matching suppliers).
 * Unlike targeted requests, the restaurant specifies criteria instead of
 * specific SKUs. Goes into PENDING_REVIEW state for admin approval before
 * fan-out to suppliers.
 *
 * Body:
 * {
 *   criteria: {
 *     color?: 'red' | 'white' | 'rose' | 'sparkling' | 'orange' | 'fortified',
 *     appellation?: string,
 *     region?: string,
 *     country?: string,
 *     grape?: string,
 *     max_price_ex_vat_sek?: number,
 *     min_bottles?: number,
 *     vintage_from?: number,
 *     organic?: boolean,
 *     biodynamic?: boolean,
 *     free_text?: string
 *   }
 * }
 *
 * At least one of color/appellation/region/country/grape is required so
 * we have something to match on.
 *
 * Response: { id: string, status: 'PENDING_REVIEW' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import { sendEmail } from '@/lib/email-service';
import { openRequestReviewNotificationEmail } from '@/lib/email-templates';
import { describeOpenCriteria, openCriteriaBadges } from '@/lib/matching-agent/open-request-fanout';
import { blockIfUnverified } from '@/lib/license-guard';

const trimmedString = (max: number) =>
  z
    .string()
    .transform(s => s.trim())
    .pipe(z.string().min(1).max(max));

const coercedInt = (field: string) =>
  z
    .union([z.number(), z.string()])
    .transform(v => Number(v))
    .pipe(z.number().int().nonnegative({ message: `${field} must be a non-negative integer` }));

const CriteriaSchema = z
  .object({
    color: z.enum(['red', 'white', 'rose', 'sparkling', 'orange', 'fortified']).optional(),
    appellation: trimmedString(200).optional(),
    region: trimmedString(200).optional(),
    country: trimmedString(200).optional(),
    grape: trimmedString(200).optional(),
    max_price_ex_vat_sek: coercedInt('max_price_ex_vat_sek').optional(),
    min_bottles: coercedInt('min_bottles').optional(),
    vintage_from: coercedInt('vintage_from').optional(),
    organic: z.boolean().optional(),
    biodynamic: z.boolean().optional(),
    free_text: trimmedString(500).optional(),
  })
  .strict()
  .refine(
    c => !!(c.color || c.appellation || c.region || c.country || c.grape),
    { message: 'At least one of color, appellation, region, country, or grape is required' }
  );

type OpenCriteria = z.infer<typeof CriteriaSchema>;

const BodySchema = z.object({ criteria: CriteriaSchema });


export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Only restaurants can create open requests' }, { status: 403 });
    }

    const restaurantId = actor.restaurant_id;
    if (!restaurantId) {
      return NextResponse.json({ error: 'No restaurant associated with this user' }, { status: 400 });
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message || 'Invalid criteria', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const criteria = parsed.data.criteria;

    const { adminClient } = await createRouteClients();

    // License gate: unverified restaurants can browse but cannot send
    // requests. Admins bypass the gate because they may create requests
    // on behalf of pilot restaurants during setup.
    if (!actorService.hasRole(actor, 'ADMIN')) {
      const blocked = await blockIfUnverified(adminClient, restaurantId);
      if (blocked) {
        return NextResponse.json(blocked, { status: 403 });
      }
    }

    // Throttle: max 2 open requests per restaurant per 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminClient
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('request_type', 'open')
      .gte('created_at', sevenDaysAgo);

    if ((recentCount ?? 0) >= 2) {
      return NextResponse.json(
        { error: 'Rate limit: max 2 open requests per 7 days. Contact us if you need more.' },
        { status: 429 }
      );
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('requests')
      .insert({
        restaurant_id: restaurantId,
        fritext:
          `Öppen förfrågan: ${describeOpenCriteria(criteria)}` +
          (criteria.free_text ? ` — ${criteria.free_text}` : ''),
        budget_per_flaska: criteria.max_price_ex_vat_sek ?? null,
        antal_flaskor: criteria.min_bottles ?? null,
        status: 'PENDING_REVIEW',
        request_type: 'open',
        open_criteria: criteria,
        created_at: new Date().toISOString(),
      })
      .select('id, status')
      .single();

    if (insertError || !inserted) {
      console.error('Failed to create open request:', insertError);
      return NextResponse.json(
        { error: 'Failed to create request', details: insertError?.message },
        { status: 500 }
      );
    }

    // Notify admin review queue via email. Best-effort — a failed email
    // must not block the user's submit. Single recipient via
    // ADMIN_REVIEW_EMAIL env var, falls back to hej@winefeed.se.
    try {
      const adminEmail = process.env.ADMIN_REVIEW_EMAIL || 'hej@winefeed.se';
      const { data: rest } = await adminClient
        .from('restaurants')
        .select('name, city')
        .eq('id', restaurantId)
        .single();

      const content = openRequestReviewNotificationEmail({
        requestId: inserted.id,
        restaurantName: rest?.name || 'Restaurang',
        restaurantCity: rest?.city,
        summary: describeOpenCriteria(criteria),
        badges: openCriteriaBadges(criteria),
        freeText: criteria.free_text,
      });

      await sendEmail({
        to: adminEmail,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (notifyErr) {
      console.error('Admin review notification failed:', notifyErr);
    }

    return NextResponse.json({ id: inserted.id, status: inserted.status }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/requests/open error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
