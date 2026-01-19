/**
 * PATCH /api/requests/[requestId]/adjust-quantity
 *
 * Adjust wine quantity in a request to meet MOQ requirements.
 * Used when a restaurant wants to increase their order to meet minimum quantity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface AdjustQuantityRequest {
  wineId: string;         // ID of the supplier_wine or request_wine
  newQuantity: number;    // New quantity to set
}

export interface AdjustQuantityResponse {
  success: boolean;
  request?: {
    id: string;
    updatedAt: string;
  };
  wine?: {
    id: string;
    originalQuantity: number;
    newQuantity: number;
  };
  error?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { requestId: string } }
): Promise<NextResponse<AdjustQuantityResponse>> {
  try {
    const { requestId } = params;
    const body: AdjustQuantityRequest = await request.json();
    const { wineId, newQuantity } = body;

    // Validate inputs
    if (!wineId) {
      return NextResponse.json(
        { success: false, error: 'Wine ID saknas' },
        { status: 400 }
      );
    }

    if (!newQuantity || newQuantity <= 0 || !Number.isInteger(newQuantity)) {
      return NextResponse.json(
        { success: false, error: 'Ogiltig kvantitet. Måste vara ett positivt heltal.' },
        { status: 400 }
      );
    }

    // Verify request exists and is in a state that allows modification
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('id, status, restaurant_id')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json(
        { success: false, error: 'Förfrågan hittades inte' },
        { status: 404 }
      );
    }

    // Only allow adjustment for requests that haven't been completed
    const allowedStatuses = ['draft', 'sent', 'received_offers', 'pending'];
    if (!allowedStatuses.includes(requestData.status)) {
      return NextResponse.json(
        { success: false, error: `Kan inte ändra kvantitet för förfrågan med status "${requestData.status}"` },
        { status: 400 }
      );
    }

    // Check if request_wines table exists and has this wine
    const { data: requestWine, error: requestWineError } = await supabase
      .from('request_wines')
      .select('id, requested_quantity, adjusted_quantity, supplier_wine_id')
      .eq('request_id', requestId)
      .or(`id.eq.${wineId},supplier_wine_id.eq.${wineId}`)
      .single();

    if (requestWine) {
      // Update request_wines record
      const originalQuantity = requestWine.adjusted_quantity || requestWine.requested_quantity;

      const { error: updateError } = await supabase
        .from('request_wines')
        .update({
          adjusted_quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestWine.id);

      if (updateError) {
        console.error('[Adjust Quantity] Update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Kunde inte uppdatera kvantitet' },
          { status: 500 }
        );
      }

      // Update request's updated_at
      await supabase
        .from('requests')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', requestId);

      return NextResponse.json({
        success: true,
        request: {
          id: requestId,
          updatedAt: new Date().toISOString(),
        },
        wine: {
          id: requestWine.id,
          originalQuantity,
          newQuantity,
        },
      });
    }

    // Fallback: Try to update quantity field directly on request if it's stored there
    // This handles legacy data structure where quantity might be on the request itself
    const { data: existingRequest, error: fetchError } = await supabase
      .from('requests')
      .select('quantity, wine_id')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: 'Kunde inte hämta förfrågan' },
        { status: 500 }
      );
    }

    // Check if this is the right wine
    if (existingRequest.wine_id && existingRequest.wine_id !== wineId) {
      return NextResponse.json(
        { success: false, error: 'Vinet matchar inte förfrågan' },
        { status: 400 }
      );
    }

    const originalQuantity = existingRequest.quantity || 0;

    // Update quantity on request
    const { error: updateRequestError } = await supabase
      .from('requests')
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateRequestError) {
      // If quantity column doesn't exist, create a request_wines entry instead
      const { error: insertError } = await supabase
        .from('request_wines')
        .insert({
          request_id: requestId,
          supplier_wine_id: wineId,
          requested_quantity: originalQuantity || newQuantity,
          adjusted_quantity: newQuantity,
        });

      if (insertError) {
        console.error('[Adjust Quantity] Insert error:', insertError);
        return NextResponse.json(
          { success: false, error: 'Kunde inte spara kvantitetsjustering' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      request: {
        id: requestId,
        updatedAt: new Date().toISOString(),
      },
      wine: {
        id: wineId,
        originalQuantity,
        newQuantity,
      },
    });

  } catch (error: any) {
    console.error('[Adjust Quantity] Error:', error);
    return NextResponse.json(
      { success: false, error: `Serverfel: ${error.message}` },
      { status: 500 }
    );
  }
}
