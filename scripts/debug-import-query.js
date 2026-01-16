const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const importId = '68406ec1-4972-4b77-8335-06b21f31f757';
const tenantId = '00000000-0000-0000-0000-000000000001';

(async () => {
  console.log('Testing import case query...\n');

  // Test 1: Simple query
  const { data: simple, error: simpleError } = await supabase
    .from('imports')
    .select('*')
    .eq('id', importId)
    .eq('tenant_id', tenantId)
    .single();

  if (simpleError) {
    console.error('Simple query error:', simpleError);
  } else {
    console.log('✓ Simple query works');
    console.log('Import case found:', simple.id);
  }

  // Test 2: Query with restaurant join (without org_number)
  const { data: withRestaurant, error: restaurantError } = await supabase
    .from('imports')
    .select(`
      *,
      restaurant:restaurants!inner(id, name, contact_email, contact_phone)
    `)
    .eq('id', importId)
    .eq('tenant_id', tenantId)
    .single();

  if (restaurantError) {
    console.error('Restaurant join error:', restaurantError);
  } else {
    console.log('✓ Restaurant join works (without org_number)');
    console.log('Restaurant:', withRestaurant.restaurant);
  }

  // Test 3: Full query like in the service (with org_number)
  const { data: fullQuery, error: fullError } = await supabase
    .from('imports')
    .select(`
      *,
      restaurant:restaurants!inner(name, org_number, contact_email, contact_phone),
      importer:importers!inner(legal_name, org_number, contact_name, contact_email, contact_phone),
      delivery_location:direct_delivery_locations!inner(
        delivery_address_line1,
        delivery_address_line2,
        postal_code,
        city,
        country_code,
        contact_name,
        contact_email,
        contact_phone,
        consent_given,
        consent_timestamp
      )
    `)
    .eq('id', importId)
    .eq('tenant_id', tenantId)
    .single();

  if (fullError) {
    console.error('\n✗ Full query error:', fullError);
  } else {
    console.log('\n✓ Full query works!');
  }

  process.exit(0);
})();
