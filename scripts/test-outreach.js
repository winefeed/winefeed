#!/usr/bin/env node
/**
 * Test Sommelier Outreach pipeline end-to-end
 *
 * 1. Check for existing scan results
 * 2. If none, create a test scan result
 * 3. Run the bridge (DishAnalysis → MatchingAgentInput)
 * 4. Check supplier_wines exist
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  console.log('=== Sommelier Outreach Test ===\n');

  // 1. Check scan results
  const { data: scans, error: scanErr } = await supabase
    .from('food_scan_results')
    .select('id, restaurant_name, total_dishes, matched_dishes, dishes_json')
    .order('scanned_at', { ascending: false })
    .limit(3);

  if (scanErr) {
    console.error('Error loading scans:', scanErr.message);
    return;
  }

  console.log(`Found ${scans.length} scan result(s)`);

  let scanId;

  if (scans.length === 0) {
    console.log('\nNo scans found — creating test scan result...');

    // Create a test scan result with realistic dishes
    const testDishes = [
      { dish_name: 'lamm', dish_name_original: 'Grillad lammstek med rosmarin', matched: true, match_key: 'lamm', colors: ['red'], regions: ['rhone', 'toscana'], grapes: ['Syrah', 'Sangiovese'], confidence: 95, method: 'exact' },
      { dish_name: 'lax', dish_name_original: 'Gravad lax med hovmästarsås', matched: true, match_key: 'lax', colors: ['white'], regions: ['bourgogne', 'alsace'], grapes: ['Chardonnay', 'Riesling'], confidence: 90, method: 'exact' },
      { dish_name: 'oxfile', dish_name_original: 'Oxfilé med rödvinssås', matched: true, match_key: 'oxfile', colors: ['red'], regions: ['bordeaux', 'rioja'], grapes: ['Cabernet Sauvignon', 'Tempranillo'], confidence: 92, method: 'exact' },
      { dish_name: 'pasta', dish_name_original: 'Pasta med tryffel och parmesan', matched: true, match_key: 'pasta', colors: ['red', 'white'], regions: ['piemonte', 'toscana'], grapes: ['Nebbiolo', 'Sangiovese'], confidence: 85, method: 'fuzzy' },
      { dish_name: 'dessert', dish_name_original: 'Crème brûlée', matched: true, match_key: 'dessert', colors: ['white'], regions: ['alsace', 'loire'], grapes: ['Muscat', 'Chenin Blanc'], confidence: 70, method: 'category' },
      { dish_name: 'pommes frites', dish_name_original: 'Pommes frites', matched: false, colors: [], regions: [], grapes: [], confidence: 0, method: 'none' },
    ];

    const { data: inserted, error: insertErr } = await supabase
      .from('food_scan_results')
      .insert({
        restaurant_name: 'Test Restaurang (Outreach)',
        wolt_slug: 'test-restaurang',
        city: 'Stockholm',
        scan_source: 'manual',
        total_dishes: testDishes.length,
        matched_dishes: testDishes.filter(d => d.matched).length,
        unmatched_dishes: testDishes.filter(d => !d.matched).length,
        dishes_json: testDishes,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Failed to insert test scan:', insertErr.message);
      return;
    }

    scanId = inserted.id;
    console.log(`Created test scan: ${scanId}`);
  } else {
    scanId = scans[0].id;
    const s = scans[0];
    const dishes = s.dishes_json || [];
    console.log(`\nUsing: "${s.restaurant_name}" (${s.matched_dishes}/${s.total_dishes} matched, ${dishes.length} dishes in JSON)`);
  }

  // 2. Check supplier wines
  const { count, error: wineErr } = await supabase
    .from('supplier_wines')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (wineErr) {
    console.error('Error checking supplier_wines:', wineErr.message);
  } else {
    console.log(`\nActive supplier wines: ${count}`);
  }

  // 3. Check wine_recommendations table
  const { data: recs, error: recErr } = await supabase
    .from('wine_recommendations')
    .select('id, restaurant_name, status')
    .limit(5);

  if (recErr) {
    console.error('Error checking wine_recommendations:', recErr.message);
  } else {
    console.log(`Existing recommendations: ${recs.length}`);
  }

  console.log(`\n=== Ready to test ===`);
  console.log(`\nScan result ID: ${scanId}`);
  console.log(`Use this to call: POST /api/admin/food-scan/recommend`);
  console.log(`Body: { "scan_result_id": "${scanId}" }`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
