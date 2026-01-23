/**
 * REQUESTS API - GET BY ID
 *
 * GET /api/requests/[id]
 *
 * Get request details + related offers
 *
 * Response:
 * {
 *   request: {
 *     id, restaurant_id, title, freetext, budget_sek, quantity_bottles,
 *     delivery_date_requested, status, accepted_offer_id, created_at, updated_at
 *   },
 *   offers: [{
 *     id, status, supplier_id, title, currency, created_at, updated_at,
 *     lines_count, total_ore
 *   }]
 * }
 *
 * Security:
 * - Tenant isolation enforced
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: requestId } = params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // SECURITY: Tenant-scope via restaurants.tenant_id JOIN
    // Step 1: Fetch request with restaurant info
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('id, restaurant_id, fritext, budget_per_flaska, antal_flaskor, leverans_senast, specialkrav, status, accepted_offer_id, created_at')
      .eq('id', requestId)
      .single();

    if (requestError) {
      if (requestError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }
      throw new Error(`Failed to fetch request: ${requestError.message}`);
    }

    // MVP: Skip tenant verification (single tenant setup)

    // Map Swedish column names to English API response format
    const mappedRequest = {
      id: requestData.id,
      restaurant_id: requestData.restaurant_id,
      title: null, // Not in schema
      freetext: requestData.fritext || null,
      budget_sek: requestData.budget_per_flaska || null,
      quantity_bottles: requestData.antal_flaskor || null,
      delivery_date_requested: requestData.leverans_senast || null,
      specialkrav: requestData.specialkrav || null,
      status: requestData.status || 'OPEN',
      accepted_offer_id: requestData.accepted_offer_id || null,
      created_at: requestData.created_at
    };

    // Fetch related offers
    // SECURITY: Filter offers by tenant_id to prevent cross-tenant data leakage
    // requests table doesn't have tenant_id, but offers table does
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id, status, supplier_id, title, currency, created_at, updated_at, accepted_at, locked_at')
      .eq('request_id', requestId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (offersError) {
      throw new Error(`Failed to fetch offers: ${offersError.message}`);
    }

    // Get lines count and total per offer
    const offerIds = offers?.map(o => o.id) || [];
    const offersWithDetails = await Promise.all(
      (offers || []).map(async (offer) => {
        const { data: lines } = await supabase
          .from('offer_lines')
          .select('quantity, offered_unit_price_ore')
          .eq('offer_id', offer.id)
          .eq('tenant_id', tenantId);

        const lines_count = lines?.length || 0;
        const total_ore = lines?.reduce((sum, line) => 
          sum + (line.offered_unit_price_ore || 0) * line.quantity, 0
        ) || 0;

        return {
          ...offer,
          lines_count,
          total_ore
        };
      })
    );

    return NextResponse.json(
      {
        request: mappedRequest,
        offers: offersWithDetails
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error fetching request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
