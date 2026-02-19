#!/usr/bin/env node
/**
 * Apply food_scan migration to Supabase
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
  console.log('🚀 Applying migration: food_scan_results + food_pairing_suggestions\n');
  console.log('='.repeat(60));

  // Table 1: food_scan_results
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS food_scan_results (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id   uuid REFERENCES restaurants(id) ON DELETE SET NULL,
      restaurant_name text NOT NULL,
      wolt_slug       text,
      city            text,
      scan_source     text NOT NULL DEFAULT 'wolt' CHECK (scan_source IN ('wolt', 'manual', 'trend')),
      total_dishes    integer NOT NULL DEFAULT 0,
      matched_dishes  integer NOT NULL DEFAULT 0,
      unmatched_dishes integer NOT NULL DEFAULT 0,
      dishes_json     jsonb NOT NULL DEFAULT '[]'::jsonb,
      scanned_at      timestamptz NOT NULL DEFAULT now(),
      created_at      timestamptz NOT NULL DEFAULT now()
    );
  `, 'Create food_scan_results table');

  await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_food_scan_results_restaurant ON food_scan_results(restaurant_id);`,
    'Create index on restaurant_id'
  );

  await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_food_scan_results_scanned_at ON food_scan_results(scanned_at DESC);`,
    'Create index on scanned_at'
  );

  // Table 2: food_pairing_suggestions
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS food_pairing_suggestions (
      id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dish_name               text NOT NULL,
      dish_name_original      text,
      source                  text NOT NULL DEFAULT 'wolt' CHECK (source IN ('wolt', 'manual', 'trend')),
      source_detail           text,
      suggested_colors        text[] NOT NULL DEFAULT '{}',
      suggested_regions       text[] NOT NULL DEFAULT '{}',
      suggested_grapes        text[] NOT NULL DEFAULT '{}',
      confidence              real NOT NULL DEFAULT 0.0,
      categorization_method   text,
      status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
      approved_colors         text[] NOT NULL DEFAULT '{}',
      approved_regions        text[] NOT NULL DEFAULT '{}',
      approved_grapes         text[] NOT NULL DEFAULT '{}',
      reviewed_by             uuid,
      reviewed_at             timestamptz,
      occurrence_count        integer NOT NULL DEFAULT 1,
      first_seen_at           timestamptz NOT NULL DEFAULT now(),
      last_seen_at            timestamptz NOT NULL DEFAULT now(),
      created_at              timestamptz NOT NULL DEFAULT now()
    );
  `, 'Create food_pairing_suggestions table');

  await executeSQL(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_food_pairing_suggestions_dish
      ON food_pairing_suggestions(dish_name)
      WHERE status NOT IN ('rejected');
  `, 'Create unique index on dish_name (deduplication)');

  await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_food_pairing_suggestions_status ON food_pairing_suggestions(status);`,
    'Create index on status'
  );

  await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_food_pairing_suggestions_occurrence ON food_pairing_suggestions(occurrence_count DESC);`,
    'Create index on occurrence_count'
  );

  // Reload schema cache
  await executeSQL(`NOTIFY pgrst, 'reload schema';`, 'Reload PostgREST schema cache');

  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 Verifying tables...\n');

  // Verify
  const { data: scanResults, error: e1 } = await supabase
    .from('food_scan_results')
    .select('id')
    .limit(1);

  if (e1) {
    console.error('❌ food_scan_results verification failed:', e1.message);
  } else {
    console.log('✅ food_scan_results — accessible');
  }

  const { data: suggestions, error: e2 } = await supabase
    .from('food_pairing_suggestions')
    .select('id')
    .limit(1);

  if (e2) {
    console.error('❌ food_pairing_suggestions verification failed:', e2.message);
  } else {
    console.log('✅ food_pairing_suggestions — accessible');
  }

  console.log('\n🎉 Migration complete!\n');
}

applyMigration().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
