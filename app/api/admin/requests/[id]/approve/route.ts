/**
 * ADMIN — Approve or reject an open broadcast request
 *
 * POST /api/admin/requests/[id]/approve   — approve and fan out
 * POST /api/admin/requests/[id]/reject    — mark rejected
 *
 * REQUIRES: ADMIN role
 * Only works on requests where request_type = 'open' and status = 'PENDING_REVIEW'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { assignOpenRequest, describeOpenCriteria, type OpenCriteria } from '@/lib/matching-agent/open-request-fanout';
import { sendEmail, getSupplierEmail } from '@/lib/email-service';
import { newQuoteRequestEmail } from '@/lib/email-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);


export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { data: req, error: fetchError } = await supabase
      .from('requests')
      .select('id, request_type, status, open_criteria, restaurant_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.request_type !== 'open') {
      return NextResponse.json({ error: 'Only open requests can be approved here' }, { status: 400 });
    }

    if (req.status !== 'PENDING_REVIEW') {
      return NextResponse.json(
        { error: `Request is in status ${req.status}, only PENDING_REVIEW can be approved` },
        { status: 400 }
      );
    }

    // Run fan-out FIRST so a partial failure doesn't leave us with an OPEN
    // request that no supplier has been notified about.
    const fanout = await assignOpenRequest(params.id, req.open_criteria as OpenCriteria);

    if (fanout.assignments_created === 0) {
      return NextResponse.json(
        {
          error: 'No matching suppliers found — request not approved',
          suppliers_matched: fanout.suppliers_matched,
        },
        { status: 422 }
      );
    }

    // Flip status to OPEN now that suppliers have been assigned.
    const { error: updateError } = await supabase
      .from('requests')
      .update({ status: 'OPEN' })
      .eq('id', params.id);

    if (updateError) {
      console.error('Failed to flip status after fan-out:', updateError);
      return NextResponse.json(
        { error: 'Fan-out succeeded but status update failed', details: updateError.message },
        { status: 500 }
      );
    }

    // Email-notify each assigned supplier. Best-effort — email failures
    // must not undo the approved state.
    let emailsSent = 0;
    try {
      const { data: assignments } = await supabase
        .from('quote_request_assignments')
        .select('supplier_id, expires_at')
        .eq('quote_request_id', params.id);

      const supplierIds = [...new Set((assignments || []).map(a => a.supplier_id))];

      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, namn, kontakt_email')
        .in('id', supplierIds);

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', req.restaurant_id)
        .single();

      const restaurantName = restaurant?.name || 'En restaurang';
      const firstExpiry = (assignments || [])[0]?.expires_at;
      const criteria = req.open_criteria as OpenCriteria;

      for (const supplier of suppliers || []) {
        try {
          const email = supplier.kontakt_email || await getSupplierEmail(supplier.id, tenantId);
          if (!email) continue;

          const content = newQuoteRequestEmail({
            supplierName: supplier.namn || 'Leverantör',
            restaurantName,
            requestId: params.id,
            fritext: `Öppen förfrågan: ${describeOpenCriteria(criteria)}`,
            antalFlaskor: criteria.min_bottles,
            budgetPerFlaska: criteria.max_price_ex_vat_sek,
            expiresAt: firstExpiry,
            wineCount: undefined,
            hasProvorder: false,
            provorderFeeTotal: 0,
          });

          const result = await sendEmail({
            to: email,
            subject: content.subject,
            html: content.html,
            text: content.text,
          });
          if (result.success) emailsSent++;
        } catch (emailErr) {
          console.error('email send error for supplier', supplier.id, emailErr);
        }
      }
    } catch (emailLoopErr) {
      console.error('Email notification loop error:', emailLoopErr);
    }

    return NextResponse.json({
      id: params.id,
      status: 'OPEN',
      fanout,
      emails_sent: emailsSent,
    });
  } catch (err: any) {
    console.error('POST /api/admin/requests/[id]/approve error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
