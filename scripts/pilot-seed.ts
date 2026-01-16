/**
 * PILOT SEED KIT - Winefeed Golden Path Demo
 *
 * Creates a complete EU order + compliance demo with one command:
 * - Restaurant + user mapping
 * - Approved DDL
 * - EU supplier with default IOR
 * - Importer (IOR) + dual-role supplier user
 * - Request → Offer → Accept → Order (with auto-created import case)
 *
 * Usage: npx ts-node scripts/pilot-seed.ts
 * Or via wrapper: bash scripts/pilot-seed.sh
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Configuration
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const ORG_NUMBER = '556789-1234'; // Shared between supplier and importer (dual-role)

interface PilotData {
  tenant_id: string;
  user_id: string;
  restaurant_id: string;
  restaurant_name: string;
  ddl_id: string;
  supplier_id: string;
  supplier_name: string;
  importer_id: string;
  importer_name: string;
  request_id: string;
  offer_id: string;
  order_id: string;
  import_id: string | null;
}

async function main() {
  console.log('════════════════════════════════════════');
  console.log('🌟 Winefeed Pilot Seed Kit');
  console.log('════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Create/verify restaurant
    console.log('📍 Step 1: Create Restaurant...');
    const restaurant = await createRestaurant();
    console.log(`   ✓ Restaurant: ${restaurant.name} (${restaurant.id})`);
    console.log('');

    // Step 2: Map user to restaurant
    console.log('👤 Step 2: Map User to Restaurant...');
    await createRestaurantUser(restaurant.id);
    console.log(`   ✓ User ${USER_ID} → Restaurant ${restaurant.id}`);
    console.log('');

    // Step 3: Create approved DDL
    console.log('🏢 Step 3: Create Approved DDL...');
    const ddl = await createApprovedDDL(restaurant.id);
    console.log(`   ✓ DDL: ${ddl.delivery_address_line1}, ${ddl.city} (${ddl.id})`);
    console.log('');

    // Step 4: Create importer (IOR)
    console.log('🇸🇪 Step 4: Create Importer (IOR)...');
    const importer = await createImporter();
    console.log(`   ✓ Importer: ${importer.legal_name} (${importer.id})`);
    console.log(`   ✓ Org Number: ${importer.org_number}`);
    console.log('');

    // Step 5: Create EU supplier with matching org_number
    console.log('🇪🇺 Step 5: Create EU Supplier...');
    const supplier = await createEUSupplier(importer.id, importer.org_number);
    console.log(`   ✓ Supplier: ${supplier.namn} (${supplier.id})`);
    console.log(`   ✓ Type: ${supplier.type}`);
    console.log(`   ✓ Default IOR: ${supplier.default_importer_id}`);
    console.log('');

    // Step 6: Map user to supplier (dual-role support)
    console.log('👥 Step 6: Map User to Supplier (Dual-Role)...');
    await createSupplierUser(supplier.id);
    console.log(`   ✓ User ${USER_ID} → Supplier ${supplier.id}`);
    console.log(`   ✓ User now has both RESTAURANT and SELLER roles`);
    console.log(`   ✓ IOR role via org_number matching: ${ORG_NUMBER}`);
    console.log('');

    // Step 7: Create request
    console.log('📝 Step 7: Create Wine Request...');
    const request = await createRequest(restaurant.id);
    console.log(`   ✓ Request: ${request.title} (${request.id})`);
    console.log('');

    // Step 8: Create offer
    console.log('💰 Step 8: Create Offer...');
    const offer = await createOffer(restaurant.id, supplier.id);
    console.log(`   ✓ Offer: ${offer.title} (${offer.id})`);
    console.log('');

    // Step 9: Accept offer (creates order + auto-import case)
    console.log('✅ Step 9: Accept Offer (Create Order)...');
    const order = await acceptOffer(offer.id);
    console.log(`   ✓ Order: ${order.id}`);
    console.log(`   ✓ Status: ${order.status}`);
    console.log('');

    // Step 10: Verify import case auto-created
    console.log('🔍 Step 10: Verify Import Case Auto-Created...');
    const importCase = await verifyImportCase(order.id);
    if (importCase) {
      console.log(`   ✓ Import Case: ${importCase.id}`);
      console.log(`   ✓ Status: ${importCase.status}`);
      console.log(`   ✓ DDL: ${importCase.delivery_location_id}`);
    } else {
      console.log(`   ⚠ Import Case NOT auto-created (check logs)`);
    }
    console.log('');

    // Print summary
    console.log('════════════════════════════════════════');
    console.log('🎉 Pilot Seed Complete!');
    console.log('════════════════════════════════════════');
    console.log('');
    printURLs({
      tenant_id: TENANT_ID,
      user_id: USER_ID,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      ddl_id: ddl.id,
      supplier_id: supplier.id,
      supplier_name: supplier.namn,
      importer_id: importer.id,
      importer_name: importer.legal_name,
      request_id: request.id,
      offer_id: offer.id,
      order_id: order.id,
      import_id: importCase?.id || null
    });

  } catch (error: any) {
    console.error('');
    console.error('❌ Error during pilot seed:');
    console.error(error.message);
    console.error('');
    process.exit(1);
  }
}

// ============================================================================
// ENTITY CREATION FUNCTIONS
// ============================================================================

async function createRestaurant() {
  const name = `Pilot Restaurant ${Date.now()}`;

  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      tenant_id: TENANT_ID,
      name,
      contact_email: 'pilot@restaurant.se',
      contact_phone: '+46701234567',
      address: 'Restauranggatan 1, 111 22 Stockholm',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create restaurant: ${error.message}`);
  return data;
}

async function createRestaurantUser(restaurantId: string) {
  // Check if mapping already exists
  const { data: existing } = await supabase
    .from('restaurant_users')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('restaurant_id', restaurantId)
    .single();

  if (existing) {
    console.log('   (Already exists, skipping)');
    return;
  }

  const { error } = await supabase
    .from('restaurant_users')
    .insert({
      user_id: USER_ID,
      restaurant_id: restaurantId,
      tenant_id: TENANT_ID,
      created_at: new Date().toISOString()
    });

  if (error) throw new Error(`Failed to create restaurant_user: ${error.message}`);
}

async function createApprovedDDL(restaurantId: string) {
  const { data, error } = await supabase
    .from('direct_delivery_locations')
    .insert({
      tenant_id: TENANT_ID,
      restaurant_id: restaurantId,
      delivery_address_line1: 'Leveransgatan 123',
      postal_code: '123 45',
      city: 'Stockholm',
      contact_person: 'Lars Larsson',
      contact_phone: '+46701234567',
      status: 'APPROVED',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create DDL: ${error.message}`);
  return data;
}

async function createImporter() {
  const legalName = `Pilot IOR AB ${Date.now()}`;

  const { data, error } = await supabase
    .from('importers')
    .insert({
      tenant_id: TENANT_ID,
      legal_name: legalName,
      org_number: ORG_NUMBER,
      contact_name: 'Erik Eriksson',
      contact_email: 'erik@pilotior.se',
      contact_phone: '+46701234567',
      license_number: 'LIC-12345',
      license_verified: true,
      is_active: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create importer: ${error.message}`);
  return data;
}

async function createEUSupplier(importerId: string, orgNumber: string) {
  const namn = `Pilot EU Winery ${Date.now()}`;

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      tenant_id: TENANT_ID,
      namn,
      type: 'EU_PRODUCER',
      org_number: orgNumber, // Match importer for dual-role
      kontakt_email: 'info@pilotwinery.eu',
      kontakt_telefon: '+33123456789',
      land: 'France',
      default_importer_id: importerId,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create supplier: ${error.message}`);
  return data;
}

async function createSupplierUser(supplierId: string) {
  // Check if mapping already exists
  const { data: existing } = await supabase
    .from('supplier_users')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('supplier_id', supplierId)
    .single();

  if (existing) {
    console.log('   (Already exists, skipping)');
    return;
  }

  const { error } = await supabase
    .from('supplier_users')
    .insert({
      user_id: USER_ID,
      supplier_id: supplierId,
      created_at: new Date().toISOString()
    });

  if (error) throw new Error(`Failed to create supplier_user: ${error.message}`);
}

async function createRequest(restaurantId: string) {
  const title = `Pilot Wine Request ${Date.now()}`;

  const { data, error } = await supabase
    .from('requests')
    .insert({
      tenant_id: TENANT_ID,
      restaurant_id: restaurantId,
      title,
      beskrivning: 'Pilot seed request for EU wine order demonstration',
      status: 'OPEN',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create request: ${error.message}`);

  // Add wine to request
  await supabase.from('request_wines').insert({
    request_id: data.id,
    namn: 'Château Pilot 2020',
    producent: 'Pilot Winery',
    land: 'France',
    region: 'Bordeaux',
    vintage: 2020,
    antal: 24,
    enhet: 'bottle',
    anteckningar: 'Premium red wine for pilot demonstration'
  });

  return data;
}

async function createOffer(restaurantId: string, supplierId: string) {
  const title = `Pilot Offer ${Date.now()}`;

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .insert({
      tenant_id: TENANT_ID,
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      rubrik: title,
      valuta: 'SEK',
      status: 'PENDING',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (offerError) throw new Error(`Failed to create offer: ${offerError.message}`);

  // Add offer line
  await supabase.from('offer_lines').insert({
    offer_id: offer.id,
    rad_nr: 1,
    namn: 'Château Pilot 2020',
    årgång: 2020,
    antal: 24,
    erbjudet_á_pris_öre: 15000,
    flaska_ml: 750,
    förpackning: 'Hel låda 24st',
    kanoniskt_namn: 'Château Pilot',
    producent: 'Pilot Winery',
    land: 'France',
    region: 'Bordeaux'
  });

  return offer;
}

async function acceptOffer(offerId: string) {
  // Update offer status
  await supabase
    .from('offers')
    .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  // Call accept endpoint to create order
  const response = await fetch(`http://localhost:3000/api/offers/${offerId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
      'x-user-id': USER_ID
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to accept offer: ${response.status} ${errorData}`);
  }

  const data = await response.json();

  if (!data.order_id) {
    throw new Error('No order_id returned from accept endpoint');
  }

  // Fetch full order data
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', data.order_id)
    .single();

  if (error) throw new Error(`Failed to fetch order: ${error.message}`);
  return order;
}

async function verifyImportCase(orderId: string) {
  // Wait a bit for async import case creation
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { data: order } = await supabase
    .from('orders')
    .select('import_id')
    .eq('id', orderId)
    .single();

  if (!order?.import_id) {
    return null;
  }

  const { data: importCase } = await supabase
    .from('imports')
    .select('*')
    .eq('id', order.import_id)
    .single();

  return importCase;
}

// ============================================================================
// OUTPUT FUNCTIONS
// ============================================================================

function printURLs(data: PilotData) {
  const baseURL = 'http://localhost:3000';

  console.log('📱 Open these URLs in your browser:');
  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('RESTAURANT VIEW (Order Tracking):');
  console.log('─────────────────────────────────────────');
  console.log(`🍷 View Request:  ${baseURL}/dashboard/requests/${data.request_id}`);
  console.log(`📋 View All Orders: ${baseURL}/orders`);
  console.log(`📦 View Order:    ${baseURL}/orders/${data.order_id}`);
  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('SUPPLIER VIEW (Seller Dashboard):');
  console.log('─────────────────────────────────────────');
  console.log(`💼 View Offer:    ${baseURL}/supplier/offers/${data.offer_id}`);
  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('IOR VIEW (Compliance Console):');
  console.log('─────────────────────────────────────────');
  console.log(`🏛️  View All Orders: ${baseURL}/ior/orders`);
  console.log(`📑 View Order:     ${baseURL}/ior/orders/${data.order_id}`);
  if (data.import_id) {
    console.log(`🛂 View Import:    ${baseURL}/imports/${data.import_id}`);
  }
  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('ADMIN VIEW (Pilot Dashboard):');
  console.log('─────────────────────────────────────────');
  console.log(`⚙️  Pilot Admin:   ${baseURL}/admin/pilot`);
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('🔑 Test IDs (for manual testing):');
  console.log('════════════════════════════════════════');
  console.log(`TENANT_ID="${data.tenant_id}"`);
  console.log(`USER_ID="${data.user_id}"`);
  console.log(`RESTAURANT_ID="${data.restaurant_id}"`);
  console.log(`SUPPLIER_ID="${data.supplier_id}"`);
  console.log(`IMPORTER_ID="${data.importer_id}"`);
  console.log(`REQUEST_ID="${data.request_id}"`);
  console.log(`OFFER_ID="${data.offer_id}"`);
  console.log(`ORDER_ID="${data.order_id}"`);
  if (data.import_id) {
    console.log(`IMPORT_ID="${data.import_id}"`);
  }
  console.log('');
  console.log('💡 Tip: Use these IDs in smoke tests and manual testing');
  console.log('');
  console.log('🎯 Actor Roles for USER_ID:');
  console.log('   - RESTAURANT (via restaurant_users)');
  console.log('   - SELLER (via supplier_users)');
  console.log(`   - IOR (via org_number matching: ${ORG_NUMBER})`);
  console.log('');
  console.log('✅ Ready for pilot demonstration!');
  console.log('');
}

// Run main
main();
