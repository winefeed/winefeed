#!/usr/bin/env node
/**
 * Apply migration directly to Supabase using service role
 * Adds accepted_offer_id and status to requests table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
});

async function executeSQL(sql, description) {
  console.log(`\n📝 ${description}...`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return false;
    }

    console.log(`✅ Success`);
    return true;
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return false;
  }
}

async function applyMigration() {
  console.log('🚀 Applying migration: add accepted_offer_id and status to requests\n');
  console.log('=' .repeat(60));

  // Step 1: Add accepted_offer_id column
  let success = await executeSQL(
    `ALTER TABLE requests ADD COLUMN IF NOT EXISTS accepted_offer_id UUID NULL;`,
    'Step 1: Add accepted_offer_id column'
  );

  if (!success) {
    console.log('\n⚠️  Column may already exist, continuing...\n');
  }

  // Step 2: Add foreign key constraint
  success = await executeSQL(
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'requests_accepted_offer_id_fkey'
      ) THEN
        ALTER TABLE requests
        ADD CONSTRAINT requests_accepted_offer_id_fkey
        FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL;
      END IF;
    END $$;`,
    'Step 2: Add FK constraint to offers'
  );

  // Step 3: Add status column
  success = await executeSQL(
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'requests' AND column_name = 'status'
      ) THEN
        ALTER TABLE requests ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'));
      END IF;
    END $$;`,
    'Step 3: Add status column with CHECK constraint'
  );

  // Step 4: Create indexes (without tenant_id)
  success = await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_requests_accepted_offer ON requests(accepted_offer_id);`,
    'Step 4a: Create index on accepted_offer_id'
  );

  success = await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);`,
    'Step 4b: Create index on status'
  );

  // Step 5: Add comments
  success = await executeSQL(
    `COMMENT ON COLUMN requests.accepted_offer_id IS 'FK to accepted offer (pilot loop 1.0) - only 1 accepted offer per request';`,
    'Step 5a: Add comment on accepted_offer_id'
  );

  success = await executeSQL(
    `COMMENT ON COLUMN requests.status IS 'Request status: OPEN (awaiting offers), ACCEPTED (offer accepted), CLOSED, CANCELLED';`,
    'Step 5b: Add comment on status'
  );

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Migration completed!\n');

  // Verify the changes
  console.log('🔍 Verifying migration...\n');

  const { data: columns, error } = await supabase
    .from('requests')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Verification failed:', error.message);
  } else {
    console.log('✅ Verification successful - requests table updated');
    if (columns && columns.length > 0) {
      const cols = Object.keys(columns[0]);
      console.log('\n📊 Available columns:', cols.join(', '));
      console.log('\n✓ accepted_offer_id present:', cols.includes('accepted_offer_id'));
      console.log('✓ status present:', cols.includes('status'));
    }
  }

  console.log('\n🎉 You can now run: npm run test:pilotloop:mvp\n');
}

applyMigration().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
