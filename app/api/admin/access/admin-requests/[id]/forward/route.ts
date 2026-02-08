/**
 * /api/admin/access/admin-requests/[id]/forward
 *
 * POST: Forward request to importer via email with magic-link
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRequestByIdForAdmin,
  forwardRequestToImporter,
  logAccessEvent,
  sanitizeConsumerMessage,
} from '@/lib/access-service';
import { createAuthToken } from '@/lib/access-auth';
import { sendEmail, getAppUrl } from '@/lib/email-service';
import { renderImporterForwardEmail } from '@/lib/email-templates';

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

    // Validate: must be pending or seen
    if (req.status !== 'pending' && req.status !== 'seen') {
      return NextResponse.json(
        { error: 'Request is not in a forwardable state' },
        { status: 400 }
      );
    }

    // Idempotency guard: block re-forward unless force=true
    if (req.forwarded_at && !force) {
      return NextResponse.json(
        { error: 'Already forwarded. Use force=true to re-forward.' },
        { status: 409 }
      );
    }

    // Validate importer email
    const importerEmail = body.importer_email;
    if (!importerEmail) {
      return NextResponse.json(
        { error: 'importer_email is required. No contact email found for this importer.' },
        { status: 400 }
      );
    }

    // Create importer token (7 days = 10080 min)
    // subject_id: use importer UUID if available, otherwise use request ID as fallback
    const token = await createAuthToken(
      'importer_response',
      req.importer?.id || id,
      { request_id: id, importer_name: req.importer?.name },
      10080
    );

    const respondUrl = getAppUrl(`/access/importer/respond/${token}`);
    console.log('[DEV] Importer respond URL:', respondUrl);

    // Sanitize consumer message before sending to importer
    const sanitizedMessage = sanitizeConsumerMessage(req.message);

    // Render and send email
    const { subject, html, text } = renderImporterForwardEmail({
      importerContactName: null,
      wineName: req.wine?.name || 'Okänt vin',
      wineType: req.wine?.wine_type || 'Rött',
      vintage: req.wine?.vintage || null,
      grape: req.wine?.grape || null,
      region: req.wine?.region || null,
      country: req.wine?.country || null,
      quantity: req.quantity,
      priceSek: req.lot_price_sek || null,
      consumerMessage: sanitizedMessage,
      respondUrl,
    });

    // reply_to = Vinkoll (never the consumer). Prevents accidental PII leak via headers.
    const emailResult = await sendEmail({ to: importerEmail, subject, html, text, reply_to: 'hej@vinkoll.se' });

    // Mark as forwarded
    await forwardRequestToImporter(id, {
      importer_email: importerEmail,
      forwarded_by: user.id,
    });

    // Log event
    await logAccessEvent('REQUEST_FORWARDED', req.consumer_id, {
      request_id: id,
      importer_email: importerEmail,
      email_sent: emailResult.success,
    });

    return NextResponse.json({
      success: true,
      forwarded_at: new Date().toISOString(),
      email_sent: emailResult.success,
    });
  } catch (error: any) {
    console.error('Forward request error:', error);
    return NextResponse.json(
      { error: 'Failed to forward request' },
      { status: 500 }
    );
  }
}
