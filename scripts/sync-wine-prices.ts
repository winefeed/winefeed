/**
 * Synkronisera marknadspriser från Wine-Searcher för alla viner i databasen
 *
 * Detta script:
 * 1. Hämtar alla viner från Supabase
 * 2. Söker marknadspriser på Wine-Searcher
 * 3. Uppdaterar lägsta pris i databasen
 *
 * Användning:
 * npx ts-node scripts/sync-wine-prices.ts
 *
 * VIKTIGT: Med 100 gratis anrop/dag kan du synka ~90 viner per dag
 */

import { createClient } from '@supabase/supabase-js';
import { wineSearcherClient } from '../lib/wine-searcher/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Wine {
  id: string;
  namn: string;
  producent: string;
  region?: string;
  pris_sek: number;
}

async function syncWinePrices(limit: number = 10, delayMs: number = 2000) {
  console.log('🍷 Synkroniserar vinpriser från Wine-Searcher...\n');

  // Hämta viner som inte har uppdaterats nyligen (eller alls)
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, namn, producent, region, pris_sek')
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('❌ Kunde inte hämta viner från databasen:', error);
    return;
  }

  console.log(`📊 Hittade ${wines.length} viner att synkronisera\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < wines.length; i++) {
    const wine = wines[i] as Wine;

    console.log(`[${i + 1}/${wines.length}] ${wine.producent} ${wine.namn}...`);

    try {
      // Sök marknadspriser
      const searchQuery = `${wine.producent} ${wine.namn}`.trim();
      const prices = await wineSearcherClient.getPricesByName(
        searchQuery,
        undefined,
        'SEK'
      );

      if (prices && prices.results && prices.results.length > 0) {
        const lowestPrice = prices.results[0].price;
        const merchantName = prices.results[0].merchant_name;

        console.log(`  ✓ Lägsta pris: ${lowestPrice} SEK från ${merchantName}`);
        console.log(`  📊 Totalt ${prices.total_results} återförsäljare hittade`);

        // Uppdatera i databasen
        const { error: updateError } = await supabase
          .from('wines')
          .update({
            market_price_sek: lowestPrice,
            market_price_updated_at: new Date().toISOString(),
            market_merchant_count: prices.total_results,
          })
          .eq('id', wine.id);

        if (updateError) {
          console.error(`  ✗ Kunde inte uppdatera databas:`, updateError.message);
          failCount++;
        } else {
          successCount++;

          // Jämför med eget pris
          const priceDiff = wine.pris_sek - lowestPrice;
          const priceDiffPercent = ((priceDiff / lowestPrice) * 100).toFixed(1);

          if (priceDiff > 0) {
            console.log(`  💰 Ditt pris är ${priceDiff} SEK (+${priceDiffPercent}%) högre än marknaden`);
          } else if (priceDiff < 0) {
            console.log(`  🎯 Ditt pris är ${Math.abs(priceDiff)} SEK (${priceDiffPercent}%) lägre än marknaden`);
          } else {
            console.log(`  ⚖️  Samma pris som marknaden`);
          }
        }
      } else {
        console.log(`  ⚠️  Inga priser hittade`);
        failCount++;
      }

    } catch (error) {
      console.error(`  ✗ Fel:`, error);
      failCount++;
    }

    console.log('');

    // Rate limiting - vänta mellan anrop
    if (i < wines.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log('\n📊 Sammanfattning:');
  console.log(`  ✓ Lyckades: ${successCount}`);
  console.log(`  ✗ Misslyckades: ${failCount}`);
  console.log(`  📈 Totalt: ${wines.length}`);
  console.log('\n✅ Synkronisering klar!');
}

// Parse command line arguments
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const delayIndex = args.indexOf('--delay');

const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 10;
const delay = delayIndex !== -1 ? parseInt(args[delayIndex + 1]) : 2000;

console.log(`Inställningar:`);
console.log(`  Limit: ${limit} viner`);
console.log(`  Fördröjning: ${delay}ms mellan anrop\n`);

// Kör synkronisering
syncWinePrices(limit, delay)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Synkronisering misslyckades:', error);
    process.exit(1);
  });
