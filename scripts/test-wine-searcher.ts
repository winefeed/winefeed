/**
 * Test script för Wine-Searcher Market Price API
 *
 * Användning:
 * 1. Lägg till WINE_SEARCHER_API_KEY i .env.local
 * 2. Kör: npx ts-node scripts/test-wine-searcher.ts
 */

import { WineSearcherClient } from '../lib/wine-searcher/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new WineSearcherClient();

async function testMarketPriceAPI() {
  console.log('🍷 Testing Wine-Searcher Market Price API\n');

  // Test 1: Sök med vinnamn
  console.log('Test 1: Söker priser för "Chateau Margaux 2015"...');
  const test1 = await client.getPricesByName('Chateau Margaux', '2015', 'SEK');

  if (test1) {
    console.log('✓ Svar mottaget:');
    console.log(`  Vin: ${test1.wine_name} ${test1.vintage || ''}`);
    console.log(`  Totalt antal resultat: ${test1.total_results}`);
    console.log(`  Återförsäljare returnerade: ${test1.results.length}`);

    if (test1.results.length > 0) {
      console.log(`  Lägsta pris: ${test1.results[0].price} ${test1.results[0].currency}`);
      console.log(`  Från: ${test1.results[0].merchant_name}`);
    }
  } else {
    console.log('✗ Ingen data returnerad');
  }

  console.log('\n---\n');

  // Test 2: Sök med LWIN-kod (exempel)
  console.log('Test 2: Söker priser med LWIN-kod...');
  console.log('(Använd en giltig LWIN-kod för dina viner)');

  // Exempel LWIN för Chateau Leoville Barton
  const exampleLWIN = '1012361';
  const test2 = await client.getPricesByLWIN(exampleLWIN, 'SEK');

  if (test2) {
    console.log('✓ Svar mottaget:');
    console.log(`  LWIN: ${test2.lwin}`);
    console.log(`  Vin: ${test2.wine_name}`);
    console.log(`  Återförsäljare: ${test2.results.length}`);
  } else {
    console.log('✗ Ingen data returnerad (kontrollera LWIN-kod)');
  }

  console.log('\n---\n');

  // Test 3: Hämta bara lägsta priset
  console.log('Test 3: Hämtar endast lägsta pris för "Barolo"...');
  const lowestPrice = await client.getLowestPrice({
    winename: 'Barolo',
    currencycode: 'SEK',
  });

  if (lowestPrice) {
    console.log(`✓ Lägsta pris: ${lowestPrice} SEK`);
  } else {
    console.log('✗ Kunde inte hämta pris');
  }

  console.log('\n---\n');

  // Test 4: Testa med viner från din databas
  console.log('Test 4: Exempel för att integrera med dina Vaucelle-viner:');
  console.log('');
  console.log('const vaucelleWines = [');
  console.log('  { namn: "Cuvée Rosé – Le Suchot", producent: "Vaucelle" },');
  console.log('  { namn: "Cuvée Terre Nacrée", producent: "Vaucelle" },');
  console.log('];');
  console.log('');
  console.log('for (const wine of vaucelleWines) {');
  console.log('  const prices = await client.getPricesByName(');
  console.log('    `${wine.producent} ${wine.namn}`,');
  console.log('    undefined,');
  console.log('    "SEK"');
  console.log('  );');
  console.log('  // Spara prisdata i databasen...');
  console.log('}');

  console.log('\n✅ Test komplett!\n');
  console.log('Nästa steg:');
  console.log('1. Ansök om API-nyckel på https://www.wine-searcher.com/trade/api');
  console.log('2. Lägg till WINE_SEARCHER_API_KEY i .env.local');
  console.log('3. Kör detta script igen för att testa');
}

// Kör test
testMarketPriceAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test misslyckades:', error);
    process.exit(1);
  });
