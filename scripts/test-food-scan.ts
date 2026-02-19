/**
 * Test Food Scan — visar resultat med uppdaterade 2026-tabeller
 *
 * Kör: npx tsx scripts/test-food-scan.ts
 */

import { FOOD_TO_WINE_STYLES } from '../lib/matching-agent/food-pairing';
import { STYLE_TO_CHARACTERISTICS } from '../lib/matching-agent/food-pairing';
import { lookupFoodPairing } from '../lib/matching-agent/food-pairing';
import { analyzeDishes } from '../lib/food-scan/menu-analyzer';
import type { WoltMenuItem } from '../lib/food-scan/types';

// ============================================================================
// 1. Tabellstatistik
// ============================================================================
console.log('═══════════════════════════════════════════════════════════');
console.log('  FOOD SCAN AGENT — Testresultat');
console.log('═══════════════════════════════════════════════════════════\n');

const foodKeys = Object.keys(FOOD_TO_WINE_STYLES);
const styleKeys = Object.keys(STYLE_TO_CHARACTERISTICS);
console.log(`📊 Tabellstatistik:`);
console.log(`   Rätter i FOOD_TO_WINE_STYLES: ${foodKeys.length}`);
console.log(`   Stilar i STYLE_TO_CHARACTERISTICS: ${styleKeys.length}`);

// Unika regioner och druvor
const allRegions = new Set<string>();
const allGrapes = new Set<string>();
for (const pref of Object.values(FOOD_TO_WINE_STYLES)) {
  pref.regions.forEach(r => allRegions.add(r));
  pref.grapes.forEach(g => allGrapes.add(g));
}
console.log(`   Unika regioner: ${allRegions.size}`);
console.log(`   Unika druvor: ${allGrapes.size}`);

// 2026-specifika
const new2026Regions = ['naoussa', 'txakoli', 'dão', 'lisboa', 'alentejo', 'umbria', 'alto adige', 'clare valley', 'washington state', 'valle de guadalupe', 'lambrusco', 'tavel', 'niederösterreich', 'stellenbosch', 'friuli'];
const new2026Grapes = ['Xinomavro', 'Touriga Nacional', 'Castelão', 'Nerello Mascalese', 'Fiano', 'Frappato', 'Zweigelt', 'Pinot Bianco', 'Lagrein', 'Barbera', 'Dolcetto', 'Friulano', 'Hondarrabi Zuri', 'Lambrusco', 'Vidiano'];

const coveredRegions = new2026Regions.filter(r => allRegions.has(r));
const coveredGrapes = new2026Grapes.filter(g => allGrapes.has(g));
console.log(`\n🆕 2026-trender täckta:`);
console.log(`   Regioner: ${coveredRegions.length}/${new2026Regions.length} — ${coveredRegions.join(', ')}`);
console.log(`   Druvor: ${coveredGrapes.length}/${new2026Grapes.length} — ${coveredGrapes.join(', ')}`);

// ============================================================================
// 2. Simulera en typisk restaurangmeny (Rolfs Kök-liknande)
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  Simulerad menyscanning — "Restaurang Stockholm" ');
console.log('═══════════════════════════════════════════════════════════\n');

const fakeMeny: WoltMenuItem[] = [
  { name: 'Grillad lammkarré med rosmarin', category: 'Kött' },
  { name: 'Oxfilé med rödvinssky', category: 'Kött' },
  { name: 'Kycklingbröst med citron och timjan', category: 'Kyckling' },
  { name: 'Pulled pork tacos', category: 'Street food' },
  { name: 'Halloumi bowl med hummus', category: 'Vegetariskt' },
  { name: 'Ceviche på havskräfta', category: 'Förrätt' },
  { name: 'Toast Skagen med räkor', category: 'Förrätt' },
  { name: 'Pasta carbonara', category: 'Pasta' },
  { name: 'Pizza Margherita', category: 'Pizza' },
  { name: 'Risotto med Karl Johan-svamp', category: 'Vegetariskt' },
  { name: 'Hjortfilé med svartvinbärssås', category: 'Vilt' },
  { name: 'Stekt torsk med brynt smör', category: 'Fisk' },
  { name: 'Laxtataki med sojasås', category: 'Sushi' },
  { name: 'Entrecote med bearnaisesås', category: 'Kött' },
  { name: 'Thai green curry', category: 'Thai' },
  { name: 'Sushi moriawase', category: 'Sushi' },
  { name: 'Crème brûlée', category: 'Dessert' },
  { name: 'Chokladfondant', category: 'Dessert' },
  { name: 'Tacos al pastor', category: 'Street food' },
  { name: 'Vitlöksstekt sjurygg med dillsås', category: 'Fisk' },
  { name: 'Mezze tallrik med falafel', category: 'Vegetariskt' },
  { name: 'Dim sum korg', category: 'Asiatiskt' },
  { name: 'Ramen tonkotsu', category: 'Asiatiskt' },
  { name: 'Älggryta med kantareller', category: 'Vilt' },
  { name: 'Tapas selection', category: 'Tapas' },
  { name: 'BBQ ribs med coleslaw', category: 'BBQ' },
  { name: 'Vegetarisk tryffelrisotto', category: 'Vegetariskt' },
  { name: 'Charkuteribricka', category: 'Förrätt' },
  { name: 'Moussaka', category: 'Medelhavet' },
  { name: 'Wok med tofu och cashew', category: 'Asiatiskt' },
];

const results = analyzeDishes(fakeMeny);

const matched = results.filter(d => d.matched);
const unmatched = results.filter(d => !d.matched);
const matchRate = Math.round((matched.length / results.length) * 100);

console.log(`Totalt: ${results.length} rätter | ✅ ${matched.length} matchade | ❌ ${unmatched.length} omatchade | Matchgrad: ${matchRate}%\n`);

// Group by method
const byMethod: Record<string, number> = {};
for (const d of matched) {
  byMethod[d.method] = (byMethod[d.method] || 0) + 1;
}
console.log('Matchmetoder:');
for (const [method, count] of Object.entries(byMethod).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${method}: ${count}`);
}

console.log('\n✅ Matchade rätter:');
console.log('─'.repeat(90));
console.log(`${'Rätt'.padEnd(35)} ${'Nyckel'.padEnd(15)} ${'Metod'.padEnd(12)} ${'Konf'.padEnd(5)} Färg → Region → Druva`);
console.log('─'.repeat(90));
for (const d of matched) {
  const name = d.dish_name_original.substring(0, 33).padEnd(35);
  const key = (d.match_key || '').padEnd(15);
  const method = d.method.padEnd(12);
  const conf = (d.confidence * 100).toFixed(0).padStart(3) + '%';
  const colors = d.colors.slice(0, 2).join(',');
  const regions = d.regions.slice(0, 2).join(',');
  const grapes = d.grapes.slice(0, 2).join(',');
  console.log(`${name} ${key} ${method} ${conf}  ${colors} → ${regions} → ${grapes}`);
}

if (unmatched.length > 0) {
  console.log(`\n❌ Omatchade rätter (${unmatched.length}):`);
  for (const d of unmatched) {
    console.log(`   • ${d.dish_name_original}`);
  }
}

// ============================================================================
// 3. Lookup-test: visa vad pipeline returnerar per rätt
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  Lookup-test — Nya 2026 food pairings');
console.log('═══════════════════════════════════════════════════════════\n');

const testFoods = ['tapas', 'mezze', 'ceviche', 'ramen', 'tacos', 'risotto', 'moussaka', 'kimchi', 'bbq', 'charkuterier', 'hummus', 'pulled pork', 'tryffel'];

for (const food of testFoods) {
  const pref = lookupFoodPairing([food]);
  if (pref.colors.length > 0) {
    console.log(`🍽️  ${food.padEnd(16)} → ${pref.colors.join(', ').padEnd(22)} | ${pref.regions.slice(0, 3).join(', ').padEnd(35)} | ${pref.grapes.slice(0, 3).join(', ')}`);
  } else {
    console.log(`🍽️  ${food.padEnd(16)} → ❌ ingen match`);
  }
}

// ============================================================================
// 4. Nya stilar
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  Nya stilar — 2026');
console.log('═══════════════════════════════════════════════════════════\n');

const newStyles = ['fräsch', 'autentisk', 'heritage', 'gastronomisk', 'kylbar'];
for (const style of newStyles) {
  const pref = STYLE_TO_CHARACTERISTICS[style];
  if (pref) {
    console.log(`🎨 ${style.padEnd(16)} → ${pref.regions.slice(0, 4).join(', ').padEnd(40)} | ${pref.grapes.slice(0, 4).join(', ')}`);
  }
}

console.log('\n\n✅ Klart!');
