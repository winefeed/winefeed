import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/quote-requests/[id]/offers
 *
 * Creates an offer for a specific quote request.
 * Authenticated endpoint - requires supplier user auth.
 *
 * Request body:
 * {
 *   supplierId: string;  // Must match authenticated supplier
 *   supplierWineId: string;  // Wine from supplier's catalog
 *   offeredPriceExVatSek: number;  // May differ from catalog price
 *   quantity: number;  // Number of bottles
 *   deliveryDate: string;  // ISO date
 *   leadTimeDays: number;
 *   notes?: string;
 *   expiresAt?: string;  // ISO datetime, default: 7 days
 * }
 *
 * Response:
 * {
 *   offer: Offer;
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
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

    // Validate required fields
    const {
      supplierId,
      supplierWineId,
      offeredPriceExVatSek,
      quantity,
      deliveryDate,
      leadTimeDays,
      // Shipping fields
      is_franco,
      shipping_cost_sek,
      shipping_notes,
    } = body;

    if (!supplierId || !supplierWineId || !offeredPriceExVatSek ||
        !quantity || !deliveryDate || leadTimeDays === undefined) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: [
            'supplierId',
            'supplierWineId',
            'offeredPriceExVatSek',
            'quantity',
            'deliveryDate',
            'leadTimeDays',
          ],
        },
        { status: 400 }
      );
    }

    // Verify supplierId matches authenticated user's supplier
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actor.supplier_id || actor.supplier_id !== supplierId) {
      return NextResponse.json(
        { error: 'Forbidden: Can only create offers for your own supplier' },
        { status: 403 }
      );
    }

    // Parse shipping
    const isFranco = is_franco === true;

    // Validate numeric fields
    if (offeredPriceExVatSek <= 0) {
      return NextResponse.json(
        { error: 'Offered price must be greater than 0' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    if (leadTimeDays < 0) {
      return NextResponse.json(
        { error: 'Lead time must be non-negative' },
        { status: 400 }
      );
    }

    // Validate date format
    const deliveryDateObj = new Date(deliveryDate);
    if (isNaN(deliveryDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid delivery date format' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Verify quote request exists
    const { data: quoteRequest, error: requestError } = await supabase
      .from('requests')
      .select('id, restaurant_id')
      .eq('id', requestId)
      .single();

    if (requestError || !quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // 2. Verify supplier exists and is active
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, type, is_active')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    if (!supplier.is_active) {
      return NextResponse.json(
        { error: 'Supplier is not active' },
        { status: 403 }
      );
    }

    // 3. Verify wine belongs to this supplier
    const { data: supplierWine, error: wineError } = await supabase
      .from('supplier_wines')
      .select('id, supplier_id, name, price_ex_vat_sek, vat_rate, moq')
      .eq('id', supplierWineId)
      .single();

    if (wineError || !supplierWine) {
      return NextResponse.json(
        { error: 'Wine not found in catalog' },
        { status: 404 }
      );
    }

    if (supplierWine.supplier_id !== supplierId) {
      return NextResponse.json(
        { error: 'Wine does not belong to this supplier (tenant isolation violation)' },
        { status: 403 }
      );
    }

    // 4. Validate minimum order quantity
    if (quantity < supplierWine.moq) {
      return NextResponse.json(
        {
          error: `Quantity must be at least ${supplierWine.moq} (minimum order quantity)`,
        },
        { status: 400 }
      );
    }

    // 5. Compliance validation: SWEDISH_IMPORTER cannot have EU-specific fields
    if (supplier.type === 'SWEDISH_IMPORTER') {
      // For Swedish importers, ensure no EU compliance fields are included
      // (For now, this is a placeholder - EU fields would be added to schema later)
      // Example: if (body.emcsArcNumber) { return error }
    }

    // NEW: 5.5. Validate assignment exists and is not expired (ACCESS CONTROL)
    const { data: assignment, error: assignmentError } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', requestId)
      .eq('supplier_id', supplierId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        {
          error: 'No valid assignment found',
          details: 'You can only create offers for quote requests you have been assigned to.',
        },
        { status: 403 }
      );
    }

    // Check if assignment is expired
    const assignmentExpired = new Date(assignment.expires_at) < new Date();
    if (assignmentExpired || assignment.status === 'EXPIRED') {
      return NextResponse.json(
        {
          error: 'Assignment has expired',
          expiresAt: assignment.expires_at,
          details: 'The deadline to respond to this quote request has passed.',
        },
        { status: 403 }
      );
    }

    // 6. Set default expiration (7 days from now)
    const expiresAt = body.expiresAt
      ? new Date(body.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 7. Create the offer
    // Build insert object (shipping fields are optional - may not exist in DB yet)
    const insertData: Record<string, any> = {
      request_id: requestId,
      supplier_id: supplierId,
      supplier_wine_id: supplierWineId,
      offered_price_ex_vat_sek: Math.round(offeredPriceExVatSek * 100), // Convert to öre
      vat_rate: supplierWine.vat_rate,
      quantity,
      delivery_date: deliveryDateObj.toISOString().split('T')[0], // Date only
      lead_time_days: leadTimeDays,
      notes: body.notes || null,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    };

    // Only add shipping fields if explicitly provided (columns may not exist in older DBs)
    if (is_franco !== undefined) {
      insertData.is_franco = isFranco;
    }
    if (shipping_cost_sek !== undefined && !isFranco) {
      insertData.shipping_cost_sek = shipping_cost_sek;
    }
    if (shipping_notes !== undefined) {
      insertData.shipping_notes = shipping_notes;
    }

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert(insertData)
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
        created_at
      `)
      .single();

    if (offerError) {
      console.error('Failed to create offer:', offerError);
      return NextResponse.json(
        { error: 'Failed to create offer', details: offerError.message },
        { status: 500 }
      );
    }

    // NEW: 7.5. Auto-update assignment status to RESPONDED
    if (assignment.status !== 'RESPONDED') {
      await supabase
        .from('quote_request_assignments')
        .update({
          status: 'RESPONDED',
          responded_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);
    }

    // 8. Return offer with wine details and shipping
    const priceExVat = offer.offered_price_ex_vat_sek / 100;
    const totalWinePrice = priceExVat * offer.quantity;
    // Shipping fields may not exist in older DBs
    const offerIsFranco = (offer as any).is_franco ?? isFranco ?? false;
    const offerShippingCost = (offer as any).shipping_cost_sek ?? shipping_cost_sek ?? null;
    const shippingCost = offerIsFranco ? 0 : (offerShippingCost || 0);
    const totalWithShipping = totalWinePrice + shippingCost;

    return NextResponse.json(
      {
        offer: {
          id: offer.id,
          requestId: offer.request_id,
          supplierId: offer.supplier_id,
          supplierWineId: offer.supplier_wine_id,
          wineName: supplierWine.name,
          offeredPriceExVatSek: priceExVat, // Convert back to SEK
          vatRate: offer.vat_rate,
          quantity: offer.quantity,
          deliveryDate: offer.delivery_date,
          leadTimeDays: offer.lead_time_days,
          notes: offer.notes,
          status: offer.status,
          expiresAt: offer.expires_at,
          createdAt: offer.created_at,
          // Shipping info (may not exist in older DBs)
          isFranco: offerIsFranco,
          shippingCostSek: offerShippingCost,
          shippingNotes: (offer as any).shipping_notes ?? shipping_notes ?? null,
          // Calculated totals
          totalWinePrice,
          totalWithShipping,
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
 * Lists all offers for a specific quote request with comparison data.
 * **ACCESS CONTROL:** Only restaurant that owns the quote request can see offers.
 *
 * Response includes:
 * - Supplier details
 * - Pricing with VAT calculations
 * - Match score and reasons from assignment
 * - Assignment status (SENT/VIEWED/RESPONDED/EXPIRED)
 * - Sorted by match score (best first)
 *
 * Response:
 * {
 *   offers: Array<OfferWithComparison>;
 *   summary: { total, active, expired };
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify request exists AND get restaurant ownership
    const { data: quoteRequest, error: requestError } = await supabase
      .from('requests')
      .select('id, restaurant_id')
      .eq('id', requestId)
      .single();

    if (requestError || !quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // ACCESS CONTROL - Restaurant owner or admin can see offers
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = actorService.hasRole(actor, 'ADMIN');
    const isOwner = actor.restaurant_id && actor.restaurant_id === quoteRequest.restaurant_id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: Only the restaurant owner or admin can view offers' },
        { status: 403 }
      );
    }

    // Get all offers for this request
    // Note: shipping columns (is_franco, shipping_cost_sek, shipping_notes) may not exist in older DBs
    const { data: offers, error: offersError } = await supabase
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
        suppliers (
          namn,
          kontakt_email
        ),
        supplier_wines (
          name,
          producer,
          country,
          region,
          vintage
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

    // NEW: Get assignments for these offers to include match scores
    const supplierIds = (offers || []).map(o => o.supplier_id);
    const { data: assignments } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', requestId)
      .in('supplier_id', supplierIds);

    const assignmentMap = new Map(
      (assignments || []).map(a => [a.supplier_id, a])
    );

    // NEW: Get sponsored categories for each supplier
    const sponsoredCategoriesMap = new Map<string, string[]>();
    for (const supplierId of supplierIds) {
      try {
        const categories = await sponsoredSlotsService.getSupplierSponsoredCategories(supplierId);
        sponsoredCategoriesMap.set(supplierId, categories);
      } catch {
        sponsoredCategoriesMap.set(supplierId, []);
      }
    }

    // NEW: Transform data with comparison fields
    const transformedOffers = (offers || []).map(offer => {
      const assignment = assignmentMap.get(offer.supplier_id);
      const priceExVatSek = offer.offered_price_ex_vat_sek / 100;
      const vatAmount = priceExVatSek * (offer.vat_rate / 100);
      const priceIncVatSek = priceExVatSek + vatAmount;
      const totalExVat = priceExVatSek * offer.quantity;
      const totalIncVat = priceIncVatSek * offer.quantity;

      // Shipping calculations (columns may not exist in older DBs)
      const isFranco = (offer as any).is_franco ?? false;
      const shippingCostSek = (offer as any).shipping_cost_sek ?? null;
      const shippingCost = isFranco ? 0 : (shippingCostSek || 0);
      const totalWithShippingExVat = totalExVat + shippingCost;
      const totalWithShippingIncVat = totalIncVat + shippingCost;
      const shippingNotes = (offer as any).shipping_notes ?? null;

      // Calculate estimated delivery date
      const estimatedDeliveryDate = new Date(offer.delivery_date);

      // Check if expired
      const isExpired = assignment
        ? new Date(assignment.expires_at) < new Date() || assignment.status === 'EXPIRED'
        : false;

      // Get sponsored categories for this supplier
      const sponsoredCategories = sponsoredCategoriesMap.get(offer.supplier_id) || [];
      const isSponsored = sponsoredCategories.length > 0;

      return {
        id: offer.id,
        requestId: offer.request_id,
        supplierId: offer.supplier_id,
        supplierName: (offer.suppliers as any)?.namn || 'Okänd leverantör',
        supplierEmail: (offer.suppliers as any)?.kontakt_email,
        wine: {
          id: offer.supplier_wine_id,
          name: (offer.supplier_wines as any)?.name || 'Okänt vin',
          producer: (offer.supplier_wines as any)?.producer,
          country: (offer.supplier_wines as any)?.country,
          region: (offer.supplier_wines as any)?.region,
          vintage: (offer.supplier_wines as any)?.vintage,
        },
        // Pricing with comparisons
        offeredPriceExVatSek: priceExVatSek,
        vatRate: offer.vat_rate,
        priceIncVatSek: parseFloat(priceIncVatSek.toFixed(2)),
        quantity: offer.quantity,
        totalExVatSek: parseFloat(totalExVat.toFixed(2)),
        totalIncVatSek: parseFloat(totalIncVat.toFixed(2)),
        // Shipping info (may not exist in older DBs)
        isFranco,
        shippingCostSek,
        shippingNotes,
        totalWithShippingExVat: parseFloat(totalWithShippingExVat.toFixed(2)),
        totalWithShippingIncVat: parseFloat(totalWithShippingIncVat.toFixed(2)),
        // Delivery
        deliveryDate: offer.delivery_date,
        estimatedDeliveryDate: estimatedDeliveryDate.toISOString().split('T')[0],
        leadTimeDays: offer.lead_time_days,
        // Assignment data (for sorting and comparison)
        matchScore: assignment?.match_score || 0,
        matchReasons: assignment?.match_reasons || [],
        assignmentStatus: assignment?.status || 'unknown',
        isExpired,
        // Sponsored info
        isSponsored,
        sponsoredCategories,
        // Other
        notes: offer.notes,
        status: offer.status,
        expiresAt: offer.expires_at,
        createdAt: offer.created_at,
      };
    });

    // Filter out expired if not requested
    let filteredOffers = transformedOffers;
    if (!includeExpired) {
      filteredOffers = transformedOffers.filter(o => !o.isExpired);
    }

    // Sort by match score (best first)
    filteredOffers.sort((a, b) => b.matchScore - a.matchScore);

    // Summary
    const summary = {
      total: transformedOffers.length,
      active: transformedOffers.filter(o => !o.isExpired).length,
      expired: transformedOffers.filter(o => o.isExpired).length,
    };

    return NextResponse.json({
      offers: filteredOffers,
      summary,
    });

  } catch (error: any) {
    console.error('Offers listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
