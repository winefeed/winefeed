const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  console.log('Checking restaurants table columns...\n');

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', 'ad82ba05-3496-4c79-a25c-e2a591692820')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Restaurant data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\nColumns present:', Object.keys(data));
    console.log('\nHas org_number?', 'org_number' in data);
    console.log('org_number value:', data.org_number);
  }

  process.exit(0);
})();
