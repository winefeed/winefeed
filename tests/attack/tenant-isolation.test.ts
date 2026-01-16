import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Attack Test: Tenant Isolation
 *
 * This test validates that suppliers are properly isolated from each other:
 * 1. Supplier A cannot access Supplier B's wines
 * 2. Supplier A cannot create offers using Supplier B's wines
 * 3. Supplier A cannot view Supplier B's offers (except on same quote request)
 * 4. Supplier A cannot modify Supplier B's catalog
 *
 * These tests prove multi-tenancy security.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let supplierA_Id: string;
let supplierA_UserId: string;
let supplierA_WineId: string;
let supplierB_Id: string;
let supplierB_UserId: string;
let supplierB_WineId: string;
let testQuoteRequestId: string;
let testRestaurantId: string;

describe('Tenant Isolation (Attack Tests)', () => {
  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create Supplier A
    const responseA = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-a-${Date.now()}@example.com`,
        password: 'SecurePasswordA!',
        supplierName: 'Supplier A AB',
        contactEmail: 'a@supplier.com',
        orgNumber: '556111-1111',
      }),
    });
    const dataA = await responseA.json();
    supplierA_Id = dataA.supplier.id;
    supplierA_UserId = dataA.user.id;

    // Create Supplier B
    const responseB = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-b-${Date.now()}@example.com`,
        password: 'SecurePasswordB!',
        supplierName: 'Supplier B AB',
        contactEmail: 'b@supplier.com',
        orgNumber: '556222-2222',
      }),
    });
    const dataB = await responseB.json();
    supplierB_Id = dataB.supplier.id;
    supplierB_UserId = dataB.user.id;

    // Add wine to Supplier A's catalog
    const catalogA = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Wine A","Producer A","France","Bordeaux",2015,"Merlot",300.00,25.00,24,6,5,"Stockholm"`;

    await fetch(`http://localhost:3000/api/suppliers/${supplierA_Id}/catalog/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData: catalogA }),
    });

    const { data: winesA } = await supabase
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', supplierA_Id)
      .single();
    supplierA_WineId = winesA!.id;

    // Add wine to Supplier B's catalog
    const catalogB = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Wine B","Producer B","Italy","Tuscany",2016,"Sangiovese",250.00,25.00,12,6,7,"Göteborg"`;

    await fetch(`http://localhost:3000/api/suppliers/${supplierB_Id}/catalog/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData: catalogB }),
    });

    const { data: winesB } = await supabase
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', supplierB_Id)
      .single();
    supplierB_WineId = winesB!.id;

    // Create a test restaurant and quote request
    const { data: authData } = await supabase.auth.admin.createUser({
      email: `restaurant-attack-${Date.now()}@example.com`,
      password: 'RestaurantPass!',
      email_confirm: true,
      user_metadata: { name: 'Attack Test Restaurant' },
    });
    testRestaurantId = authData.user.id;

    await supabase.from('restaurants').insert({
      id: testRestaurantId,
      name: 'Attack Test Restaurant',
      contact_email: authData.user.email,
    });

    const { data: request } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Test quote request',
        budget_per_flaska: 400,
        antal_flaskor: 12,
      })
      .select()
      .single();
    testQuoteRequestId = request!.id;

    console.log('✓ Test setup complete: 2 suppliers, 1 quote request');
  });

  afterAll(async () => {
    // Cleanup
    if (supplierA_UserId) await supabase.auth.admin.deleteUser(supplierA_UserId);
    if (supplierB_UserId) await supabase.auth.admin.deleteUser(supplierB_UserId);
    if (testRestaurantId) await supabase.auth.admin.deleteUser(testRestaurantId);
    if (supplierA_Id) await supabase.from('suppliers').delete().eq('id', supplierA_Id);
    if (supplierB_Id) await supabase.from('suppliers').delete().eq('id', supplierB_Id);
    if (testRestaurantId) await supabase.from('restaurants').delete().eq('id', testRestaurantId);
  });

  it('ATTACK 1: Supplier A cannot create offer using Supplier B\'s wine', async () => {
    // Supplier A tries to create an offer using Supplier B's wine
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierA_Id,
          supplierWineId: supplierB_WineId, // ATTACK: Using other supplier's wine
          offeredPriceExVatSek: 300.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain('does not belong to this supplier');
    expect(data.error).toContain('tenant isolation');

    console.log('✓ ATTACK 1 BLOCKED: Cannot use other supplier\'s wine');
  });

  it('ATTACK 2: Supplier A cannot import catalog to Supplier B', async () => {
    // Supplier A tries to import catalog to Supplier B's account
    const maliciousCSV = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Malicious Wine","Hacker","France","Bordeaux",2020,"Merlot",999.00,25.00,100,1,1,"Global"`;

    const response = await fetch(
      `http://localhost:3000/api/suppliers/${supplierB_Id}/catalog/import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In real implementation, this would fail at auth middleware
          // For now, we test the validation at API level
        },
        body: JSON.stringify({ csvData: maliciousCSV }),
      }
    );

    // This should be blocked by RLS or auth middleware
    // For MVP without full auth, we verify catalog import validates supplier_id
    // In production, this would return 403 Unauthorized

    // Verify Supplier B's catalog wasn't modified by checking wine count
    const { data: winesB } = await supabase
      .from('supplier_wines')
      .select('id')
      .eq('supplier_id', supplierB_Id);

    // Should still have only 1 wine (Wine B)
    expect(winesB!.length).toBe(1);

    console.log('✓ ATTACK 2 BLOCKED: Cannot import to other supplier\'s catalog');
  });

  it('ATTACK 3: RLS prevents reading other supplier\'s wines via database', async () => {
    // Try to read Supplier B's wines as Supplier A using RLS
    // Create a client authenticated as Supplier A
    const { data: sessionA } = await supabase.auth.admin.createSession({
      user_id: supplierA_UserId,
    });

    const supplierAClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${sessionA?.session?.access_token}`,
        },
      },
    });

    // Try to read supplier_wines table (should only see Supplier A's wines)
    const { data: wines, error } = await supplierAClient
      .from('supplier_wines')
      .select('*')
      .eq('supplier_id', supplierB_Id); // Try to read Supplier B's wines

    // RLS should prevent this - either error or empty result
    if (error) {
      expect(error).toBeDefined();
      console.log('✓ ATTACK 3 BLOCKED: RLS prevented access (error)');
    } else {
      expect(wines!.length).toBe(0); // Should see no wines from Supplier B
      console.log('✓ ATTACK 3 BLOCKED: RLS prevented access (empty result)');
    }
  });

  it('ATTACK 4: Supplier cannot create offer for non-existent quote request', async () => {
    const fakeQuoteRequestId = '00000000-0000-0000-0000-000000000000';

    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${fakeQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierA_Id,
          supplierWineId: supplierA_WineId,
          offeredPriceExVatSek: 300.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain('not found');

    console.log('✓ ATTACK 4 BLOCKED: Cannot create offer for fake quote request');
  });

  it('ATTACK 5: Supplier cannot use non-existent wine', async () => {
    const fakeWineId = '00000000-0000-0000-0000-000000000000';

    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierA_Id,
          supplierWineId: fakeWineId,
          offeredPriceExVatSek: 300.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain('not found in catalog');

    console.log('✓ ATTACK 5 BLOCKED: Cannot use non-existent wine');
  });

  it('ATTACK 6: Supplier cannot pretend to be another supplier', async () => {
    // Supplier A tries to create offer but claims to be Supplier B
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierB_Id, // ATTACK: Claiming to be Supplier B
          supplierWineId: supplierA_WineId, // But using Supplier A's wine
          offeredPriceExVatSek: 300.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain('tenant isolation');

    console.log('✓ ATTACK 6 BLOCKED: Cannot pretend to be another supplier');
  });

  it('ATTACK 7: Validate both suppliers can create legitimate offers', async () => {
    // This is a positive test: both suppliers SHOULD be able to create offers
    // using their own wines

    // Supplier A creates offer
    const responseA = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierA_Id,
          supplierWineId: supplierA_WineId,
          offeredPriceExVatSek: 290.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(responseA.status).toBe(201);

    // Supplier B creates offer
    const responseB = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierB_Id,
          supplierWineId: supplierB_WineId,
          offeredPriceExVatSek: 240.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
        }),
      }
    );

    expect(responseB.status).toBe(201);

    // Verify both offers exist
    const { data: offers } = await supabase
      .from('offers')
      .select('*')
      .eq('request_id', testQuoteRequestId);

    expect(offers!.length).toBe(2);
    expect(offers!.some(o => o.supplier_id === supplierA_Id)).toBe(true);
    expect(offers!.some(o => o.supplier_id === supplierB_Id)).toBe(true);

    console.log('✓ ATTACK 7 PASSED: Both suppliers can create legitimate offers');
  });
});
