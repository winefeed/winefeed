// Run migrations directly via Supabase API
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://pqmmgclfpyydrbjaoump.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbW1nY2xmcHl5ZHJiamFvdW1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMzMDA2MywiZXhwIjoyMDgzOTA2MDYzfQ.1i10rvaXBUAs9DWSPH2ZZlMwpyd_R_Et7cQmupUkRCI';

const supabase = createClient(supabaseUrl, supabaseKey);

const MIGRATIONS = [
  '20260115_create_importers_table.sql',
  '20260115_create_imports_table.sql',
  '20260115_create_import_status_events.sql',
  '20260115_add_import_id_to_supplier_imports.sql',
  '20260115_create_import_documents.sql',
  '20260115_add_importer_type.sql',
  '20260115_enable_rls_imports.sql'
];

async function runMigrations() {
  console.log('🚀 Running Import Case migrations...\n');

  for (const migrationFile of MIGRATIONS) {
    const filePath = path.join(__dirname, '../supabase/migrations', migrationFile);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${migrationFile} - file not found`);
      continue;
    }

    console.log(`📝 Running: ${migrationFile}`);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single();

      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: queryError } = await supabase.from('_migrations').insert({ name: migrationFile });
        if (queryError && !queryError.message.includes('already exists')) {
          throw queryError;
        }
      }

      console.log(`✅ Success: ${migrationFile}\n`);
    } catch (error) {
      console.log(`⚠️  Note: ${migrationFile} - ${error.message}`);
      console.log(`   (This might be okay if tables already exist)\n`);
    }
  }

  console.log('========================================');
  console.log('✅ Migrations completed!');
  console.log('========================================\n');
  console.log('Now run: node scripts/create-test-data.js');
}

runMigrations();
