import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration Test: Draft List to Quote Request Flow
 *
 * This test validates the new draft list feature:
 * 1. Restaurant user finds wines in catalog
 * 2. Restaurant adds wines to draft list (client-side state)
 * 3. Restaurant sends draft list → creates quote request
 * 4. Request items are saved with wine details
 * 5. Assignments are created for suppliers
 * 6. Suppliers can view the request
 *
 * Tests:
 * - Request creation from draft items
 * - Request items saved correctly
 * - Supplier assignments created
 * - Provorder flag preserved
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

let supabase: SupabaseClient;
let testRestaurantId: string;
let testRestaurantUserId: string;
let testSupplierId: string;
let testSupplierUserId: string;
let testWineId: string;
let testRequestId: string;

describe('Draft List Flow (Integration)', () => {
  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Setup: Create restaurant user
    const { data: restaurantAuth } = await supabase.auth.admin.createUser({
      email: `restaurant-draft-${Date.now()}@example.com`,
      password: 'RestaurantPass123!',
      email_confirm: true,
      user_metadata: { name: 'Draft Test Restaurant' },
    });
    testRestaurantUserId = restaurantAuth.user!.id;

    // Setup: Create restaurant (note: restaurants table doesn't have tenant_id)
    // Use upsert in case a trigger already created the restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .upsert({
        id: testRestaurantUserId,
        name: 'Draft Test Restaurant',
        contact_email: restaurantAuth.user!.email,
      }, { onConflict: 'id' })
      .select()
      .single();

    if (restaurantError) {
      console.error('Failed to create restaurant:', restaurantError);
      throw new Error(`Restaurant creation failed: ${restaurantError.message}`);
    }
    testRestaurantId = restaurant!.id;

    // Setup: Create restaurant_users link
    // Schema: id, user_id, restaurant_id, tenant_id, created_at
    await supabase.from('restaurant_users').upsert({
      id: crypto.randomUUID(),
      user_id: testRestaurantUserId,
      restaurant_id: testRestaurantId,
      tenant_id: TEST_TENANT_ID,
    }, { onConflict: 'user_id,restaurant_id' }).select();

    // Setup: Create supplier
    const { data: supplierAuth } = await supabase.auth.admin.createUser({
      email: `supplier-draft-${Date.now()}@example.com`,
      password: 'SupplierPass123!',
      email_confirm: true,
    });
    testSupplierUserId = supplierAuth.user!.id;

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        namn: 'Draft Test Supplier AB',
        kontakt_email: supplierAuth.user!.email,
        // Note: suppliers table doesn't have tenant_id
      })
      .select()
      .single();

    if (supplierError) {
      console.error('Failed to create supplier:', supplierError);
      throw new Error(`Supplier creation failed: ${supplierError.message}`);
    }
    testSupplierId = supplier!.id;

    // Setup: Create supplier_users link
    // Schema: id, supplier_id, role, is_active, created_at, updated_at
    const { error: suError } = await supabase.from('supplier_users').upsert({
      id: testSupplierUserId,
      supplier_id: testSupplierId,
      role: 'admin',
      is_active: true,
    }, { onConflict: 'id' });

    if (suError) {
      console.error('Failed to create supplier_users:', suError);
    }

    // Setup: Create a wine in supplier catalog
    // Required fields: name, producer, country, vintage, color, bottle_size_ml, stock_qty, sku, case_size
    const { data: wine, error: wineError } = await supabase
      .from('supplier_wines')
      .insert({
        supplier_id: testSupplierId,
        name: 'Test Bordeaux 2019',
        producer: 'Château Test',
        country: 'France',
        region: 'Bordeaux',
        vintage: 2019,
        color: 'red',
        grape: 'Cabernet Sauvignon',
        price_ex_vat_sek: 35000, // 350 SEK in öre
        moq: 6,
        stock_qty: 100,
        is_active: true,
        bottle_size_ml: 750,
        sku: `TEST-DRAFT-${Date.now()}`,
        case_size: 6,
      })
      .select()
      .single();

    if (wineError) {
      console.error('Failed to create wine:', wineError);
      throw new Error(`Wine creation failed: ${wineError.message}`);
    }
    testWineId = wine!.id;

    console.log('✓ Test setup complete: restaurant, supplier, wine');
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testRequestId) {
      await supabase.from('request_items').delete().eq('request_id', testRequestId);
      await supabase.from('quote_request_assignments').delete().eq('quote_request_id', testRequestId);
      await supabase.from('requests').delete().eq('id', testRequestId);
    }
    if (testWineId) await supabase.from('supplier_wines').delete().eq('id', testWineId);
    if (testSupplierId) await supabase.from('suppliers').delete().eq('id', testSupplierId);
    if (testRestaurantId) await supabase.from('restaurants').delete().eq('id', testRestaurantId);
    if (testRestaurantUserId) await supabase.auth.admin.deleteUser(testRestaurantUserId);
    if (testSupplierUserId) await supabase.auth.admin.deleteUser(testSupplierUserId);
  });

  it('Step 1: Send draft list creates quote request', async () => {
    const draftItems = [
      {
        wine_id: testWineId,
        wine_name: 'Test Bordeaux 2019',
        producer: 'Château Test',
        country: 'France',
        region: 'Bordeaux',
        vintage: 2019,
        color: 'red',
        supplier_id: testSupplierId,
        supplier_name: 'Draft Test Supplier AB',
        quantity: 12,
        moq: 6,
        price_sek: 350,
        stock: 100,
        provorder: false,
      },
    ];

    const response = await fetch('http://localhost:3000/api/draft-list/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TEST_TENANT_ID,
        'x-user-id': testRestaurantUserId,
      },
      body: JSON.stringify({ items: draftItems }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.request_id).toBeDefined();
    expect(data.assignments_created).toBe(1);
    expect(data.suppliers_notified).toBe(1);

    testRequestId = data.request_id;

    console.log('✓ Quote request created:', testRequestId);
    console.log('  Assignments created:', data.assignments_created);
  });

  it('Step 2: Request is saved with correct data', async () => {
    const { data: request } = await supabase
      .from('requests')
      .select('*')
      .eq('id', testRequestId)
      .single();

    expect(request).toBeDefined();
    expect(request!.restaurant_id).toBe(testRestaurantId);
    expect(request!.fritext).toContain('Test Bordeaux 2019');
    expect(request!.antal_flaskor).toBe(12);
    expect(request!.status).toBe('OPEN');

    console.log('✓ Request saved correctly');
  });

  it('Step 3: Request items are saved', async () => {
    const { data: items } = await supabase
      .from('request_items')
      .select('*')
      .eq('request_id', testRequestId);

    expect(items).toBeDefined();
    expect(items!.length).toBe(1);

    const item = items![0];
    expect(item.wine_id).toBe(testWineId);
    expect(item.supplier_id).toBe(testSupplierId);
    expect(item.wine_name).toBe('Test Bordeaux 2019');
    expect(item.producer).toBe('Château Test');
    expect(item.country).toBe('France');
    expect(item.quantity).toBe(12);
    expect(item.price_sek).toBe(35000); // Converted to öre
    expect(item.provorder).toBe(false);

    console.log('✓ Request items saved correctly');
  });

  it('Step 4: Supplier assignment is created', async () => {
    const { data: assignments } = await supabase
      .from('quote_request_assignments')
      .select('*')
      .eq('quote_request_id', testRequestId);

    expect(assignments).toBeDefined();
    expect(assignments!.length).toBe(1);

    const assignment = assignments![0];
    expect(assignment.supplier_id).toBe(testSupplierId);
    expect(assignment.status).toBe('SENT');
    expect(assignment.sent_at).toBeDefined();
    expect(assignment.expires_at).toBeDefined();

    // Expires in ~48 hours
    const expiresAt = new Date(assignment.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(hoursUntilExpiry).toBeGreaterThan(47);
    expect(hoursUntilExpiry).toBeLessThan(49);

    console.log('✓ Supplier assignment created (expires in ~48h)');
  });

  it('Step 5: Send draft list with provorder item', async () => {
    const draftItems = [
      {
        wine_id: testWineId,
        wine_name: 'Test Bordeaux 2019',
        producer: 'Château Test',
        country: 'France',
        region: 'Bordeaux',
        vintage: 2019,
        color: 'red',
        supplier_id: testSupplierId,
        supplier_name: 'Draft Test Supplier AB',
        quantity: 2, // Below MOQ of 6
        moq: 6,
        price_sek: 350,
        stock: 100,
        provorder: true, // Discovery Mode
        provorder_fee: 500,
      },
    ];

    const response = await fetch('http://localhost:3000/api/draft-list/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TEST_TENANT_ID,
        'x-user-id': testRestaurantUserId,
      },
      body: JSON.stringify({ items: draftItems }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.provorder_count).toBe(1);
    expect(data.provorder_fees_total).toBe(500);

    // Verify request item has provorder flag
    const { data: items } = await supabase
      .from('request_items')
      .select('*')
      .eq('request_id', data.request_id);

    const provorderItem = items?.find(i => i.provorder === true);
    expect(provorderItem).toBeDefined();
    expect(provorderItem!.provorder_fee).toBe(500);

    // Cleanup this extra request
    await supabase.from('request_items').delete().eq('request_id', data.request_id);
    await supabase.from('quote_request_assignments').delete().eq('quote_request_id', data.request_id);
    await supabase.from('requests').delete().eq('id', data.request_id);

    console.log('✓ Provorder item saved correctly (fee: 500 SEK)');
  });

  it('Step 6: Rejects empty draft list', async () => {
    const response = await fetch('http://localhost:3000/api/draft-list/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TEST_TENANT_ID,
        'x-user-id': testRestaurantUserId,
      },
      body: JSON.stringify({ items: [] }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('No items');

    console.log('✓ Empty draft list rejected');
  });

  it('Step 7: Rejects unauthenticated request', async () => {
    const response = await fetch('http://localhost:3000/api/draft-list/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No auth headers
      },
      body: JSON.stringify({ items: [{ wine_id: testWineId }] }),
    });

    expect(response.status).toBe(401);

    console.log('✓ Unauthenticated request rejected');
  });
});
