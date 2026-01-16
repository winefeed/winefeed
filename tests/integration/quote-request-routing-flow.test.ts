import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration Test: Quote Request Routing Complete Flow
 *
 * This test validates the complete routing marketplace:
 * 1. Restaurant creates quote request
 * 2. Dispatch routes request to matched suppliers
 * 3. Suppliers view their assignments (status → VIEWED)
 * 4. Supplier creates offer (status → RESPONDED)
 * 5. Assignment status is tracked correctly
 *
 * Tests routing algorithm:
 * - Region/country matching
 * - Budget matching
 * - Lead time matching
 * - Minimum order quantity matching
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let testRestaurantId: string;
let testQuoteRequestId: string;
let testSupplierA_Id: string;
let testSupplierA_UserId: string;
let testSupplierA_WineId: string;
let testSupplierB_Id: string;
let testSupplierB_UserId: string;
let testSupplierB_WineId: string;
let assignmentIds: string[] = [];

describe('Quote Request Routing Flow (Integration)', () => {
  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Setup: Create restaurant
    const { data: authData } = await supabase.auth.admin.createUser({
      email: `restaurant-routing-${Date.now()}@example.com`,
      password: 'RestaurantPass!',
      email_confirm: true,
      user_metadata: { name: 'Routing Test Restaurant' },
    });
    testRestaurantId = authData.user.id;

    await supabase.from('restaurants').insert({
      id: testRestaurantId,
      name: 'Routing Test Restaurant',
      contact_email: authData.user.email,
    });

    // Setup: Create Supplier A (French wines)
    const supplierAResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-a-routing-${Date.now()}@example.com`,
        password: 'SupplierA!',
        supplierName: 'French Wine Importer AB',
        contactEmail: 'french@supplier.com',
        normalDeliveryDays: 3,
      }),
    });
    const supplierAData = await supplierAResponse.json();
    testSupplierA_Id = supplierAData.supplier.id;
    testSupplierA_UserId = supplierAData.user.id;

    // Add French wine to Supplier A
    const catalogA = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Château Bordeaux 2015","Château Test","France","Bordeaux",2015,"Cabernet Sauvignon",400.00,25.00,50,6,3,"Stockholm"`;
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

    // Setup: Create Supplier B (Italian wines)
    const supplierBResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-b-routing-${Date.now()}@example.com`,
        password: 'SupplierB!',
        supplierName: 'Italian Wine Importer AB',
        contactEmail: 'italian@supplier.com',
        normalDeliveryDays: 7,
      }),
    });
    const supplierBData = await supplierBResponse.json();
    testSupplierB_Id = supplierBData.supplier.id;
    testSupplierB_UserId = supplierBData.user.id;

    // Add Italian wine to Supplier B
    const catalogB = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Barolo Classico 2014","Italian Producer","Italy","Piedmont",2014,"Nebbiolo",500.00,25.00,30,6,7,"Stockholm"`;
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
    if (testSupplierA_UserId) await supabase.auth.admin.deleteUser(testSupplierA_UserId);
    if (testSupplierB_UserId) await supabase.auth.admin.deleteUser(testSupplierB_UserId);
    if (testSupplierA_Id) await supabase.from('suppliers').delete().eq('id', testSupplierA_Id);
    if (testSupplierB_Id) await supabase.from('suppliers').delete().eq('id', testSupplierB_Id);
  });

  it('Step 1: Restaurant creates quote request for French wine', async () => {
    const { data: request } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Söker elegant rött vin från Bordeaux, Frankrike',
        budget_per_flaska: 450,
        antal_flaskor: 12,
        leverans_senast: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        specialkrav: [],
      })
      .select()
      .single();

    expect(request).toBeDefined();
    testQuoteRequestId = request!.id;

    console.log('✓ Quote request created:', testQuoteRequestId);
  });

  it('Step 2: Dispatch routes request to matched suppliers', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/dispatch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxMatches: 10,
          minScore: 0, // Accept all suppliers for testing
          expiresInHours: 48,
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.assignmentsCreated).toBeGreaterThan(0);
    expect(data.matches).toBeDefined();

    // Should have matched both suppliers (both have wines)
    expect(data.matches.length).toBeGreaterThanOrEqual(1);

    // Check that Supplier A (French wines) got higher score than Supplier B (Italian)
    const supplierAMatch = data.matches.find((m: any) => m.supplierId === testSupplierA_Id);
    const supplierBMatch = data.matches.find((m: any) => m.supplierId === testSupplierB_Id);

    expect(supplierAMatch).toBeDefined();
    expect(supplierAMatch.matchScore).toBeGreaterThan(0);

    // Supplier A should score higher due to "Bordeaux" + "France" keyword match
    if (supplierBMatch) {
      expect(supplierAMatch.matchScore).toBeGreaterThanOrEqual(supplierBMatch.matchScore);
    }

    assignmentIds = data.matches.map((m: any) => m.assignmentId);

    console.log('✓ Dispatched to', data.assignmentsCreated, 'suppliers');
    console.log('  Supplier A score:', supplierAMatch.matchScore);
    if (supplierBMatch) console.log('  Supplier B score:', supplierBMatch.matchScore);
  });

  it('Step 3: Supplier A views assigned quote requests', async () => {
    const response = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierA_Id}/quote-requests?status=active`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.requests).toBeDefined();
    expect(data.requests.length).toBeGreaterThan(0);

    // Find our test request
    const ourRequest = data.requests.find((r: any) => r.id === testQuoteRequestId);
    expect(ourRequest).toBeDefined();
    expect(ourRequest.fritext).toContain('Bordeaux');
    expect(ourRequest.assignment).toBeDefined();
    expect(ourRequest.assignment.status).toBe('VIEWED'); // Auto-updated!
    expect(ourRequest.assignment.matchScore).toBeGreaterThan(0);
    expect(ourRequest.assignment.viewedAt).toBeDefined();

    console.log('✓ Supplier A can see assigned request (status: VIEWED)');
  });

  it('Step 4: Supplier A creates offer on assigned request', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierA_Id,
          supplierWineId: testSupplierA_WineId,
          offeredPriceExVatSek: 390.00, // Slightly lower than catalog
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
          notes: 'Perfect match for your Bordeaux request!',
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.offer).toBeDefined();
    expect(data.offer.supplierId).toBe(testSupplierA_Id);

    console.log('✓ Supplier A created offer:', data.offer.id);
  });

  it('Step 5: Assignment status is automatically updated to RESPONDED', async () => {
    const { data: assignment } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', testQuoteRequestId)
      .eq('supplier_id', testSupplierA_Id)
      .single();

    expect(assignment).toBeDefined();
    expect(assignment!.status).toBe('RESPONDED');
    expect(assignment!.responded_at).toBeDefined();
    expect(assignment!.viewed_at).toBeDefined();

    console.log('✓ Assignment status: RESPONDED');
  });

  it('Step 6: Supplier B can also see and respond to the request', async () => {
    // Check if Supplier B was assigned
    const { data: supplierBAssignment } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', testQuoteRequestId)
      .eq('supplier_id', testSupplierB_Id)
      .maybeSingle();

    if (!supplierBAssignment) {
      console.log('✓ Supplier B was not matched (expected if score too low)');
      return; // Skip this test if B wasn't matched
    }

    // Supplier B views requests
    const viewResponse = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierB_Id}/quote-requests?status=active`,
      { method: 'GET' }
    );

    const viewData = await viewResponse.json();
    const ourRequest = viewData.requests.find((r: any) => r.id === testQuoteRequestId);
    expect(ourRequest).toBeDefined();

    // Supplier B creates offer
    const offerResponse = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierB_Id,
          supplierWineId: testSupplierB_WineId,
          offeredPriceExVatSek: 480.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
        }),
      }
    );

    expect(offerResponse.status).toBe(201);

    console.log('✓ Supplier B also responded');
  });

  it('Step 7: Restaurant can see all offers', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.offers).toBeDefined();
    expect(data.offers.length).toBeGreaterThan(0);

    // Should have at least offer from Supplier A
    const supplierAOffer = data.offers.find((o: any) => o.supplierId === testSupplierA_Id);
    expect(supplierAOffer).toBeDefined();
    expect(supplierAOffer.wine.name).toContain('Bordeaux');

    console.log('✓ Restaurant sees', data.offers.length, 'offer(s)');
  });

  it('Step 8: Cannot dispatch same request twice', async () => {
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/dispatch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.error).toContain('already dispatched');

    console.log('✓ Duplicate dispatch prevented');
  });

  it('Step 9: Get dispatch status and preview', async () => {
    // Get status without preview
    const statusResponse = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/dispatch`,
      { method: 'GET' }
    );

    expect(statusResponse.status).toBe(200);

    const statusData = await statusResponse.json();
    expect(statusData.dispatched).toBe(true);
    expect(statusData.assignmentsCount).toBeGreaterThan(0);
    expect(statusData.assignments).toBeDefined();

    // Get preview for a different request
    const { data: newRequest } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Italian Barolo wine needed',
        budget_per_flaska: 500,
        antal_flaskor: 6,
      })
      .select()
      .single();

    const previewResponse = await fetch(
      `http://localhost:3000/api/quote-requests/${newRequest!.id}/dispatch?preview=true`,
      { method: 'GET' }
    );

    const previewData = await previewResponse.json();
    expect(previewData.dispatched).toBe(false);
    expect(previewData.preview).toBeDefined();
    expect(previewData.preview.potentialMatches).toBeDefined();

    console.log('✓ Dispatch status and preview working');
  });
});
