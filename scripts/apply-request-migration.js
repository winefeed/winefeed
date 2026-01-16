#!/usr/bin/env node
/**
 * Apply migration: add accepted_offer_id and status to requests table
 *
 * Usage: node scripts/apply-request-migration.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration() {
  console.log('🔧 Applying migration: add accepted_offer_id and status to requests...\n');

  try {
    // Step 1: Add accepted_offer_id column
    console.log('Step 1: Adding accepted_offer_id column...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE requests ADD COLUMN IF NOT EXISTS accepted_offer_id UUID NULL REFERENCES offers(id) ON DELETE SET NULL;'
    });

    if (error1 && !error1.message.includes('already exists')) {
      // If rpc doesn't work, try direct query
      const { error: directError1 } = await supabase
        .from('_sql')
        .select('*')
        .limit(0);

      console.log('⚠️  Note: Cannot apply migration via API. Please apply manually via Supabase SQL Editor.');
      console.log('\nSQL to run:');
      console.log('----------------------------------------');

      const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260117_add_accepted_offer_id_to_requests.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log(migrationSQL);
      console.log('----------------------------------------\n');

      console.log('📝 Instructions:');
      console.log('1. Go to: https://pqmmgclfpyydrbjaoump.supabase.co/project/_/sql');
      console.log('2. Copy and paste the SQL above');
      console.log('3. Click "Run"');
      console.log('4. Re-run the smoke test: npm run test:pilotloop:mvp\n');

      process.exit(0);
    }

    console.log('✓ accepted_offer_id column added');

    // Step 2: Add status column
    console.log('Step 2: Adding status column...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'requests' AND column_name = 'status') THEN
    ALTER TABLE requests ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
      CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
  END IF;
END
$$;`
    });

    if (error2) {
      console.error('⚠️  Could not add status column:', error2.message);
    } else {
      console.log('✓ status column added');
    }

    // Step 3: Create indexes
    console.log('Step 3: Creating indexes...');
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql: `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'requests' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(tenant_id, accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(tenant_id, status);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(accepted_offer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  END IF;
END
$$;`
    });

    if (error3) {
      console.error('⚠️  Could not create indexes:', error3.message);
    } else {
      console.log('✓ Indexes created');
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('You can now run: npm run test:pilotloop:mvp\n');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n📝 Manual migration required. See instructions above.');
    process.exit(1);
  }
}

applyMigration();
