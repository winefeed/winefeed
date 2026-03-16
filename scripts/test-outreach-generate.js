#!/usr/bin/env node
/**
 * Test: Bridge logic + supplier wine check for outreach
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SCAN_ID = '1d403300-4657-4f8d-9da9-44caee0340f2';

function topByFrequency(items, topN) {
  const freq = {};
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (key) freq[key] = (freq[key] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key]) => key);
}

async function run() {
  console.log('=== Test: Bridge + Supplier Wines ===\n');

  // 1. Load scan result
  const { data: scan, error } = await supabase
    .from('food_scan_results')
    .select('*')
    .eq('id', SCAN_ID)
    .single();

  if (error || !scan) {
    console.error('Scan not found:', error ? error.message : 'null');
    return;
  }

  console.log('Restaurant:', scan.restaurant_name);
  console.log('Dishes:', scan.total_dishes, '(' + scan.matched_dishes + ' matched)');

  const dishes = scan.dishes_json || [];
  const matched = dishes.filter(function(d) { return d.matched; });

  // 2. Bridge logic
  const allColors = matched.flatMap(function(d) { return d.colors; });
  const allRegions = matched.flatMap(function(d) { return d.regions; });
  const allGrapes = matched.flatMap(function(d) { return d.grapes; });

  const topColors = topByFrequency(allColors, 3);
  const topRegions = topByFrequency(allRegions, 3);
  const topGrapes = topByFrequency(allGrapes, 5);

  const topDishes = matched
    .sort(function(a, b) { return b.confidence - a.confidence; })
    .slice(0, 5)
    .map(function(d) { return d.dish_name_original || d.dish_name; });

  console.log('\n--- Bridge Output ---');
  console.log('Top colors:', topColors);
  console.log('Top regions:', topRegions);
  console.log('Top grapes:', topGrapes);
  console.log('Top dishes:', topDishes);

  const fritext = 'Restaurang ' + scan.restaurant_name + ' serverar ' + topDishes.join(', ') +
    '. Dominerande vinfärger: ' + topColors.join(', ') +
    '. Bra druvor: ' + topGrapes.join(', ') +
    '. Vinkarta bör matcha menyns profil.';
  console.log('\nFritext:', fritext);

  // 3. Check supplier wines
  const { data: wines, error: wineErr } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, color, grape, country, region, price_ex_vat_sek')
    .eq('is_active', true)
    .limit(25);

  if (wineErr) {
    console.error('Wine query error:', wineErr.message);
    return;
  }

  console.log('\n--- Supplier Wines (' + wines.length + ') ---');
  wines.slice(0, 10).forEach(function(w) {
    console.log('  ' + w.name + ' (' + w.producer + ') — ' + w.color + ', ' + w.grape + ', ' + w.country + ' — ' + w.price_ex_vat_sek + ' kr');
  });

  console.log('\n=== Bridge test PASSED ===');
  console.log('\nReady for full pipeline test via browser.');
  console.log('Open: http://localhost:3003/admin/food-scan');
  console.log('Go to Historik tab → click "Vinförslag" on "' + scan.restaurant_name + '"');
}

run().catch(function(err) {
  console.error('Fatal:', err);
  process.exit(1);
});
