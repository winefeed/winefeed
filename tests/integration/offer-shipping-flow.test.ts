import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration Test: Offer Shipping Functionality
 *
 * Tests the B2B shipping flow:
 * 1. Supplier creates offer with specified shipping cost
 * 2. Supplier creates offer with franco (shipping included)
 * 3. Restaurant sees correct totals (ex moms primary)
 * 4. Shipping notes are displayed
 *
 * B2B requirements:
 * - All prices ex moms (exklusive moms)
 * - Shipping shown separately or as "franco" (included)
 * - Clear display of totals with shipping
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Helper to create auth headers for test bypass
const authHeaders = (userId: string) => ({
  'Content-Type': 'application/json',
  'x-user-id': userId,
  'x-tenant-id': TEST_TENANT_ID,
});

let supabase: SupabaseClient;
let testRestaurantId: string;
let testQuoteRequestId: string;
let testSupplierA_Id: string;
let testSupplierA_UserId: string;
let testSupplierA_WineId: string;
let testSupplierA_OfferId: string; // With shipping cost
let testSupplierB_Id: string;
let testSupplierB_UserId: string;
let testSupplierB_WineId: string;
let testSupplierB_OfferId: string; // Franco (no shipping)

describe('Offer Shipping Flow (Integration)', () => {
  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Setup: Create restaurant
    const { data: authData } = await supabase.auth.admin.createUser({
      email: `restaurant-shipping-${Date.now()}@example.com`,
      password: 'RestaurantPass!',
      email_confirm: true,
      user_metadata: { name: 'Shipping Test Restaurant' },
    });
    testRestaurantId = authData.user!.id;

    await supabase.from('restaurants').insert({
      id: testRestaurantId,
      name: 'Shipping Test Restaurant',
      contact_email: authData.user!.email,
    });

    // Setup: Create Supplier A (will offer with shipping cost)
    const supplierAResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-a-shipping-${Date.now()}@example.com`,
        password: 'SupplierA!',
        supplierName: 'Supplier A (Shipping Cost)',
        contactEmail: 'a@shipping.test',
        normalDeliveryDays: 5,
      }),
    });
    const supplierAData = await supplierAResponse.json();
    if (!supplierAData.supplier) {
      console.error('Supplier A onboard failed:', supplierAData);
      throw new Error(`Supplier A onboard failed: ${JSON.stringify(supplierAData)}`);
    }
    testSupplierA_Id = supplierAData.supplier.id;

    // Get user ID from supplier_users table
    const { data: supplierUserA } = await supabase
      .from('supplier_users')
      .select('id')
      .eq('supplier_id', testSupplierA_Id)
      .single();
    testSupplierA_UserId = supplierUserA?.id || '';

    const catalogA = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Premium Chianti 2019","Castello A","Italy","Tuscany",2019,"Sangiovese",350.00,25.00,50,6,5,"Stockholm"`;
    await fetch(`http://localhost:3000/api/suppliers/${testSupplierA_Id}/catalog/import`, {
      method: 'POST',
      headers: authHeaders(testSupplierA_UserId),
      body: JSON.stringify({ csvData: catalogA }),
    });

    const { data: winesA } = await supabase
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', testSupplierA_Id)
      .single();
    testSupplierA_WineId = winesA!.id;

    // Setup: Create Supplier B (will offer franco)
    const supplierBResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-b-shipping-${Date.now()}@example.com`,
        password: 'SupplierB!',
        supplierName: 'Supplier B (Franco)',
        contactEmail: 'b@shipping.test',
        normalDeliveryDays: 7,
      }),
    });
    const supplierBData = await supplierBResponse.json();
    if (!supplierBData.supplier) {
      console.error('Supplier B onboard failed:', supplierBData);
      throw new Error(`Supplier B onboard failed: ${JSON.stringify(supplierBData)}`);
    }
    testSupplierB_Id = supplierBData.supplier.id;

    // Get user ID from supplier_users table
    const { data: supplierUserB } = await supabase
      .from('supplier_users')
      .select('id')
      .eq('supplier_id', testSupplierB_Id)
      .single();
    testSupplierB_UserId = supplierUserB?.id || '';

    const catalogB = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Premium Barolo 2018","Cantina B","Italy","Piedmont",2018,"Nebbiolo",450.00,25.00,30,6,7,"Stockholm"`;
    await fetch(`http://localhost:3000/api/suppliers/${testSupplierB_Id}/catalog/import`, {
      method: 'POST',
      headers: authHeaders(testSupplierB_UserId),
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
    // Cleanup in reverse order of dependencies
    if (testQuoteRequestId) {
      await supabase.from('offers').delete().eq('request_id', testQuoteRequestId);
      await supabase.from('quote_request_assignments').delete().eq('quote_request_id', testQuoteRequestId);
      await supabase.from('requests').delete().eq('id', testQuoteRequestId);
    }
    if (testSupplierA_WineId) await supabase.from('supplier_wines').delete().eq('id', testSupplierA_WineId);
    if (testSupplierB_WineId) await supabase.from('supplier_wines').delete().eq('id', testSupplierB_WineId);
    if (testSupplierA_Id) await supabase.from('suppliers').delete().eq('id', testSupplierA_Id);
    if (testSupplierB_Id) await supabase.from('suppliers').delete().eq('id', testSupplierB_Id);
    if (testSupplierA_UserId) await supabase.auth.admin.deleteUser(testSupplierA_UserId);
    if (testSupplierB_UserId) await supabase.auth.admin.deleteUser(testSupplierB_UserId);
    if (testRestaurantId) {
      await supabase.from('restaurants').delete().eq('id', testRestaurantId);
      await supabase.auth.admin.deleteUser(testRestaurantId);
    }
  });

  it('Step 1: Restaurant creates quote request', async () => {
    const { data: request } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Söker italienskt vin, leverans till Malmö, 24 flaskor',
        budget_per_flaska: 400,
        antal_flaskor: 24,
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
        headers: authHeaders(testRestaurantId),
        body: JSON.stringify({ maxMatches: 10, minScore: 0 }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    // Note: In shared DB, may dispatch to other test suppliers too
    expect(data.assignmentsCreated).toBeGreaterThanOrEqual(2);

    console.log('✓ Dispatched to', data.assignmentsCreated, 'suppliers');
  });

  it('Step 3: Supplier A creates offer WITH shipping cost', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: authHeaders(testSupplierA_UserId),
        body: JSON.stringify({
          supplierId: testSupplierA_Id,
          supplierWineId: testSupplierA_WineId,
          offeredPriceExVatSek: 340.00,
          quantity: 24,
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
          notes: 'Premiärårgång Chianti',
          // SHIPPING: Separate shipping cost
          is_franco: false,
          shipping_cost_sek: 850,
          shipping_notes: 'Leverans till Malmö (60 mil), pallfrakt',
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    testSupplierA_OfferId = data.offer.id;

    // Verify shipping in response
    expect(data.offer.isFranco).toBe(false);
    expect(data.offer.shippingCostSek).toBe(850);
    expect(data.offer.shippingNotes).toBe('Leverans till Malmö (60 mil), pallfrakt');

    // Verify totals
    expect(data.offer.totalWinePrice).toBe(8160); // 340 * 24
    expect(data.offer.totalWithShipping).toBe(9010); // 8160 + 850

    console.log('✓ Supplier A created offer with shipping cost: 850 SEK');
    console.log('  Wine total:', data.offer.totalWinePrice, 'SEK');
    console.log('  Total with shipping:', data.offer.totalWithShipping, 'SEK');
  });

  it('Step 4: Supplier B creates offer with FRANCO (shipping included)', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: authHeaders(testSupplierB_UserId),
        body: JSON.stringify({
          supplierId: testSupplierB_Id,
          supplierWineId: testSupplierB_WineId,
          offeredPriceExVatSek: 420.00,
          quantity: 24,
          deliveryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
          notes: 'Årgång 2018, perfekt drickfönster',
          // SHIPPING: Franco - shipping included in price
          is_franco: true,
          shipping_cost_sek: null, // Should be null for franco
          shipping_notes: 'Fritt levererat inom Sverige',
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    testSupplierB_OfferId = data.offer.id;

    // Verify franco
    expect(data.offer.isFranco).toBe(true);
    expect(data.offer.shippingCostSek).toBeNull();
    expect(data.offer.shippingNotes).toBe('Fritt levererat inom Sverige');

    // For franco, totalWithShipping = totalWinePrice (no extra shipping)
    expect(data.offer.totalWinePrice).toBe(10080); // 420 * 24
    expect(data.offer.totalWithShipping).toBe(10080); // Same as wine price

    console.log('✓ Supplier B created offer with franco (shipping included)');
    console.log('  Wine total (incl shipping):', data.offer.totalWinePrice, 'SEK');
  });

  it('Step 5: Restaurant lists offers and sees shipping info', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'GET',
        headers: authHeaders(testRestaurantId),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.offers).toBeDefined();
    expect(data.offers.length).toBe(2);

    // Find Supplier A's offer (with shipping cost)
    const offerA = data.offers.find((o: any) => o.id === testSupplierA_OfferId);
    expect(offerA).toBeDefined();
    expect(offerA.isFranco).toBe(false);
    expect(offerA.shippingCostSek).toBe(850);
    expect(offerA.shippingNotes).toBe('Leverans till Malmö (60 mil), pallfrakt');
    expect(offerA.totalWithShippingExVat).toBe(9010); // 8160 + 850
    expect(offerA.totalWithShippingIncVat).toBe(11262.5); // 9010 * 1.25

    // Find Supplier B's offer (franco)
    const offerB = data.offers.find((o: any) => o.id === testSupplierB_OfferId);
    expect(offerB).toBeDefined();
    expect(offerB.isFranco).toBe(true);
    expect(offerB.shippingCostSek).toBeNull();
    expect(offerB.shippingNotes).toBe('Fritt levererat inom Sverige');
    expect(offerB.totalWithShippingExVat).toBe(10080); // No extra shipping
    expect(offerB.totalWithShippingIncVat).toBe(12600); // 10080 * 1.25

    console.log('✓ Restaurant sees both offers with correct shipping info');
    console.log('  Offer A: 340 kr/fl + 850 kr frakt = 9010 kr ex moms');
    console.log('  Offer B: 420 kr/fl franco = 10080 kr ex moms');
  });

  it('Step 6: Verify B2B ex moms pricing is clear', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'GET',
        headers: authHeaders(testRestaurantId),
      }
    );

    const data = await response.json();
    const offerA = data.offers.find((o: any) => o.id === testSupplierA_OfferId);

    // Verify ex moms is the primary pricing
    // Price per bottle ex moms
    expect(offerA.offeredPriceExVatSek).toBe(340);

    // Total wine ex moms
    expect(offerA.totalExVatSek).toBe(8160);

    // Shipping (no VAT on shipping in B2B context)
    expect(offerA.shippingCostSek).toBe(850);

    // Total with shipping ex moms (primary B2B figure)
    expect(offerA.totalWithShippingExVat).toBe(9010);

    // VAT is secondary info
    expect(offerA.vatRate).toBe(25);
    expect(offerA.totalWithShippingIncVat).toBe(11262.5);

    console.log('✓ B2B ex moms pricing structure verified');
    console.log('  Primary: totalWithShippingExVat = 9010 SEK');
    console.log('  Secondary: totalWithShippingIncVat = 11262.5 SEK');
  });

  it('Step 7: Compare total cost (shipping included vs franco)', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      { method: 'GET', headers: authHeaders(testRestaurantId) }
    );

    const data = await response.json();
    const offerA = data.offers.find((o: any) => o.id === testSupplierA_OfferId);
    const offerB = data.offers.find((o: any) => o.id === testSupplierB_OfferId);

    // Offer A: Lower wine price but shipping extra
    const totalA = offerA.totalWithShippingExVat;

    // Offer B: Higher wine price but franco
    const totalB = offerB.totalWithShippingExVat;

    // In this case, Offer A is cheaper overall
    expect(totalA).toBeLessThan(totalB);

    console.log('✓ Offer comparison:');
    console.log(`  Offer A: ${totalA} SEK (wine: 8160 + shipping: 850)`);
    console.log(`  Offer B: ${totalB} SEK (wine: 10080, franco)`);
    console.log(`  Offer A is ${totalB - totalA} SEK cheaper overall`);
  });
});
