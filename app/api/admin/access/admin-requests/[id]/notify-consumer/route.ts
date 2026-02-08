/**
 * /api/admin/access/admin-requests/[id]/notify-consumer
 *
 * POST: Notify consumer about importer's response
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRequestByIdForAdmin,
  markConsumerNotified,
  logAccessEvent,
} from '@/lib/access-service';
import { sendEmail, getAppUrl } from '@/lib/email-service';
import { renderConsumerResponseEmail } from '@/lib/email-templates';

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

    // Validate: must have a response
    if (!req.responded_at) {
      return NextResponse.json(
        { error: 'Importer has not responded yet' },
        { status: 400 }
      );
    }

    // Idempotency: block re-notify unless force=true (support case: mail in spam)
    if (req.consumer_notified_at && !force) {
      return NextResponse.json(
        { error: 'Consumer already notified. Use force=true to re-send.' },
        { status: 409 }
      );
    }

    const browseUrl = getAppUrl('/admin/access/viner');

    // Generate reference code from request ID: VK-XXXXXX
    const referenceCode = 'VK-' + id.replace(/-/g, '').substring(0, 6).toUpperCase();

    // Render email
    const { subject, html, text } = renderConsumerResponseEmail({
      consumerName: req.consumer.name,
      wineName: req.wine?.name || 'Vin',
      vintage: req.wine?.vintage || null,
      accepted: req.status === 'accepted',
      priceSek: req.response_price_sek,
      quantity: req.response_quantity,
      deliveryDays: req.response_delivery_days,
      importerNote: req.response_note,
      browseUrl,
      referenceCode,
    });

    // Send email. reply_to = Vinkoll (never the importer). Keeps separation.
    const emailResult = await sendEmail({ to: req.consumer.email, subject, html, text, reply_to: 'hej@vinkoll.se' });

    // Mark as notified
    await markConsumerNotified(id);

    // Log event
    await logAccessEvent('CONSUMER_NOTIFIED', req.consumer_id, {
      request_id: id,
      status: req.status,
      email_sent: emailResult.success,
      notified_by: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notify consumer error:', error);
    return NextResponse.json(
      { error: 'Failed to notify consumer' },
      { status: 500 }
    );
  }
}
