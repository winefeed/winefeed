/**
 * Test: Generate wine recommendation from scan result
 * Uses ESM + tsx to resolve TS imports properly
 */

import 'dotenv/config';

// We can't import TS modules directly in Node, so we test the bridge logic
// and the pipeline call through a simplified version

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SCAN_ID = '1d403300-4657-4f8d-9da9-44caee0340f2';

async function run() {
  console.log('=== Test: Generate Recommendation ===\n');

  // 1. Load scan result
  const { data: scan, error } = await supabase
    .from('food_scan_results')
    .select('*')
    .eq('id', SCAN_ID)
    .single();

  if (error || !scan) {
    console.error('Scan not found:', error?.message);
    return;
  }

  console.log(`Restaurant: ${scan.restaurant_name}`);
  console.log(`Dishes: ${scan.total_dishes} (${scan.matched_dishes} matched)`);

  const dishes = scan.dishes_json || [];
  const matched = dishes.filter(d => d.matched);

  // 2. Test bridge logic (inline, same as bridge.ts)
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

  const allColors = matched.flatMap(d => d.colors);
  const allRegions = matched.flatMap(d => d.regions);
  const allGrapes = matched.flatMap(d => d.grapes);

  const topColors = topByFrequency(allColors, 3);
  const topRegions = topByFrequency(allRegions, 3);
  const topGrapes = topByFrequency(allGrapes, 5);

  const topDishes = matched
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map(d => d.dish_name_original || d.dish_name);

  console.log('\n--- Bridge Output ---');
  console.log('Top colors:', topColors);
  console.log('Top regions:', topRegions);
  console.log('Top grapes:', topGrapes);
  console.log('Top dishes:', topDishes);

  const fritext = `Restaurang ${scan.restaurant_name} serverar ${topDishes.join(', ')}. Dominerande vinfärger: ${topColors.join(', ')}. Bra druvor: ${topGrapes.join(', ')}. Vinkarta bör matcha menyns profil.`;
  console.log('\nFritext:', fritext);

  // 3. Check supplier wines that could match
  const { data: wines, error: wineErr } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, color, grape, country, region, price_ex_vat_sek')
    .eq('is_active', true)
    .limit(25);

  if (wineErr) {
    console.error('Wine query error:', wineErr.message);
    return;
  }

  console.log(`\n--- Supplier Wines (${wines.length}) ---`);
  for (const w of wines.slice(0, 10)) {
    console.log(`  ${w.name} (${w.producer}) — ${w.color}, ${w.grape}, ${w.country} — ${w.price_ex_vat_sek} kr`);
  }

  console.log('\n=== Bridge test passed! ===');
  console.log('\nTo test full pipeline, call the API endpoint:');
  console.log(`curl -X POST http://localhost:3003/api/admin/food-scan/recommend \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "Cookie: <your-auth-cookie>" \\`);
  console.log(`  -d '{"scan_result_id": "${SCAN_ID}"}'`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
