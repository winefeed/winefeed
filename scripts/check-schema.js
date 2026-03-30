// Check actual schema from Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  // Try to get one row to see columns
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Restaurants columns:', data && data[0] ? Object.keys(data[0]) : 'No data');
  }

  // Check importers
  const { data: importers } = await supabase
    .from('importers')
    .select('*')
    .limit(1);
  console.log('Importers columns:', importers && importers[0] ? Object.keys(importers[0]) : 'No data');

  // Check suppliers
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .limit(1);
  console.log('Suppliers columns:', suppliers && suppliers[0] ? Object.keys(suppliers[0]) : 'No data');
}

checkSchema();
