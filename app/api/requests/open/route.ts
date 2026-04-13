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
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import { sendEmail } from '@/lib/email-service';
import { openRequestReviewNotificationEmail } from '@/lib/email-templates';
import { describeOpenCriteria, openCriteriaBadges } from '@/lib/matching-agent/open-request-fanout';

interface OpenCriteria {
  color?: string;
  appellation?: string;
  region?: string;
  country?: string;
  grape?: string;
  max_price_ex_vat_sek?: number;
  min_bottles?: number;
  vintage_from?: number;
  organic?: boolean;
  biodynamic?: boolean;
  free_text?: string;
}

const ALLOWED_COLORS = ['red', 'white', 'rose', 'sparkling', 'orange', 'fortified'];

function validateCriteria(c: unknown): { ok: true; criteria: OpenCriteria } | { ok: false; error: string } {
  if (!c || typeof c !== 'object') {
    return { ok: false, error: 'criteria must be an object' };
  }
  const raw = c as Record<string, unknown>;
  const out: OpenCriteria = {};

  if (raw.color !== undefined && raw.color !== null && raw.color !== '') {
    if (typeof raw.color !== 'string' || !ALLOWED_COLORS.includes(raw.color)) {
      return { ok: false, error: `color must be one of: ${ALLOWED_COLORS.join(', ')}` };
    }
    out.color = raw.color;
  }

  for (const key of ['appellation', 'region', 'country', 'grape', 'free_text'] as const) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      if (typeof raw[key] !== 'string') return { ok: false, error: `${key} must be a string` };
      const trimmed = (raw[key] as string).trim();
      if (trimmed.length > 200) return { ok: false, error: `${key} too long` };
      if (trimmed) out[key] = trimmed;
    }
  }

  for (const key of ['max_price_ex_vat_sek', 'min_bottles', 'vintage_from'] as const) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      const n = Number(raw[key]);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${key} must be a non-negative number` };
      out[key] = Math.floor(n);
    }
  }

  for (const key of ['organic', 'biodynamic'] as const) {
    if (raw[key] !== undefined && raw[key] !== null) {
      out[key] = Boolean(raw[key]);
    }
  }

  // Must have at least one matchable criterion so fan-out isn't a blind broadcast
  const hasMatchable = !!(out.color || out.appellation || out.region || out.country || out.grape);
  if (!hasMatchable) {
    return { ok: false, error: 'At least one of color, appellation, region, country, or grape is required' };
  }

  return { ok: true, criteria: out };
}


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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = validateCriteria(body.criteria);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const criteria = validation.criteria;

    const { adminClient } = await createRouteClients();

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
