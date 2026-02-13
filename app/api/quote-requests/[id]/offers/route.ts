import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';

/**
 * POST /api/quote-requests/[id]/offers
 *
 * Creates a multi-line offer for a specific quote request.
 * One offer per supplier, containing all wines (lines).
 *
 * NEW body (multi-line):
 * {
 *   supplierId: string;
 *   deliveryDate: string;
 *   leadTimeDays: number;
 *   is_franco?: boolean;
 *   shipping_cost_sek?: number;
 *   shipping_notes?: string;
 *   notes?: string;
 *   expiresAt?: string;
 *   minTotalQuantity?: number;  // Supplier MOQ for whole offer
 *   lines: [{
 *     supplierWineId: string;
 *     offeredPriceExVatSek: number;
 *     quantity: number;
 *   }]
 * }
 *
 * LEGACY body (single-wine, backwards compat):
 * {
 *   supplierId, supplierWineId, offeredPriceExVatSek, quantity, deliveryDate, leadTimeDays, ...
 * }
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const requestId = params.id;
    const body = await req.json();
    const { supplierId, deliveryDate, leadTimeDays } = body;

    // Backwards compat: convert single-wine body to lines[]
    let lines: Array<{ supplierWineId: string; offeredPriceExVatSek: number; quantity: number }>;

    if (body.lines && Array.isArray(body.lines)) {
      lines = body.lines;
    } else if (body.supplierWineId) {
      // Legacy single-wine format
      lines = [{
        supplierWineId: body.supplierWineId,
        offeredPriceExVatSek: body.offeredPriceExVatSek,
        quantity: body.quantity,
      }];
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: either lines[] or supplierWineId' },
        { status: 400 }
      );
    }

    if (!supplierId || !deliveryDate || leadTimeDays === undefined) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['supplierId', 'deliveryDate', 'leadTimeDays', 'lines[]'],
        },
        { status: 400 }
      );
    }

    if (!lines.length) {
      return NextResponse.json(
        { error: 'lines[] must contain at least one wine' },
        { status: 400 }
      );
    }

    // Auth: verify supplier ownership
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actor.supplier_id || actor.supplier_id !== supplierId) {
      return NextResponse.json(
        { error: 'Forbidden: Can only create offers for your own supplier' },
        { status: 403 }
      );
    }

    const { userClient } = await createRouteClients();

    // Validate lead time and date
    if (leadTimeDays < 0) {
      return NextResponse.json({ error: 'Lead time must be non-negative' }, { status: 400 });
    }
    const deliveryDateObj = new Date(deliveryDate);
    if (isNaN(deliveryDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid delivery date format' }, { status: 400 });
    }

    // 1. Verify quote request exists
    const { data: quoteRequest, error: requestError } = await userClient
      .from('requests')
      .select('id, restaurant_id')
      .eq('id', requestId)
      .single();

    if (requestError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 });
    }

    // 2. Verify supplier exists and is active
    const { data: supplier, error: supplierError } = await userClient
      .from('suppliers')
      .select('id, type, is_active')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }
    if (!supplier.is_active) {
      return NextResponse.json({ error: 'Supplier is not active' }, { status: 403 });
    }

    // 3. Validate all wines belong to this supplier
    const wineIds = lines.map(l => l.supplierWineId);
    const { data: supplierWines, error: winesError } = await userClient
      .from('supplier_wines')
      .select('id, supplier_id, name, producer, price_ex_vat_sek, vat_rate, moq, vintage, country, region')
      .in('id', wineIds);

    if (winesError || !supplierWines) {
      return NextResponse.json({ error: 'Failed to fetch wines' }, { status: 500 });
    }

    const wineMap = new Map(supplierWines.map(w => [w.id, w]));

    // Validate each line
    for (const line of lines) {
      const wine = wineMap.get(line.supplierWineId);
      if (!wine) {
        return NextResponse.json(
          { error: `Wine not found in catalog: ${line.supplierWineId}` },
          { status: 404 }
        );
      }
      if (wine.supplier_id !== supplierId) {
        return NextResponse.json(
          { error: `Wine ${wine.name} does not belong to this supplier` },
          { status: 403 }
        );
      }
      if (line.offeredPriceExVatSek <= 0) {
        return NextResponse.json(
          { error: `Price must be > 0 for ${wine.name}` },
          { status: 400 }
        );
      }
      if (line.quantity <= 0) {
        return NextResponse.json(
          { error: `Quantity must be > 0 for ${wine.name}` },
          { status: 400 }
        );
      }
      if (wine.moq && line.quantity < wine.moq) {
        return NextResponse.json(
          { error: `Quantity for ${wine.name} must be at least ${wine.moq} (MOQ)` },
          { status: 400 }
        );
      }
    }

    // 4. Validate assignment exists and is not expired
    const { data: assignment, error: assignmentError } = await userClient
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', requestId)
      .eq('supplier_id', supplierId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'No valid assignment found', details: 'You can only create offers for assigned quote requests.' },
        { status: 403 }
      );
    }

    if (new Date(assignment.expires_at) < new Date() || assignment.status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Assignment has expired', expiresAt: assignment.expires_at },
        { status: 403 }
      );
    }

    // 5. Parse shipping
    const isFranco = body.is_franco === true;
    const expiresAt = body.expiresAt
      ? new Date(body.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 6. Create the offer (header)
    const offerInsert: Record<string, any> = {
      tenant_id: tenantId,
      restaurant_id: quoteRequest.restaurant_id,
      request_id: requestId,
      supplier_id: supplierId,
      supplier_wine_id: null, // Multi-line: no single wine
      delivery_date: deliveryDateObj.toISOString().split('T')[0],
      lead_time_days: leadTimeDays,
      notes: body.notes || null,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      is_franco: isFranco,
      min_total_quantity: body.minTotalQuantity || null,
    };

    if (body.shipping_cost_sek !== undefined && !isFranco) {
      offerInsert.shipping_cost_sek = body.shipping_cost_sek;
    }
    if (body.shipping_notes !== undefined) {
      offerInsert.shipping_notes = body.shipping_notes;
    }

    const { data: offer, error: offerError } = await userClient
      .from('offers')
      .insert(offerInsert)
      .select('*')
      .single();

    if (offerError) {
      console.error('Failed to create offer:', offerError);
      return NextResponse.json(
        { error: 'Failed to create offer', details: offerError.message },
        { status: 500 }
      );
    }

    // 7. Create offer_lines
    const offerLines = lines.map((line, index) => {
      const wine = wineMap.get(line.supplierWineId)!;
      return {
        tenant_id: tenantId,
        offer_id: offer.id,
        line_no: index + 1,
        name: wine.name,
        vintage: wine.vintage || null,
        producer: wine.producer || null,
        country: wine.country || null,
        region: wine.region || null,
        quantity: line.quantity,
        offered_unit_price_ore: Math.round(line.offeredPriceExVatSek * 100),
        price_ex_vat_sek: line.offeredPriceExVatSek,
        supplier_wine_id: line.supplierWineId,
      };
    });

    const { error: linesError } = await userClient
      .from('offer_lines')
      .insert(offerLines);

    if (linesError) {
      // Rollback: delete the offer header
      await userClient.from('offers').delete().eq('id', offer.id);
      console.error('Failed to create offer lines:', linesError);
      return NextResponse.json(
        { error: 'Failed to create offer lines', details: linesError.message },
        { status: 500 }
      );
    }

    // 8. Auto-update assignment status to RESPONDED
    if (assignment.status !== 'RESPONDED') {
      await userClient
        .from('quote_request_assignments')
        .update({
          status: 'RESPONDED',
          responded_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);
    }

    // 9. Build response
    const responseLines = lines.map((line, index) => {
      const wine = wineMap.get(line.supplierWineId)!;
      const totalExVat = line.offeredPriceExVatSek * line.quantity;
      return {
        lineNo: index + 1,
        supplierWineId: line.supplierWineId,
        wineName: wine.name,
        producer: wine.producer,
        offeredPriceExVatSek: line.offeredPriceExVatSek,
        quantity: line.quantity,
        totalExVatSek: parseFloat(totalExVat.toFixed(2)),
      };
    });

    const totalWinePrice = responseLines.reduce((sum, l) => sum + l.totalExVatSek, 0);
    const shippingCost = isFranco ? 0 : (body.shipping_cost_sek || 0);
    const totalWithShipping = totalWinePrice + shippingCost;

    return NextResponse.json(
      {
        offer: {
          id: offer.id,
          requestId: offer.request_id,
          supplierId: offer.supplier_id,
          deliveryDate: offer.delivery_date,
          leadTimeDays: offer.lead_time_days,
          notes: offer.notes,
          status: offer.status,
          expiresAt: offer.expires_at,
          createdAt: offer.created_at,
          isFranco,
          shippingCostSek: body.shipping_cost_sek ?? null,
          shippingNotes: offer.shipping_notes ?? null,
          minTotalQuantity: offer.min_total_quantity,
          lines: responseLines,
          totalWinePrice: parseFloat(totalWinePrice.toFixed(2)),
          totalWithShipping: parseFloat(totalWithShipping.toFixed(2)),
        },
        message: 'Offer created successfully',
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Offer creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quote-requests/[id]/offers
 *
 * Lists all offers for a quote request, grouped per supplier with nested lines.
 * Handles both new multi-line offers and legacy single-wine offers.
 *
 * Response:
 * {
 *   offers: Array<{
 *     id, supplierId, supplierName, supplierEmail,
 *     deliveryDate, leadTimeDays, isFranco, shippingCostSek,
 *     matchScore, matchReasons, minTotalQuantity,
 *     lines: Array<{ supplierWineId, wineName, producer, offeredPriceExVatSek, quantity, totalExVatSek, accepted }>,
 *     totalExVatSek, totalIncVatSek, totalWithShippingExVat,
 *     ...
 *   }>;
 *   summary: { total, active, expired };
 * }
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const requestId = params.id;
    const { searchParams } = new URL(req.url);
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const { userClient } = await createRouteClients();

    // Verify request exists AND get restaurant ownership
    const { data: quoteRequest, error: requestError } = await userClient
      .from('requests')
      .select('id, restaurant_id')
      .eq('id', requestId)
      .single();

    if (requestError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 });
    }

    // ACCESS CONTROL
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = actorService.hasRole(actor, 'ADMIN');
    const isOwner = actor.restaurant_id && actor.restaurant_id === quoteRequest.restaurant_id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: Only the restaurant owner or admin can view offers' },
        { status: 403 }
      );
    }

    // Get all offers for this request WITH offer_lines join
    const { data: offers, error: offersError } = await userClient
      .from('offers')
      .select(`
        id,
        request_id,
        supplier_id,
        supplier_wine_id,
        offered_price_ex_vat_sek,
        vat_rate,
        quantity,
        delivery_date,
        lead_time_days,
        notes,
        status,
        expires_at,
        created_at,
        is_franco,
        shipping_cost_sek,
        shipping_notes,
        min_total_quantity,
        suppliers (
          namn,
          kontakt_email
        ),
        offer_lines (
          id,
          line_no,
          name,
          vintage,
          producer,
          country,
          region,
          quantity,
          offered_unit_price_ore,
          price_ex_vat_sek,
          supplier_wine_id,
          accepted
        )
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (offersError) {
      console.error('Failed to fetch offers:', offersError);
      return NextResponse.json(
        { error: 'Failed to fetch offers', details: offersError.message },
        { status: 500 }
      );
    }

    // Get assignments for match scores
    const supplierIds = [...new Set((offers || []).map(o => o.supplier_id).filter(Boolean))];
    const { data: assignments } = await userClient
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', requestId)
      .in('supplier_id', supplierIds);

    const assignmentMap = new Map(
      (assignments || []).map(a => [a.supplier_id, a])
    );

    // Get sponsored categories
    const sponsoredCategoriesMap = new Map<string, string[]>();
    for (const sid of supplierIds) {
      try {
        const categories = await sponsoredSlotsService.getSupplierSponsoredCategories(sid);
        sponsoredCategoriesMap.set(sid, categories);
      } catch {
        sponsoredCategoriesMap.set(sid, []);
      }
    }

    // For legacy offers with supplier_wine_id but no offer_lines, fetch wine data
    const legacyWineIds = (offers || [])
      .filter(o => o.supplier_wine_id && (!o.offer_lines || (o.offer_lines as any[]).length === 0))
      .map(o => o.supplier_wine_id)
      .filter(Boolean);

    let legacyWineMap = new Map<string, any>();
    if (legacyWineIds.length > 0) {
      const { data: legacyWines } = await userClient
        .from('supplier_wines')
        .select('id, name, producer, country, region, vintage')
        .in('id', legacyWineIds);
      if (legacyWines) {
        legacyWineMap = new Map(legacyWines.map(w => [w.id, w]));
      }
    }

    // Transform offers
    const transformedOffers = (offers || []).map(offer => {
      const assignment = assignmentMap.get(offer.supplier_id);
      const offerLines = (offer.offer_lines as any[]) || [];

      // Build lines — either from offer_lines or from legacy single-wine fields
      let linesData: Array<{
        id: string | null;
        supplierWineId: string | null;
        wineName: string;
        producer: string | null;
        country: string | null;
        region: string | null;
        vintage: number | null;
        offeredPriceExVatSek: number;
        quantity: number;
        totalExVatSek: number;
        accepted: boolean | null;
      }>;

      if (offerLines.length > 0) {
        // New multi-line offer
        linesData = offerLines.map(line => {
          const priceExVat = line.price_ex_vat_sek
            ? parseFloat(line.price_ex_vat_sek)
            : (line.offered_unit_price_ore ? line.offered_unit_price_ore / 100 : 0);
          return {
            id: line.id,
            supplierWineId: line.supplier_wine_id,
            wineName: line.name,
            producer: line.producer,
            country: line.country,
            region: line.region,
            vintage: line.vintage,
            offeredPriceExVatSek: priceExVat,
            quantity: line.quantity,
            totalExVatSek: parseFloat((priceExVat * line.quantity).toFixed(2)),
            accepted: line.accepted,
          };
        });
      } else if (offer.supplier_wine_id) {
        // Legacy single-wine offer — build virtual line
        const wine = legacyWineMap.get(offer.supplier_wine_id);
        const priceExVat = offer.offered_price_ex_vat_sek
          ? offer.offered_price_ex_vat_sek / 100
          : 0;
        linesData = [{
          id: null,
          supplierWineId: offer.supplier_wine_id,
          wineName: wine?.name || 'Okänt vin',
          producer: wine?.producer || null,
          country: wine?.country || null,
          region: wine?.region || null,
          vintage: wine?.vintage || null,
          offeredPriceExVatSek: priceExVat,
          quantity: offer.quantity || 0,
          totalExVatSek: parseFloat((priceExVat * (offer.quantity || 0)).toFixed(2)),
          accepted: offer.status === 'accepted' || offer.status === 'ACCEPTED' ? true : null,
        }];
      } else {
        linesData = [];
      }

      // Calculate totals from lines
      const totalExVat = linesData.reduce((sum, l) => sum + l.totalExVatSek, 0);
      const vatRate = offer.vat_rate || 25;
      const totalIncVat = totalExVat * (1 + vatRate / 100);

      const isFranco = offer.is_franco ?? false;
      const shippingCostSek = offer.shipping_cost_sek ?? null;
      const shippingCost = isFranco ? 0 : (shippingCostSek || 0);
      const totalWithShippingExVat = totalExVat + shippingCost;
      const totalWithShippingIncVat = totalIncVat + (shippingCost * 1.25);

      const isExpired = assignment
        ? new Date(assignment.expires_at) < new Date() || assignment.status === 'EXPIRED'
        : false;

      const sponsoredCategories = sponsoredCategoriesMap.get(offer.supplier_id) || [];

      return {
        id: offer.id,
        requestId: offer.request_id,
        supplierId: offer.supplier_id,
        supplierName: (offer.suppliers as any)?.namn || 'Okänd leverantör',
        supplierEmail: (offer.suppliers as any)?.kontakt_email,
        // Lines
        lines: linesData,
        // Totals
        totalExVatSek: parseFloat(totalExVat.toFixed(2)),
        totalIncVatSek: parseFloat(totalIncVat.toFixed(2)),
        vatRate,
        isFranco,
        shippingCostSek,
        shippingNotes: offer.shipping_notes ?? null,
        totalWithShippingExVat: parseFloat(totalWithShippingExVat.toFixed(2)),
        totalWithShippingIncVat: parseFloat(totalWithShippingIncVat.toFixed(2)),
        // Delivery
        deliveryDate: offer.delivery_date,
        estimatedDeliveryDate: offer.delivery_date,
        leadTimeDays: offer.lead_time_days,
        // Assignment data
        matchScore: assignment?.match_score || 0,
        matchReasons: assignment?.match_reasons || [],
        assignmentStatus: assignment?.status || 'unknown',
        isExpired,
        // Supplier MOQ
        minTotalQuantity: offer.min_total_quantity,
        // Sponsored info
        isSponsored: sponsoredCategories.length > 0,
        sponsoredCategories,
        // Metadata
        notes: offer.notes,
        status: offer.status,
        expiresAt: offer.expires_at,
        createdAt: offer.created_at,
      };
    });

    // Filter expired
    let filteredOffers = transformedOffers;
    if (!includeExpired) {
      filteredOffers = transformedOffers.filter(o => !o.isExpired);
    }

    // Sort by match score (best first)
    filteredOffers.sort((a, b) => b.matchScore - a.matchScore);

    const summary = {
      total: transformedOffers.length,
      active: transformedOffers.filter(o => !o.isExpired).length,
      expired: transformedOffers.filter(o => o.isExpired).length,
    };

    return NextResponse.json({ offers: filteredOffers, summary });

  } catch (error: any) {
    console.error('Offers listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
