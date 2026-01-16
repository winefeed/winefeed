import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration Test: Offer Acceptance Complete Flow
 *
 * This test validates the complete restaurant offer acceptance journey:
 * 1. Restaurant creates quote request
 * 2. Dispatch routes to suppliers
 * 3. Suppliers create offers
 * 4. Restaurant lists offers with comparison data
 * 5. Restaurant accepts best offer
 * 6. CommercialIntent is created
 *
 * Tests:
 * - Offer comparison (pricing, match scores, sorting)
 * - Access control (restaurant ownership)
 * - Concurrency (cannot accept twice)
 * - Assignment expiry validation
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let testRestaurantId: string;
let testQuoteRequestId: string;
let testSupplierA_Id: string;
let testSupplierA_WineId: string;
let testSupplierA_OfferId: string;
let testSupplierB_Id: string;
let testSupplierB_WineId: string;
let testSupplierB_OfferId: string;

describe('Offer Acceptance Flow (Integration)', () => {
  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Setup: Create restaurant
    const { data: authData } = await supabase.auth.admin.createUser({
      email: `restaurant-accept-${Date.now()}@example.com`,
      password: 'RestaurantPass!',
      email_confirm: true,
      user_metadata: { name: 'Accept Test Restaurant' },
    });
    testRestaurantId = authData.user.id;

    await supabase.from('restaurants').insert({
      id: testRestaurantId,
      name: 'Accept Test Restaurant',
      contact_email: authData.user.email,
    });

    // Setup: Create Supplier A
    const supplierAResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-a-accept-${Date.now()}@example.com`,
        password: 'SupplierA!',
        supplierName: 'Supplier A (Better Match)',
        contactEmail: 'a@accept.com',
        normalDeliveryDays: 5,
      }),
    });
    const supplierAData = await supplierAResponse.json();
    testSupplierA_Id = supplierAData.supplier.id;

    const catalogA = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Premium Bordeaux 2015","Château A","France","Bordeaux",2015,"Cabernet Sauvignon",400.00,25.00,50,6,5,"Stockholm"`;
    await fetch(`http://localhost:3000/api/suppliers/${testSupplierA_Id}/catalog/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData: catalogA }),
    });

    const { data: winesA } = await supabase
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', testSupplierA_Id)
      .single();
    testSupplierA_WineId = winesA!.id;

    // Setup: Create Supplier B
    const supplierBResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-b-accept-${Date.now()}@example.com`,
        password: 'SupplierB!',
        supplierName: 'Supplier B (Cheaper)',
        contactEmail: 'b@accept.com',
        normalDeliveryDays: 7,
      }),
    });
    const supplierBData = await supplierBResponse.json();
    testSupplierB_Id = supplierBData.supplier.id;

    const catalogB = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Standard Bordeaux 2016","Château B","France","Bordeaux",2016,"Merlot",300.00,25.00,30,6,7,"Stockholm"`;
    await fetch(`http://localhost:3000/api/suppliers/${testSupplierB_Id}/catalog/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData: catalogB }),
    });

    const { data: winesB } = await supabase
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', testSupplierB_Id)
      .single();
    testSupplierB_WineId = winesB!.id;

    console.log('✓ Test setup complete: 1 restaurant, 2 suppliers');
  });

  afterAll(async () => {
    // Cleanup
    if (testRestaurantId) {
      await supabase.from('restaurants').delete().eq('id', testRestaurantId);
      await supabase.auth.admin.deleteUser(testRestaurantId);
    }
    if (testSupplierA_Id) await supabase.from('suppliers').delete().eq('id', testSupplierA_Id);
    if (testSupplierB_Id) await supabase.from('suppliers').delete().eq('id', testSupplierB_Id);
  });

  it('Step 1: Restaurant creates quote request', async () => {
    const { data: request } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Söker premium Bordeaux, 12 flaskor, budget 450 SEK/flaska',
        budget_per_flaska: 450,
        antal_flaskor: 12,
        leverans_senast: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
      .select()
      .single();

    expect(request).toBeDefined();
    testQuoteRequestId = request!.id;

    console.log('✓ Quote request created:', testQuoteRequestId);
  });

  it('Step 2: Dispatch routes to both suppliers', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/dispatch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMatches: 10, minScore: 0 }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.assignmentsCreated).toBe(2);

    console.log('✓ Dispatched to 2 suppliers');
  });

  it('Step 3: Supplier A creates offer (premium price)', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierA_Id,
          supplierWineId: testSupplierA_WineId,
          offeredPriceExVatSek: 390.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
          notes: 'Premium quality Bordeaux',
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    testSupplierA_OfferId = data.offer.id;

    console.log('✓ Supplier A created offer:', testSupplierA_OfferId);
  });

  it('Step 4: Supplier B creates offer (cheaper)', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierB_Id,
          supplierWineId: testSupplierB_WineId,
          offeredPriceExVatSek: 290.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
          notes: 'Good value option',
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    testSupplierB_OfferId = data.offer.id;

    console.log('✓ Supplier B created offer:', testSupplierB_OfferId);
  });

  it('Step 5: Restaurant lists offers with comparison data', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.offers).toBeDefined();
    expect(data.offers.length).toBe(2);
    expect(data.summary).toBeDefined();
    expect(data.summary.total).toBe(2);
    expect(data.summary.active).toBe(2);

    // Verify pricing calculations
    const offerA = data.offers.find((o: any) => o.id === testSupplierA_OfferId);
    expect(offerA).toBeDefined();
    expect(offerA.offeredPriceExVatSek).toBe(390.00);
    expect(offerA.vatRate).toBe(25.00);
    expect(offerA.priceIncVatSek).toBe(487.5); // 390 * 1.25
    expect(offerA.totalExVatSek).toBe(4680.00); // 390 * 12
    expect(offerA.totalIncVatSek).toBe(5850.00); // 4680 * 1.25

    // Verify match scores exist
    expect(offerA.matchScore).toBeGreaterThanOrEqual(0);
    expect(offerA.matchReasons).toBeDefined();
    expect(offerA.assignmentStatus).toBe('RESPONDED');
    expect(offerA.isExpired).toBe(false);

    // Verify sorting (by match score descending)
    expect(data.offers[0].matchScore).toBeGreaterThanOrEqual(data.offers[1].matchScore);

    console.log('✓ Restaurant sees 2 offers with comparison data');
    console.log('  Offer A (premium): 390 SEK/bottle, match score:', offerA.matchScore);
    console.log('  Offer B (cheaper): 290 SEK/bottle, match score:', data.offers.find((o: any) => o.id === testSupplierB_OfferId)?.matchScore);
  });

  it('Step 6: Restaurant accepts Supplier A offer', async () => {
    const response = await fetch(
      `http://localhost:3000/api/offers/${testSupplierA_OfferId}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.commercialIntent).toBeDefined();
    expect(data.commercialIntent.quoteRequestId).toBe(testQuoteRequestId);
    expect(data.commercialIntent.acceptedOfferId).toBe(testSupplierA_OfferId);
    expect(data.commercialIntent.status).toBe('pending');

    // Verify order summary
    expect(data.order).toBeDefined();
    expect(data.order.wine.name).toContain('Bordeaux');
    expect(data.order.pricing.priceExVatSek).toBe(390.00);
    expect(data.order.pricing.quantity).toBe(12);
    expect(data.order.pricing.totalGoodsSek).toBe(4680.00);
    expect(data.order.pricing.vatAmountSek).toBe(1170.00); // 4680 * 0.25
    expect(data.order.pricing.totalPayableSek).toBe(5850.00); // 4680 + 1170

    console.log('✓ Offer accepted, CommercialIntent created');
    console.log('  Total payable:', data.order.pricing.totalPayableSek, 'SEK');
  });

  it('Step 7: Verify CommercialIntent was created correctly', async () => {
    const { data: commercialIntent } = await supabase
      .from('commercial_intents')
      .select('*')
      .eq('quote_request_id', testQuoteRequestId)
      .single();

    expect(commercialIntent).toBeDefined();
    expect(commercialIntent!.accepted_offer_id).toBe(testSupplierA_OfferId);
    expect(commercialIntent!.restaurant_id).toBe(testRestaurantId);
    expect(commercialIntent!.supplier_id).toBe(testSupplierA_Id);
    expect(commercialIntent!.goods_seller_id).toBe(testSupplierA_Id);
    expect(commercialIntent!.quantity).toBe(12);
    expect(commercialIntent!.status).toBe('pending');

    // Verify amounts in öre
    expect(commercialIntent!.total_goods_amount_ore).toBe(468000); // 390 * 12 * 100
    expect(commercialIntent!.vat_amount_ore).toBe(117000); // 468000 * 0.25
    expect(commercialIntent!.service_fee_amount_ore).toBe(0); // PILOT: Free
    expect(commercialIntent!.total_payable_estimate_ore).toBe(585000); // 468000 + 117000 + 0

    // NEW: Verify pilot mode
    expect(commercialIntent!.service_fee_mode).toBe('PILOT_FREE');

    console.log('✓ CommercialIntent verified in database');
    console.log('  Service fee mode: PILOT_FREE (0 SEK during pilot)');
  });

  it('Step 8: Cannot accept second offer (concurrency check)', async () => {
    const response = await fetch(
      `http://localhost:3000/api/offers/${testSupplierB_OfferId}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.errorCode).toBe('ALREADY_ACCEPTED');
    expect(data.error).toContain('already accepted');

    console.log('✓ Double-accept prevented (409 Conflict, errorCode: ALREADY_ACCEPTED)');
  });

  it('Step 9: Verify unique constraint prevents duplicate intents', async () => {
    // Try to insert another commercial intent directly (should fail)
    const { error } = await supabase
      .from('commercial_intents')
      .insert({
        quote_request_id: testQuoteRequestId,
        accepted_offer_id: testSupplierB_OfferId,
        restaurant_id: testRestaurantId,
        supplier_id: testSupplierB_Id,
        total_goods_amount_ore: 348000,
        vat_amount_ore: 87000,
        service_fee_amount_ore: 0,
        total_payable_estimate_ore: 435000,
        vat_rate: 25.00,
        service_fee_mode: 'PILOT_FREE',
        wine_name: 'Test Wine',
        wine_producer: 'Test Producer',
        quantity: 12,
        lead_time_days: 7,
        goods_seller_id: testSupplierB_Id,
      });

    expect(error).toBeDefined();
    expect(error!.code).toBe('23505'); // PostgreSQL unique violation

    console.log('✓ Database unique constraint enforced');
  });
});
