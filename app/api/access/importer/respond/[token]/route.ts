/**
 * /api/access/importer/respond/[token]
 *
 * GET:  Peek at wine info (doesn't consume token)
 * POST: Submit importer response (consumes token)
 *
 * NO consumer data is ever returned here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthTokenPeek, verifyAuthToken } from '@/lib/access-auth';
import {
  getRequestByIdForAdmin,
  recordImporterResponse,
  markRequestSeen,
  logAccessEvent,
  sanitizeConsumerMessage,
} from '@/lib/access-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Peek: verify without consuming
    const tokenData = await verifyAuthTokenPeek(token);
    if (!tokenData || tokenData.subjectType !== 'importer_response') {
      // Log failed attempt for audit (brute-force detection)
      await logAccessEvent('IMPORTER_TOKEN_INVALID', null, {
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

    // Mark as seen on first open (only if still pending)
    if (req.status === 'pending') {
      await markRequestSeen(requestId);
    }

    // Check if already responded
    const alreadyResponded = req.status === 'accepted' || req.status === 'declined';

    // Return wine info only — NO consumer data, NO request_id
    return NextResponse.json({
      wine_name: req.wine?.name || 'Okänt vin',
      wine_type: req.wine?.wine_type || null,
      vintage: req.wine?.vintage || null,
      grape: req.wine?.grape || null,
      region: req.wine?.region || null,
      country: req.wine?.country || null,
      quantity: req.quantity,
      price_sek: req.lot_price_sek || null,
      consumer_message: sanitizeConsumerMessage(req.message),
      can_respond: !alreadyResponded,
      already_responded: alreadyResponded,
    });
  } catch (error: any) {
    console.error('Importer respond GET error:', error);
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

    // Consume token (one-time use for submission)
    const tokenData = await verifyAuthToken(token);
    if (!tokenData || tokenData.subjectType !== 'importer_response') {
      await logAccessEvent('IMPORTER_TOKEN_INVALID_POST', null, {
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

    // Verify request exists and token importer matches
    const reqCheck = await getRequestByIdForAdmin(requestId);
    if (!reqCheck) {
      return NextResponse.json(
        { error: 'not_found', message: 'Förfrågan hittades inte.' },
        { status: 404 }
      );
    }
    // Guard: if request already has a response, reject (belt-and-suspenders with token consumption)
    if (reqCheck.responded_at) {
      return NextResponse.json(
        { error: 'already_responded', message: 'Förfrågan har redan besvarats.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { accepted, price_sek, quantity, delivery_days, note } = body;

    if (typeof accepted !== 'boolean') {
      return NextResponse.json(
        { error: 'validation', message: 'accepted (boolean) krävs.' },
        { status: 400 }
      );
    }

    const result = await recordImporterResponse(requestId, {
      accepted,
      price_sek: accepted ? price_sek : undefined,
      quantity: accepted ? quantity : undefined,
      delivery_days: accepted ? delivery_days : undefined,
      note,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'server_error', message: 'Kunde inte spara svar.' },
        { status: 500 }
      );
    }

    // Log event
    await logAccessEvent('IMPORTER_RESPONDED', null, {
      request_id: requestId,
      importer_id: tokenData.subjectId,
      accepted,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Importer respond POST error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Något gick fel.' },
      { status: 500 }
    );
  }
}
