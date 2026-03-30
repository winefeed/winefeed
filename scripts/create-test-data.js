// Create test data for Import Case using Supabase API
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function createTestData() {
  try {
    console.log('🚀 Creating test data...\n');

    // First, check if there's any existing restaurant we can reuse
    const { data: existingRestaurants } = await supabase
      .from('restaurants')
      .select('id, name')
      .limit(1);

    let restaurant;
    if (existingRestaurants && existingRestaurants.length > 0) {
      restaurant = existingRestaurants[0];
      console.log('✅ Using existing restaurant:', restaurant.id, '-', restaurant.name);
    } else {
      console.log('⚠️  No existing restaurants found.');
      console.log('   You may need to create a user first via Supabase Auth.');
      throw new Error('No restaurants available. Create a user via Supabase Auth first.');
    }

    // 2. Create importer
    const { data: importer, error: importerError } = await supabase
      .from('importers')
      .insert({
        tenant_id: TENANT_ID,
        legal_name: 'Test Importer AB',
        org_number: '559876-5432',
        contact_name: 'Anna Andersson',
        contact_email: 'anna@testimporter.se',
        contact_phone: '+46709876543',
        type: 'SE'
      })
      .select()
      .single();

    if (importerError) throw new Error(`Importer: ${importerError.message}`);
    console.log('✅ Importer created:', importer.id);

    // 3. Create supplier (optional)
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        namn: 'Test Vinleverantör AB',
        org_number: '551234-5678',
        kontakt_email: 'order@testvin.se',
        telefon: '+46708765432',
        type: 'SE'
      })
      .select()
      .single();

    if (supplierError) throw new Error(`Supplier: ${supplierError.message}`);
    console.log('✅ Supplier created:', supplier.id);

    // 4. Create approved Direct Delivery Location
    const { data: ddl, error: ddlError } = await supabase
      .from('direct_delivery_locations')
      .insert({
        tenant_id: TENANT_ID,
        restaurant_id: restaurant.id,
        importer_id: importer.id,
        legal_name: 'Test Restaurant Stockholm AB',
        org_number: '556789-1234',
        delivery_address_line1: 'Testgatan 123',
        postal_code: '11456',
        city: 'Stockholm',
        country_code: 'SE',
        contact_name: 'Erik Eriksson',
        contact_email: 'erik@testrestaurant.se',
        contact_phone: '+46701112233',
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        status: 'APPROVED'
      })
      .select()
      .single();

    if (ddlError) throw new Error(`DDL: ${ddlError.message}`);
    console.log('✅ Direct Delivery Location created:', ddl.id);

    console.log('\n========================================');
    console.log('✅ TEST DATA CREATED - USE THESE IDS:');
    console.log('========================================');
    console.log('Restaurant ID:        ', restaurant.id);
    console.log('Importer ID:          ', importer.id);
    console.log('Delivery Location ID: ', ddl.id);
    console.log('Supplier ID (optional):', supplier.id);
    console.log('========================================\n');

    console.log('📋 COPY THESE TO THE FORM:');
    console.log(`Restaurant ID: ${restaurant.id}`);
    console.log(`Importer ID: ${importer.id}`);
    console.log(`Delivery Location ID: ${ddl.id}`);
    console.log(`Supplier ID: ${supplier.id}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestData();
