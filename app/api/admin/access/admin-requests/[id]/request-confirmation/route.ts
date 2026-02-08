/**
 * /api/admin/access/admin-requests/[id]/request-confirmation
 *
 * POST: Send confirmation request email to importer (order received?)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRequestByIdForAdmin,
  logAccessEvent,
  sanitizeConsumerMessage,
} from '@/lib/access-service';
import { createAuthToken } from '@/lib/access-auth';
import { sendEmail, getAppUrl } from '@/lib/email-service';
import { renderImporterConfirmEmail } from '@/lib/email-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;

    const req = await getRequestByIdForAdmin(id);
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Validate: must have consumer_notified_at
    if (!req.consumer_notified_at) {
      return NextResponse.json(
        { error: 'Consumer has not been notified yet' },
        { status: 400 }
      );
    }

    // Idempotency: block if already confirmed, unless force=true
    if (req.order_confirmed_at && !force) {
      return NextResponse.json(
        { error: 'Order already confirmed. Use force=true to re-send.' },
        { status: 409 }
      );
    }

    // Get importer email from body or from req.importer.contact_email
    const importerEmail = body.importer_email || req.importer?.contact_email;
    if (!importerEmail) {
      return NextResponse.json(
        { error: 'importer_email is required. No contact email found for this importer.' },
        { status: 400 }
      );
    }

    // Generate reference code: VK-XXXXXX
    const referenceCode = 'VK-' + id.replace(/-/g, '').substring(0, 6).toUpperCase();

    // Create auth token (7 days = 10080 min)
    const token = await createAuthToken(
      'importer_confirm',
      req.importer?.id || id,
      { request_id: id },
      10080
    );

    const confirmUrl = getAppUrl('/access/importer/confirm/' + token);
    console.log('[DEV] Importer confirm URL:', confirmUrl);

    // Sanitize consumer message before sending to importer
    const sanitizedMessage = sanitizeConsumerMessage(req.message);

    // Render and send email
    const { subject, html, text } = renderImporterConfirmEmail({
      importerContactName: null,
      wineName: req.wine?.name || 'Okänt vin',
      vintage: req.wine?.vintage || null,
      referenceCode,
      quantity: req.response_quantity || req.quantity,
      priceSek: req.response_price_sek || null,
      consumerMessage: sanitizedMessage,
      confirmUrl,
    });

    const emailResult = await sendEmail({
      to: importerEmail,
      subject,
      html,
      text,
      reply_to: 'hej@vinkoll.se',
    });

    // Log event
    await logAccessEvent('CONFIRMATION_REQUESTED', req.consumer_id, {
      request_id: id,
      importer_email: importerEmail,
      email_sent: emailResult.success,
      requested_by: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Request confirmation error:', error);
    return NextResponse.json(
      { error: 'Failed to send confirmation request' },
      { status: 500 }
    );
  }
}
