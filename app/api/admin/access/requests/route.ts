/**
 * /api/admin/access/requests
 *
 * GET: list consumer's requests (auth required)
 * POST: create request (auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessConsumerId } from '@/lib/access-auth';
import {
  getRequestsByConsumer,
  createRequest,
  getConsumerById,
  logAccessEvent,
} from '@/lib/access-service';
import { sendEmail } from '@/lib/email-service';
import { accessRequestConfirmationEmail } from '@/lib/email-templates';

export async function GET() {
  try {
    const consumerId = await getAccessConsumerId();
    if (!consumerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await getRequestsByConsumer(consumerId);
    return NextResponse.json(requests);
  } catch (error: any) {
    console.error('Request fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const consumerId = await getAccessConsumerId();
    if (!consumerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { wine_id, lot_id, importer_id, importer_name, quantity, message } = body;

    if (!quantity || quantity < 1) {
      return NextResponse.json({ error: 'Ogiltigt antal' }, { status: 400 });
    }

    const req = await createRequest(consumerId, {
      wine_id,
      lot_id,
      importer_id,
      importer_name,
      quantity,
      message,
    });

    await logAccessEvent('REQUEST_CREATED', consumerId, {
      request_id: req.id,
      wine_id,
      importer_name,
    });

    // Send confirmation email (fail-safe)
    try {
      const consumer = await getConsumerById(consumerId);
      if (consumer) {
        const { subject, html, text } = accessRequestConfirmationEmail({
          name: consumer.name,
          wineName: body.wine_name || 'Vin',
          importerName: importer_name || 'Importören',
          quantity,
        });
        await sendEmail({ to: consumer.email, subject, html, text });
      }
    } catch (emailError) {
      console.error('Failed to send request confirmation email:', emailError);
    }

    return NextResponse.json(req, { status: 201 });
  } catch (error: any) {
    console.error('Request create error:', error);
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}
