/**
 * OFFERS API - CREATE
 *
 * POST /api/offers - Create new multi-line offer
 *
 * Security:
 * - Tenant isolation
 * - No price data from Wine-Searcher in enrichment
 * - Audit trail via offer_events
 */

import { NextRequest, NextResponse } from 'next/server';
import { offerService, CreateOfferInput } from '@/lib/offer-service';
import { sendEmail, getRestaurantEmail, logEmailEvent } from '@/lib/email-service';
import { offerCreatedEmail } from '@/lib/email-templates';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    // Extract tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { restaurant_id, request_id, supplier_id, title, currency, lines } = body;

    // Validate required fields
    if (!restaurant_id) {
      return NextResponse.json({ error: 'Missing required field: restaurant_id' }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty lines array (at least 1 line required)' },
        { status: 400 }
      );
    }

    // Validate lines
    for (const line of lines) {
      if (!line.name || typeof line.name !== 'string') {
        return NextResponse.json(
          { error: `Invalid line: 'name' is required and must be a string` },
          { status: 400 }
        );
      }

      if (line.line_no === undefined || typeof line.line_no !== 'number') {
        return NextResponse.json(
          { error: `Invalid line: 'line_no' is required and must be a number` },
          { status: 400 }
        );
      }

      if (line.quantity !== undefined && (typeof line.quantity !== 'number' || line.quantity <= 0)) {
        return NextResponse.json(
          { error: `Invalid line: 'quantity' must be a positive number` },
          { status: 400 }
        );
      }
    }

    // Create offer via service
    const input: CreateOfferInput = {
      tenant_id: tenantId,
      restaurant_id,
      request_id: request_id || undefined,
      supplier_id: supplier_id || undefined,
      title: title || undefined,
      currency: currency || 'SEK',
      lines: lines.map((line: any) => ({
        line_no: line.line_no,
        name: line.name,
        vintage: line.vintage || undefined,
        quantity: line.quantity || 1,
        offered_unit_price_ore: line.offered_unit_price_ore || undefined,
        bottle_ml: line.bottle_ml || undefined,
        packaging: line.packaging || undefined,
        enrichment: line.enrichment || undefined
      }))
    };

    const result = await offerService.createOffer(input);

    // PILOT LOOP 1.0: Send email notification if offer is linked to a request
    // Fail-safe: Email failure doesn't block offer creation
    if (request_id) {
      try {
        // Get restaurant email
        const restaurantEmail = await getRestaurantEmail(restaurant_id, tenantId);

        if (restaurantEmail) {
          // Fetch request and supplier details for email
          const { data: requestData } = await supabase
            .from('requests')
            .select('id, fritext')
            .eq('id', request_id)
            .single();

          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('namn')
            .eq('id', supplier_id || '')
            .single();

          const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('name')
            .eq('id', restaurant_id)
            .single();

          // Generate and send email
          const emailContent = offerCreatedEmail({
            restaurantName: restaurantData?.name || 'Er restaurang',
            requestTitle: requestData?.fritext || 'Din förfrågan',
            requestId: request_id,
            offerId: result.offer_id,
            offerTitle: title || 'Ny offert',
            supplierName: supplierData?.namn || 'Leverantör',
            linesCount: lines.length
          });

          const emailResult = await sendEmail({
            to: restaurantEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          });

          // Log email event
          await logEmailEvent(tenantId, result.offer_id, {
            type: 'OFFER_CREATED',
            to: restaurantEmail,
            success: emailResult.success,
            error: emailResult.error
          });

          if (!emailResult.success) {
            console.warn(`⚠️  Failed to send offer created email: ${emailResult.error}`);
          }
        } else {
          console.warn(`⚠️  No email found for restaurant ${restaurant_id}`);
        }
      } catch (emailError: any) {
        console.error('Error sending offer created email:', emailError);
        // Don't throw - email is not critical
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating offer:', error);

    if (error.message?.includes('SECURITY_VIOLATION')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error.message?.includes('Foreign key violation')) {
      return NextResponse.json(
        { error: 'Invalid reference: restaurant, request, or supplier not found' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
