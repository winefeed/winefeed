/**
 * Test: Matcha simulerad restaurangmeny mot Brasris vinkatalog
 *
 * Kör: npx tsx scripts/test-food-scan-brasri.ts
 */

import { lookupFoodPairing } from '../lib/matching-agent/food-pairing';
import { analyzeDishes } from '../lib/food-scan/menu-analyzer';
import type { WoltMenuItem } from '../lib/food-scan/types';

// ============================================================================
// Brasris faktiska vinkatalog (från DB)
// ============================================================================

interface BrasriWine {
  name: string;
  producer: string;
  region: string;
  grape: string;
  color: string;
  price_sek: number;
  organic: boolean;
}

const BRASRI_WINES: BrasriWine[] = [
  { name: 'Beaujolais Villages Blanc « Beur Blanc » 2024', producer: 'Karim Vionnet', region: 'Beaujolais', grape: 'Chardonnay', color: 'white', price_sek: 180, organic: false },
  { name: 'Bourgogne Blanc', producer: 'Camille & Laurent Schaller', region: 'Bourgogne', grape: 'Chardonnay', color: 'white', price_sek: 170, organic: false },
  { name: 'Carpe Libre', producer: 'Banjo Vino', region: 'Languedoc', grape: 'Pinot Noir', color: 'red', price_sek: 150, organic: true },
  { name: 'Chablis', producer: 'Camille & Laurent Schaller', region: 'Bourgogne', grape: 'Chardonnay', color: 'white', price_sek: 190, organic: false },
  { name: 'Château Bonalgue Bel Air', producer: 'Tour Calon', region: 'Bordeaux', grape: 'Merlot', color: 'red', price_sek: 400, organic: false },
  { name: 'Château La Rose de Haut Mouschet', producer: 'Tour Calon', region: 'Bordeaux', grape: 'Merlot, Cabernet Franc, Cabernet Sauvignon', color: 'red', price_sek: 150, organic: true },
  { name: 'Château Tour Calon', producer: 'Tour Calon', region: 'Bordeaux', grape: 'Merlot, Malbec', color: 'red', price_sek: 160, organic: true },
  { name: 'Château Tour Calon Premier des Tours', producer: 'Tour Calon', region: 'Bordeaux', grape: 'Merlot', color: 'red', price_sek: 220, organic: true },
  { name: 'Crémant d\'Alsace Blanc', producer: 'G. Metz', region: 'Alsace', grape: 'Blend', color: 'sparkling', price_sek: 160, organic: true },
  { name: 'Crocodile Bock', producer: 'Banjo Vino', region: 'Languedoc', grape: 'Sauvignon Blanc', color: 'white', price_sek: 150, organic: true },
  { name: 'Fleurie 2021', producer: 'Karim Vionnet', region: 'Beaujolais', grape: 'Gamay', color: 'red', price_sek: 210, organic: false },
  { name: 'Frankenstein – Blend', producer: 'Charles Frey', region: 'Alsace', grape: 'Riesling, Pinot Gris, Gewurztraminer', color: 'white', price_sek: 220, organic: true },
  { name: 'Guru', producer: 'Banjo Vino', region: 'Rhône', grape: 'Syrah, Grenache', color: 'red', price_sek: 150, organic: true },
  { name: 'Josita', producer: 'Banjo Vino', region: 'Languedoc', grape: 'Caladoc, Mourvèdre', color: 'rose', price_sek: 150, organic: true },
  { name: 'Macération - Dry', producer: 'Charles Frey', region: 'Alsace', grape: 'Gewurztraminer, Riesling', color: 'orange', price_sek: 180, organic: true },
  { name: 'Massé', producer: 'Banjo Vino', region: 'Languedoc', grape: 'Grenache BG, Roussanne, Viognier', color: 'orange', price_sek: 150, organic: true },
  { name: 'Pétillant Naturel (PET NAT)', producer: 'Karim Vionnet', region: 'Beaujolais', grape: 'Gamay', color: 'sparkling', price_sek: 170, organic: false },
  { name: 'PetLat', producer: 'Lateyron', region: 'Bordeaux', grape: 'Sémillon', color: 'sparkling', price_sek: 150, organic: true },
  { name: 'Pinot Gris Symbiose - Dry', producer: 'Charles Frey', region: 'Alsace', grape: 'Pinot Gris', color: 'white', price_sek: 170, organic: true },
  { name: 'Pinot Noir Harmonie - Dry', producer: 'Charles Frey', region: 'Alsace', grape: 'Pinot Noir', color: 'red', price_sek: 170, organic: true },
  { name: 'Riesling Granite - Dry', producer: 'Charles Frey', region: 'Alsace', grape: 'Riesling', color: 'white', price_sek: 170, organic: true },
  { name: 'Tradition', producer: 'Clos Fantine', region: 'Languedoc', grape: 'Carignan, Grenache, Syrah', color: 'red', price_sek: 180, organic: false },
  { name: 'Wine Note Blanc – Natural wine', producer: 'G. Metz', region: 'Alsace', grape: 'Riesling', color: 'white', price_sek: 180, organic: true },
  { name: 'Wine Note Orange – Natural wine', producer: 'G. Metz', region: 'Alsace', grape: 'Gewurztraminer', color: 'orange', price_sek: 180, organic: true },
];

// ============================================================================
// Restaurangmeny
// ============================================================================

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

// ============================================================================
// Matchningslogik: rätt → food pairing → score varje Brasri-vin
// ============================================================================

function scoreWineForDish(
  wine: BrasriWine,
  pref: { colors: string[]; regions: string[]; grapes: string[] },
): number {
  let score = 0;

  // Färg-match (viktigast)
  if (pref.colors.includes(wine.color)) score += 40;

  // Region-match
  const wineRegion = wine.region.toLowerCase();
  for (const r of pref.regions) {
    if (wineRegion.includes(r) || r.includes(wineRegion)) {
      score += 30;
      break;
    }
  }

  // Druv-match
  const wineGrapes = wine.grape.toLowerCase();
  for (const g of pref.grapes) {
    if (wineGrapes.includes(g.toLowerCase())) {
      score += 20;
      break;
    }
  }

  // Bonus: ekologisk
  if (wine.organic) score += 5;

  return score;
}

// ============================================================================
// Kör matchning
// ============================================================================

console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
console.log('  MENY → BRASRI MATCHNING');
console.log('  25 aktiva viner från Brasri AB vs 30 rätter');
console.log('═══════════════════════════════════════════════════════════════════════════════════════════\n');

const dishes = analyzeDishes(fakeMeny);

for (const dish of dishes) {
  const pref = lookupFoodPairing([dish.match_key || dish.dish_name]);

  // Score alla Brasri-viner
  const scored = BRASRI_WINES
    .map(wine => ({ wine, score: scoreWineForDish(wine, pref) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);

  console.log(`┌─ 🍽️  ${dish.dish_name_original}`);
  console.log(`│  Söker: ${pref.colors.join(', ')} | ${pref.regions.slice(0, 3).join(', ')} | ${pref.grapes.slice(0, 3).join(', ')}`);

  if (top3.length === 0) {
    console.log(`│  ❌ Inga Brasri-viner matchar`);
  } else {
    for (let i = 0; i < top3.length; i++) {
      const { wine, score } = top3[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const eco = wine.organic ? ' 🌿' : '';
      console.log(`│  ${medal} ${wine.name} (${wine.producer}) — ${wine.color}, ${wine.region}, ${wine.grape}${eco} [${score}p]`);
    }
  }
  console.log(`└${'─'.repeat(88)}`);
  console.log('');
}

// ============================================================================
// Sammanfattning: vilka Brasri-viner används mest?
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════');
console.log('  SAMMANFATTNING — Brasri-viner rankade efter antal toppträffar');
console.log('═══════════════════════════════════════════════════════════════════════════════════════════\n');

const wineHits: Record<string, { top1: number; top3: number }> = {};
for (const wine of BRASRI_WINES) {
  wineHits[wine.name] = { top1: 0, top3: 0 };
}

for (const dish of dishes) {
  const pref = lookupFoodPairing([dish.match_key || dish.dish_name]);
  const scored = BRASRI_WINES
    .map(wine => ({ wine, score: scoreWineForDish(wine, pref) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    wineHits[scored[0].wine.name].top1++;
  }
  for (const s of scored.slice(0, 3)) {
    wineHits[s.wine.name].top3++;
  }
}

const sorted = Object.entries(wineHits)
  .filter(([, v]) => v.top3 > 0)
  .sort((a, b) => b[1].top3 - a[1].top3 || b[1].top1 - a[1].top1);

console.log(`${'Vin'.padEnd(45)} 🥇 Top 1   📊 Top 3`);
console.log('─'.repeat(70));
for (const [name, hits] of sorted) {
  const wine = BRASRI_WINES.find(w => w.name === name)!;
  console.log(`${name.substring(0, 43).padEnd(45)} ${String(hits.top1).padStart(5)}    ${String(hits.top3).padStart(5)}     ${wine.color}, ${wine.region}`);
}

const unusedWines = Object.entries(wineHits).filter(([, v]) => v.top3 === 0);
if (unusedWines.length > 0) {
  console.log(`\n⚠️  ${unusedWines.length} viner utan match:`);
  for (const [name] of unusedWines) {
    const wine = BRASRI_WINES.find(w => w.name === name)!;
    console.log(`   • ${name} (${wine.color}, ${wine.region})`);
  }
}
