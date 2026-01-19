#!/usr/bin/env npx tsx
/**
 * Wine-Searcher NV Wine Test - COMPLETE
 * Alla NV-viner med vintage=NV parameter
 *
 * Kör: npx tsx scripts/test-nv-wines-complete.ts
 */

import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

const API_KEY = process.env.WINESEARCHER_API_KEY || 'wnestest82020261601';
const BASE_URL = 'https://api.wine-searcher.com/x';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

interface TestWine {
  name: string;
  category: string;
}

// NV-viner - reducerat urval för att passa API-budget (~30 anrop kvar)
const NV_WINES: TestWine[] = [
  // CHAMPAGNE - Stora hus NV (10 st)
  { name: 'Krug Grande Cuvee', category: 'champagne' },
  { name: 'Bollinger Special Cuvee', category: 'champagne' },
  { name: 'Ruinart Blanc de Blancs', category: 'champagne' },
  { name: 'Pol Roger Brut Reserve', category: 'champagne' },
  { name: 'Veuve Clicquot Brut', category: 'champagne' },
  { name: 'Moet Chandon Brut Imperial', category: 'champagne' },
  { name: 'Taittinger Brut Reserve', category: 'champagne' },
  { name: 'Louis Roederer Brut Premier', category: 'champagne' },
  { name: 'Laurent-Perrier Brut', category: 'champagne' },
  { name: 'Billecart-Salmon Brut Reserve', category: 'champagne' },

  // CHAMPAGNE - Rosé NV (2 st)
  { name: 'Veuve Clicquot Rose', category: 'champagne_rose' },
  { name: 'Laurent-Perrier Cuvee Rose', category: 'champagne_rose' },

  // SHERRY (5 st)
  { name: 'Tio Pepe Fino', category: 'sherry' },
  { name: 'Lustau Pedro Ximenez San Emilio', category: 'sherry' },
  { name: 'Valdespino Inocente Fino', category: 'sherry' },
  { name: 'Hidalgo La Gitana Manzanilla', category: 'sherry' },
  { name: 'Lustau Amontillado Los Arcos', category: 'sherry' },

  // PORTO - Tawny (6 st)
  { name: 'Taylor 10 Year Tawny', category: 'porto_tawny' },
  { name: 'Taylor 20 Year Tawny', category: 'porto_tawny' },
  { name: 'Graham 20 Year Tawny', category: 'porto_tawny' },
  { name: 'Fonseca 10 Year Tawny', category: 'porto_tawny' },
  { name: 'Sandeman 20 Year Tawny', category: 'porto_tawny' },
  { name: 'Warre Otima 10 Year Tawny', category: 'porto_tawny' },

  // PORTO - Ruby (2 st)
  { name: 'Fonseca Bin 27', category: 'porto_ruby' },
  { name: 'Graham Six Grapes', category: 'porto_ruby' },

  // MADEIRA (3 st)
  { name: 'Blandy 10 Year Malmsey', category: 'madeira' },
  { name: 'Blandy 5 Year Verdelho', category: 'madeira' },
  { name: 'Henriques Henriques 10 Year Malmsey', category: 'madeira' },
];

interface ParsedWineResult {
  found: boolean;
  region?: string;
  grape?: string;
  priceAvg?: number;
  priceMin?: number;
  priceMax?: number;
  wsScore?: number;
  currency?: string;
}

interface TestResult {
  wine: TestWine;
  found: boolean;
  region?: string;
  grape?: string;
  priceAvg?: number;
  priceMin?: number;
  priceMax?: number;
  wsScore?: number;
  currency?: string;
}

function parseXmlResponse(xml: string): ParsedWineResult {
  try {
    const parsed = xmlParser.parse(xml);
    const ws = parsed['wine-searcher'];

    if (!ws) {
      return { found: false };
    }

    const returnCode = ws['return-code'];
    if (returnCode !== 0 && returnCode !== '0') {
      return { found: false };
    }

    const wine = ws['wine-details']?.wine;
    if (!wine) {
      return { found: false };
    }

    return {
      found: true,
      region: wine.region || undefined,
      grape: wine.grape || undefined,
      priceAvg: wine['price-average'] ? parseFloat(wine['price-average']) : undefined,
      priceMin: wine['price-min'] ? parseFloat(wine['price-min']) : undefined,
      priceMax: wine['price-max'] ? parseFloat(wine['price-max']) : undefined,
      wsScore: wine['ws-score'] ? parseInt(wine['ws-score'], 10) : undefined,
      currency: ws['list-currency-code'] || undefined,
    };
  } catch {
    return { found: false };
  }
}

async function testWine(wine: TestWine): Promise<TestResult> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    winename: wine.name,
    vintage: 'NV',  // KRITISKT: Alla NV-viner behöver detta
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const xml = await response.text();
    const parsed = parseXmlResponse(xml);

    return {
      wine,
      found: parsed.found,
      region: parsed.region,
      grape: parsed.grape,
      priceAvg: parsed.priceAvg,
      priceMin: parsed.priceMin,
      priceMax: parsed.priceMax,
      wsScore: parsed.wsScore,
      currency: parsed.currency,
    };
  } catch (error) {
    return {
      wine,
      found: false,
    };
  }
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Wine-Searcher NV Wine Test - COMPLETE                   ║');
  console.log('║        Alla viner med vintage=NV parameter                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📋 Testar ${NV_WINES.length} NV-viner med vintage=NV...\n`);

  const results: TestResult[] = [];

  for (let i = 0; i < NV_WINES.length; i++) {
    const wine = NV_WINES[i];
    const progress = `[${(i + 1).toString().padStart(2)}/${NV_WINES.length}]`;
    process.stdout.write(`${progress} ${wine.name.padEnd(45)} `);

    const result = await testWine(wine);
    results.push(result);

    if (result.found) {
      const price = result.priceAvg ? `$${result.priceAvg.toFixed(0).padStart(4)}` : '$   ?';
      const score = result.wsScore ? `WS:${result.wsScore}` : 'WS: ?';
      const region = (result.region || '').substring(0, 20).padEnd(20);
      console.log(`✅ ${region} ${price} ${score}`);
    } else {
      console.log(`❌ NOT FOUND`);
    }

    // Rate limiting - 500ms mellan anrop
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Sammanfattning per kategori
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                   SAMMANFATTNING PER KATEGORI                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const categories = [...new Set(NV_WINES.map(w => w.category))];

  for (const cat of categories) {
    const catResults = results.filter(r => r.wine.category === cat);
    const found = catResults.filter(r => r.found).length;
    const total = catResults.length;
    const rate = Math.round((found / total) * 100);
    const bar = '█'.repeat(Math.round(rate / 10)) + '░'.repeat(10 - Math.round(rate / 10));

    // Genomsnittspris för hittade
    const prices = catResults.filter(r => r.priceAvg).map(r => r.priceAvg!);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

    console.log(`   ${cat.padEnd(20)} ${bar} ${found}/${total} (${rate}%)  avg: $${avgPrice}`);
  }

  // Totalt
  const totalFound = results.filter(r => r.found).length;
  const totalRate = Math.round((totalFound / results.length) * 100);
  console.log('');
  console.log(`   ${'TOTALT'.padEnd(20)} ${totalFound}/${results.length} (${totalRate}%)`);

  // Lista hittade viner som tabell
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      ALLA HITTADE VINER                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const foundResults = results.filter(r => r.found);

  // Gruppera per kategori
  for (const cat of categories) {
    const catResults = foundResults.filter(r => r.wine.category === cat);
    if (catResults.length === 0) continue;

    console.log(`\n📦 ${cat.toUpperCase()}`);
    console.log('─'.repeat(70));

    for (const r of catResults) {
      const name = r.wine.name.substring(0, 35).padEnd(35);
      const region = (r.region || '').substring(0, 15).padEnd(15);
      const price = r.priceAvg ? `$${r.priceAvg.toFixed(0).padStart(4)}` : '$   -';
      const range = r.priceMin && r.priceMax ? `($${r.priceMin.toFixed(0)}-$${r.priceMax.toFixed(0)})` : '';
      const score = r.wsScore ? `WS:${r.wsScore}` : '';
      console.log(`   ${name} ${region} ${price} ${range.padEnd(15)} ${score}`);
    }
  }

  // Lista missade
  const missed = results.filter(r => !r.found);
  if (missed.length > 0) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      MISSADE VINER                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    for (const m of missed) {
      console.log(`   ❌ ${m.wine.name} [${m.wine.category}]`);
    }
  }

  // Spara resultat
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = `scripts/output/nv-wine-complete-${timestamp}.json`;

  const output = {
    timestamp: new Date().toISOString(),
    method: 'vintage=NV parameter',
    totalTested: results.length,
    found: totalFound,
    successRate: `${totalRate}%`,
    byCategory: Object.fromEntries(
      categories.map(cat => {
        const catResults = results.filter(r => r.wine.category === cat);
        return [cat, {
          found: catResults.filter(r => r.found).length,
          total: catResults.length,
        }];
      })
    ),
    results: results.map(r => ({
      name: r.wine.name,
      category: r.wine.category,
      found: r.found,
      region: r.region || null,
      grape: r.grape || null,
      priceAvg: r.priceAvg || null,
      priceMin: r.priceMin || null,
      priceMax: r.priceMax || null,
      wsScore: r.wsScore || null,
      currency: r.currency || null,
    })),
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  // CSV export
  const csvFile = `scripts/output/nv-wine-complete-${timestamp}.csv`;
  const csvHeader = 'name,category,found,region,grape,price_avg,price_min,price_max,ws_score,currency';
  const csvRows = results.map(r => [
    `"${r.wine.name}"`,
    r.wine.category,
    r.found,
    `"${r.region || ''}"`,
    `"${r.grape || ''}"`,
    r.priceAvg || '',
    r.priceMin || '',
    r.priceMax || '',
    r.wsScore || '',
    r.currency || '',
  ].join(','));
  fs.writeFileSync(csvFile, [csvHeader, ...csvRows].join('\n'));

  console.log('');
  console.log('💾 Filer sparade:');
  console.log(`   JSON: ${outputFile}`);
  console.log(`   CSV:  ${csvFile}`);
  console.log(`📡 API-anrop använda: ${results.length}`);
  console.log('');
}

main().catch(console.error);
