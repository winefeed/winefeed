import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Attack Test: Assignment Access Control
 *
 * This test validates that suppliers can ONLY:
 * - See quote requests they have been assigned to
 * - Create offers on requests with valid (non-expired) assignments
 * - Cannot bypass assignment checks
 *
 * Attack scenarios:
 * 1. Supplier tries to create offer without assignment → 403
 * 2. Supplier tries to view request without assignment → empty list
 * 3. Supplier tries to create offer after assignment expires → 403
 * 4. Supplier cannot see other supplier's assignments via API
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: SupabaseClient;
let testRestaurantId: string;
let testQuoteRequest_Assigned_Id: string;
let testQuoteRequest_Unassigned_Id: string;
let testQuoteRequest_Expired_Id: string;
let testSupplierA_Id: string;
let testSupplierA_UserId: string;
let testSupplierA_WineId: string;
let testSupplierB_Id: string;
let testSupplierB_UserId: string;
let testSupplierB_WineId: string;

describe('Assignment Access Control (Attack Tests)', () => {
  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create restaurant
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

    // Create Supplier A
    const supplierAResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-a-attack-${Date.now()}@example.com`,
        password: 'SupplierA!',
        supplierName: 'Supplier A Attack Test',
        contactEmail: 'a@attack.com',
      }),
    });
    const supplierAData = await supplierAResponse.json();
    testSupplierA_Id = supplierAData.supplier.id;
    testSupplierA_UserId = supplierAData.user.id;

    // Add wine to Supplier A
    const catalogA = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Test Wine A","Producer A","France","Bordeaux",2015,"Merlot",300.00,25.00,50,6,5,"Stockholm"`;
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

    // Create Supplier B
    const supplierBResponse = await fetch(`http://localhost:3000/api/suppliers/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `supplier-b-attack-${Date.now()}@example.com`,
        password: 'SupplierB!',
        supplierName: 'Supplier B Attack Test',
        contactEmail: 'b@attack.com',
      }),
    });
    const supplierBData = await supplierBResponse.json();
    testSupplierB_Id = supplierBData.supplier.id;
    testSupplierB_UserId = supplierBData.user.id;

    // Add wine to Supplier B
    const catalogB = `name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
"Test Wine B","Producer B","Italy","Tuscany",2016,"Sangiovese",250.00,25.00,30,6,7,"Stockholm"`;
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

    // Create quote request that will be assigned to Supplier A
    const { data: requestAssigned } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Wine for testing assignment',
        budget_per_flaska: 300,
        antal_flaskor: 12,
      })
      .select()
      .single();
    testQuoteRequest_Assigned_Id = requestAssigned!.id;

    // Dispatch to Supplier A
    await fetch(`http://localhost:3000/api/quote-requests/${testQuoteRequest_Assigned_Id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxMatches: 10, minScore: 0 }),
    });

    // Create quote request that will NOT be dispatched (no assignments)
    const { data: requestUnassigned } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Unassigned wine request',
        budget_per_flaska: 400,
        antal_flaskor: 6,
      })
      .select()
      .single();
    testQuoteRequest_Unassigned_Id = requestUnassigned!.id;

    // Create quote request with EXPIRED assignment
    const { data: requestExpired } = await supabase
      .from('requests')
      .insert({
        restaurant_id: testRestaurantId,
        fritext: 'Expired wine request',
        budget_per_flaska: 350,
        antal_flaskor: 12,
      })
      .select()
      .single();
    testQuoteRequest_Expired_Id = requestExpired!.id;

    // Create expired assignment manually
    await supabase.from('quote_request_assignments').insert({
      quote_request_id: testQuoteRequest_Expired_Id,
      supplier_id: testSupplierA_Id,
      status: 'SENT',
      sent_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 72 hours ago
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired 24h ago
      match_score: 50,
      match_reasons: ['test'],
    });

    console.log('✓ Test setup complete');
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

  it('ATTACK 1: Supplier cannot create offer without assignment', async () => {
    // Supplier B tries to create offer on request assigned to Supplier A
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequest_Unassigned_Id}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierB_Id,
          supplierWineId: testSupplierB_WineId,
          offeredPriceExVatSek: 240.00,
          quantity: 6,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
        }),
      }
    );

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain('No valid assignment');
    expect(data.details).toContain('assigned to');

    console.log('✓ ATTACK 1 BLOCKED: Cannot create offer without assignment');
  });

  it('ATTACK 2: Supplier only sees requests they are assigned to', async () => {
    // Supplier B lists quote requests (should NOT see Supplier A's assignment)
    const response = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierB_Id}/quote-requests?status=active`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Should not see the request assigned to Supplier A
    const foundAssigned = data.requests.find(
      (r: any) => r.id === testQuoteRequest_Assigned_Id
    );
    expect(foundAssigned).toBeUndefined();

    console.log('✓ ATTACK 2 BLOCKED: Supplier B cannot see Supplier A\'s assignments');
  });

  it('ATTACK 3: Supplier cannot create offer on expired assignment', async () => {
    // Supplier A tries to create offer on expired assignment
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequest_Expired_Id}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierA_Id,
          supplierWineId: testSupplierA_WineId,
          offeredPriceExVatSek: 290.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain('expired');

    console.log('✓ ATTACK 3 BLOCKED: Cannot create offer after expiration');
  });

  it('ATTACK 4: Supplier B cannot steal Supplier A\'s assignment', async () => {
    // Supplier B tries to create offer using Supplier B's ID but on Supplier A's assignment
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequest_Assigned_Id}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierB_Id, // ATTACK: Using Supplier B
          supplierWineId: testSupplierB_WineId,
          offeredPriceExVatSek: 240.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 7,
        }),
      }
    );

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain('No valid assignment');

    console.log('✓ ATTACK 4 BLOCKED: Supplier B cannot use Supplier A\'s assignment');
  });

  it('ATTACK 5: Cannot modify assignment via direct database access (RLS)', async () => {
    // Try to read Supplier A's assignment as Supplier B via authenticated client
    const { data: sessionB } = await supabase.auth.admin.createSession({
      user_id: testSupplierB_UserId,
    });

    const supplierBClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${sessionB?.session?.access_token}`,
        },
      },
    });

    // Try to read Supplier A's assignments
    const { data: assignments, error } = await supplierBClient
      .from('quote_request_assignments')
      .select('*')
      .eq('supplier_id', testSupplierA_Id); // Try to read other supplier's data

    // RLS should prevent this - either error or empty result
    if (error) {
      expect(error).toBeDefined();
      console.log('✓ ATTACK 5 BLOCKED: RLS prevented access (error)');
    } else {
      expect(assignments!.length).toBe(0); // Should see no assignments
      console.log('✓ ATTACK 5 BLOCKED: RLS prevented access (empty result)');
    }
  });

  it('ATTACK 6: Expired assignment is not visible in active list', async () => {
    // Supplier A lists active assignments (should NOT see expired one)
    const response = await fetch(
      `http://localhost:3000/api/suppliers/${testSupplierA_Id}/quote-requests?status=active`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    // Should not see the expired request in active list
    const foundExpired = data.requests.find(
      (r: any) => r.id === testQuoteRequest_Expired_Id
    );
    expect(foundExpired).toBeUndefined();

    console.log('✓ ATTACK 6 BLOCKED: Expired assignments hidden from active list');
  });

  it('ATTACK 7: Supplier A can create offer on valid assignment', async () => {
    // This is a positive test: Supplier A SHOULD be able to create offer
    const response = await fetch(
      `http://localhost:3000/api/quote-requests/${testQuoteRequest_Assigned_Id}/offers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: testSupplierA_Id,
          supplierWineId: testSupplierA_WineId,
          offeredPriceExVatSek: 290.00,
          quantity: 12,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          leadTimeDays: 5,
        }),
      }
    );

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.offer).toBeDefined();

    console.log('✓ ATTACK 7 PASSED: Supplier A can create offer with valid assignment');
  });

  it('ATTACK 8: Assignment status transitions correctly', async () => {
    // Get assignment for the offer we just created
    const { data: assignment } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', testQuoteRequest_Assigned_Id)
      .eq('supplier_id', testSupplierA_Id)
      .single();

    expect(assignment).toBeDefined();
    expect(assignment!.status).toBe('RESPONDED');
    expect(assignment!.responded_at).toBeDefined();

    // Verify timestamp order
    const sentAt = new Date(assignment!.sent_at);
    const viewedAt = new Date(assignment!.viewed_at);
    const respondedAt = new Date(assignment!.responded_at);

    expect(viewedAt >= sentAt).toBe(true);
    expect(respondedAt >= viewedAt).toBe(true);

    console.log('✓ ATTACK 8 PASSED: Status transitions work correctly');
  });
});
