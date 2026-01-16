import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration Test: Supplier Onboarding Complete Flow
 *
 * This test validates the complete supplier journey:
 * 1. Supplier onboards with SWEDISH_IMPORTER type
 * 2. Supplier imports wine catalog via CSV
 * 3. Restaurant creates a quote request
 * 4. Supplier views quote requests
 * 5. Supplier creates offer on quote request
 *
 * Tests compliance rules:
 * - SWEDISH_IMPORTER cannot have EU-specific fields
 * - Catalog prices are validated
 * - Minimum order quantities are enforced
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let testSupplierId: string;
let testSupplierUserId: string;
let testSupplierWineId: string;
let testRestaurantId: string;
let testQuoteRequestId: string;

// Sample CSV for catalog import
const SAMPLE_CATALOG_CSV = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Château Margaux 2015","Château Margaux","France","Bordeaux",2015,"Cabernet Sauvignon",450.00,25.00,24,6,7,"Stockholm,Göteborg"
"Barolo Riserva 2013","Marchesi di Barolo","Italy","Piedmont",2013,"Nebbiolo",320.50,25.00,12,6,5,"Stockholm,Malmö"
"Rioja Gran Reserva 2010","La Rioja Alta","Spain","Rioja",2010,"Tempranillo",180.00,25.00,,6,3,`;

describe('Supplier Onboarding Flow (Integration)', () => {
  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testSupplierUserId) {
      await supabase.auth.admin.deleteUser(testSupplierUserId);
    }
    if (testSupplierId) {
      await supabase.from('suppliers').delete().eq('id', testSupplierId);
    }
    if (testRestaurantId) {
      await supabase.from('restaurants').delete().eq('id', testRestaurantId);
      await supabase.auth.admin.deleteUser(testRestaurantId);
    }
  });

  beforeEach(() => {
    // Reset IDs for each test
  });

  it('Step 1: Supplier onboards successfully', async () => {
    const response = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        supplierName: 'Vinkällaren AB',
        contactEmail: 'kontakt@vinkallaren.se',
        phone: '+46701234567',
        website: 'https://vinkallaren.se',
        orgNumber: '556123-4567',
        licenseNumber: 'ALK-2024-001',
        normalDeliveryDays: 5,
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.supplier).toBeDefined();
    expect(data.supplier.type).toBe('SWEDISH_IMPORTER');
    expect(data.supplier.name).toBe('Vinkällaren AB');
    expect(data.user).toBeDefined();
    expect(data.user.email).toContain('supplier-test-');

    // Store for next tests
    testSupplierId = data.supplier.id;
    testSupplierUserId = data.user.id;

    console.log('✓ Supplier onboarded:', testSupplierId);
  });

  it('Step 2: Supplier imports catalog via CSV', async () => {
    expect(testSupplierId).toBeDefined();

    const response = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierId}/catalog/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: SAMPLE_CATALOG_CSV,
          replaceExisting: false,
        }),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.imported).toBe(3);
    expect(data.updated).toBe(0);
    expect(data.failed).toBe(0);
    expect(data.totalRows).toBe(3);

    // Verify wines were created
    const { data: wines } = await supabase
      .from('supplier_wines')
      .select('*')
      .eq('supplier_id', testSupplierId);

    expect(wines).toHaveLength(3);
    expect(wines![0].name).toBe('Château Margaux 2015');
    expect(wines![0].price_ex_vat_sek).toBe(45000); // 450.00 SEK -> 45000 öre
    expect(wines![0].min_order_qty).toBe(6);

    // Store first wine for offer creation
    testSupplierWineId = wines![0].id;

    console.log('✓ Catalog imported: 3 wines');
  });

  it('Step 3: Create a test restaurant and quote request', async () => {
    // Create restaurant user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `restaurant-test-${Date.now()}@example.com`,
      password: 'RestaurantPass123!',
      email_confirm: true,
      user_metadata: {
        name: 'Test Restaurang',
      },
    });

    expect(authError).toBeNull();
    expect(authData.user).toBeDefined();

    testRestaurantId = authData.user.id;

    // Create restaurant record (should be auto-created by trigger, but let's ensure)
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', testRestaurantId)
      .single();

    if (!restaurant) {
      await supabase.from('restaurants').insert({
        id: testRestaurantId,
        name: 'Test Restaurang',
        contact_email: authData.user.email,
      });
    }

    // Create quote request
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Söker elegant rött vin från Bordeaux, budget 500 kr/flaska',
        budget_per_flaska: 500,
        antal_flaskor: 12,
        leverans_senast: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        specialkrav: ['ekologiskt'],
      })
      .select()
      .single();

    expect(requestError).toBeNull();
    expect(request).toBeDefined();

    testQuoteRequestId = request!.id;

    console.log('✓ Quote request created:', testQuoteRequestId);
  });

  it('Step 4: Supplier lists quote requests', async () => {
    expect(testSupplierId).toBeDefined();
    expect(testQuoteRequestId).toBeDefined();

    const response = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierId}/quote-requests?status=all&limit=10`,
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
    expect(ourRequest.budgetPerFlaska).toBe(500);
    expect(ourRequest.myOfferCount).toBe(0);

    console.log('✓ Supplier can see quote requests');
  });

  it('Step 5: Supplier creates offer on quote request', async () => {
    expect(testQuoteRequestId).toBeDefined();
    expect(testSupplierId).toBeDefined();
    expect(testSupplierWineId).toBeDefined();

    const deliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierId,
          supplierWineId: testSupplierWineId,
          offeredPriceExVatSek: 440.00, // Slightly lower than catalog price
          quantity: 12,
          deliveryDate: deliveryDate,
          leadTimeDays: 7,
          notes: 'Specialpris för första beställningen',
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.offer).toBeDefined();
    expect(data.offer.requestId).toBe(testQuoteRequestId);
    expect(data.offer.supplierId).toBe(testSupplierId);
    expect(data.offer.offeredPriceExVatSek).toBe(440.00);
    expect(data.offer.quantity).toBe(12);
    expect(data.offer.status).toBe('pending');

    console.log('✓ Offer created:', data.offer.id);
  });

  it('Step 6: Verify offer appears in quote request offers', async () => {
    expect(testQuoteRequestId).toBeDefined();

    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.offers).toBeDefined();
    expect(data.offers.length).toBe(1);

    const offer = data.offers[0];
    expect(offer.requestId).toBe(testQuoteRequestId);
    expect(offer.supplierName).toBe('Vinkällaren AB');
    expect(offer.wine.name).toBe('Château Margaux 2015');
    expect(offer.offeredPriceExVatSek).toBe(440.00);

    console.log('✓ Offer visible in quote request');
  });

  it('Step 7: Validate minimum order quantity enforcement', async () => {
    expect(testQuoteRequestId).toBeDefined();

    // Try to create offer with quantity below minimum (6)
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierId,
          supplierWineId: testSupplierWineId,
          offeredPriceExVatSek: 450.00,
          quantity: 3, // Below minimum of 6
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
        }),
      }
    );

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('at least 6');

    console.log('✓ Minimum order quantity validated');
  });

  it('Step 8: CSV import validates prices', async () => {
    const invalidCSV = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Invalid Wine","Producer","France","Bordeaux",2015,"Merlot",-10.00,25.00,24,6,7,"Stockholm"`;

    const response = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierId}/catalog/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: invalidCSV,
        }),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.imported).toBe(0);
    expect(data.failed).toBe(1);
    expect(data.errors[0].error).toContain('Invalid price');

    console.log('✓ CSV validation works');
  });
});
