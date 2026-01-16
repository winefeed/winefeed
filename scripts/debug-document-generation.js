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
  console.log('Testing EXACT query from import-document-service.ts...\n');

  // EXACT query from line 81-107 of import-document-service.ts
  const { data: importCase, error: fetchError } = await supabase
    .from('imports')
    .select(`
      id,
      tenant_id,
      restaurant_id,
      importer_id,
      delivery_location_id,
      created_at,
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

  if (fetchError || !importCase) {
    console.error('❌ Query FAILED');
    console.error('Error:', fetchError);
    console.error('Data:', importCase);
  } else {
    console.log('✅ Query SUCCESS!');
    console.log('\nImport Case ID:', importCase.id);
    console.log('Restaurant:', importCase.restaurant?.name);
    console.log('Importer:', importCase.importer?.legal_name);
    console.log('Delivery Location:', importCase.delivery_location?.city);

    console.log('\n--- Full data ---');
    console.log(JSON.stringify(importCase, null, 2));
  }

  process.exit(0);
})();
