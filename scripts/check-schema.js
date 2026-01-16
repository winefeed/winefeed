// Check actual schema from Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pqmmgclfpyydrbjaoump.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbW1nY2xmcHl5ZHJiamFvdW1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMzMDA2MywiZXhwIjoyMDgzOTA2MDYzfQ.1i10rvaXBUAs9DWSPH2ZZlMwpyd_R_Et7cQmupUkRCI';

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
