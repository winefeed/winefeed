#!/usr/bin/env node
/**
 * Apply wine_recommendations migration to Supabase
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
  console.log('🚀 Applying migration: wine_recommendations\n');
  console.log('='.repeat(60));

  await executeSQL(`
    CREATE TABLE IF NOT EXISTS wine_recommendations (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      scan_result_id    uuid REFERENCES food_scan_results(id) ON DELETE SET NULL,
      restaurant_name   text NOT NULL,
      recommended_wines jsonb NOT NULL DEFAULT '[]'::jsonb,
      email_subject     text,
      email_html        text,
      email_text        text,
      recipient_email   text,
      status            text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','failed')),
      sent_at           timestamptz,
      resend_id         text,
      dominant_styles   text[] NOT NULL DEFAULT '{}',
      created_at        timestamptz NOT NULL DEFAULT now()
    );
  `, 'Create wine_recommendations table');

  await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_wine_rec_status ON wine_recommendations(status);`,
    'Create index on status'
  );

  await executeSQL(
    `CREATE INDEX IF NOT EXISTS idx_wine_rec_scan ON wine_recommendations(scan_result_id);`,
    'Create index on scan_result_id'
  );

  // Reload schema cache
  await executeSQL(`NOTIFY pgrst, 'reload schema';`, 'Reload PostgREST schema cache');

  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 Verifying table...\n');

  const { data, error } = await supabase
    .from('wine_recommendations')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌ wine_recommendations verification failed:', error.message);
  } else {
    console.log('✅ wine_recommendations — accessible');
  }

  console.log('\n🎉 Migration complete!\n');
}

applyMigration().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
