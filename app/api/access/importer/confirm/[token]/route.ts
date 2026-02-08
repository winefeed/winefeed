/**
 * /api/access/importer/confirm/[token]
 *
 * GET:  Peek at order info (doesn't consume token)
 * POST: Confirm order received (consumes token)
 *
 * NO consumer data is ever returned here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthTokenPeek, verifyAuthToken } from '@/lib/access-auth';
import {
  getRequestByIdForAdmin,
  markOrderConfirmed,
  logAccessEvent,
} from '@/lib/access-service';
import { sendEmail } from '@/lib/email-service';
import { renderConsumerOrderConfirmedEmail } from '@/lib/email-templates';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Peek: verify without consuming
    const tokenData = await verifyAuthTokenPeek(token);
    if (!tokenData || tokenData.subjectType !== 'importer_confirm') {
      await logAccessEvent('IMPORTER_CONFIRM_TOKEN_INVALID', null, {
        token_prefix: token.substring(0, 8),
        ip: _request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      });
      return NextResponse.json(
        { error: 'invalid_token', message: 'Länken har gått ut eller är ogiltig.' },
        { status: 401 }
      );
    }

    const requestId = tokenData.metadata.request_id as string;
    if (!requestId) {
      return NextResponse.json(
        { error: 'invalid_token', message: 'Ogiltigt token.' },
        { status: 401 }
      );
    }

    const req = await getRequestByIdForAdmin(requestId);
    if (!req) {
      return NextResponse.json(
        { error: 'not_found', message: 'Förfrågan hittades inte.' },
        { status: 404 }
      );
    }

    // Generate reference code
    const referenceCode = 'VK-' + requestId.replace(/-/g, '').substring(0, 6).toUpperCase();

    // Return order info only — NO consumer data
    return NextResponse.json({
      wine_name: req.wine?.name || 'Okänt vin',
      vintage: req.wine?.vintage || null,
      reference_code: referenceCode,
      quantity: req.response_quantity || req.quantity,
      response_price_sek: req.response_price_sek || null,
      response_quantity: req.response_quantity || null,
      can_confirm: !req.order_confirmed_at,
      already_confirmed: !!req.order_confirmed_at,
    });
  } catch (error: any) {
    console.error('Importer confirm GET error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Något gick fel.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Consume token (one-time use for confirmation)
    const tokenData = await verifyAuthToken(token);
    if (!tokenData || tokenData.subjectType !== 'importer_confirm') {
      await logAccessEvent('IMPORTER_CONFIRM_TOKEN_INVALID_POST', null, {
        token_prefix: token.substring(0, 8),
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      });
      return NextResponse.json(
        { error: 'invalid_token', message: 'Länken har gått ut eller redan använts.' },
        { status: 401 }
      );
    }

    const requestId = tokenData.metadata.request_id as string;
    if (!requestId) {
      return NextResponse.json(
        { error: 'invalid_token', message: 'Ogiltigt token.' },
        { status: 401 }
      );
    }

    const req = await getRequestByIdForAdmin(requestId);
    if (!req) {
      return NextResponse.json(
        { error: 'not_found', message: 'Förfrågan hittades inte.' },
        { status: 404 }
      );
    }

    // Guard: if order already confirmed, reject
    if (req.order_confirmed_at) {
      return NextResponse.json(
        { error: 'already_confirmed', message: 'Beställningen har redan bekräftats.' },
        { status: 409 }
      );
    }

    // Mark order as confirmed
    const success = await markOrderConfirmed(requestId);
    if (!success) {
      return NextResponse.json(
        { error: 'server_error', message: 'Kunde inte bekräfta beställningen.' },
        { status: 500 }
      );
    }

    // Log event
    await logAccessEvent('ORDER_CONFIRMED', null, {
      request_id: requestId,
      importer_id: tokenData.subjectId,
    });

    // Send handoff email to consumer
    const referenceCode = 'VK-' + requestId.replace(/-/g, '').substring(0, 6).toUpperCase();
    try {
      const { subject, html, text } = renderConsumerOrderConfirmedEmail({
        consumerName: req.consumer?.name || null,
        wineName: req.wine?.name || 'Vin',
        vintage: req.wine?.vintage || null,
        referenceCode,
        quantity: req.response_quantity || req.quantity,
        priceSek: req.response_price_sek || null,
      });
      await sendEmail({
        to: req.consumer.email,
        subject,
        html,
        text,
        reply_to: 'hej@vinkoll.se',
      });
    } catch (emailError) {
      console.error('Failed to send consumer handoff email:', emailError);
      // Don't fail the confirmation if email fails
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Importer confirm POST error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Något gick fel.' },
      { status: 500 }
    );
  }
}
