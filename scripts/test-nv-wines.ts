#!/usr/bin/env npx tsx
/**
 * Wine-Searcher NV Wine Test
 * Testar viner utan årgång: Champagne, Sherry, Porto, Madeira
 *
 * Kör: npx tsx scripts/test-nv-wines.ts
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
  vintage?: string | number;
  category: string;
  notes?: string;
}

// NV-viner att testa
const NV_WINES: TestWine[] = [
  // CHAMPAGNE - Stora hus
  { name: 'Bollinger Special Cuvee', category: 'champagne_nv', notes: 'NV Champagne klassiker' },
  { name: 'Bollinger Special Cuvee Brut', category: 'champagne_nv' },
  { name: 'Ruinart Blanc de Blancs', category: 'champagne_nv' },
  { name: 'Ruinart Rose', category: 'champagne_nv' },
  { name: 'Pol Roger Brut Reserve', category: 'champagne_nv' },
  { name: 'Pol Roger White Foil', category: 'champagne_nv' },
  { name: 'Veuve Clicquot Yellow Label', category: 'champagne_nv' },
  { name: 'Veuve Clicquot Brut', category: 'champagne_nv' },
  { name: 'Moët & Chandon Imperial', category: 'champagne_nv' },
  { name: 'Moët Chandon Brut Imperial', category: 'champagne_nv' },
  { name: 'Taittinger Brut Reserve', category: 'champagne_nv' },
  { name: 'Louis Roederer Brut Premier', category: 'champagne_nv' },
  { name: 'Laurent-Perrier Brut', category: 'champagne_nv' },
  { name: 'Billecart-Salmon Brut Reserve', category: 'champagne_nv' },

  // CHAMPAGNE - Testa med "NV" i söksträngen
  { name: 'Krug Grande Cuvee NV', category: 'champagne_nv_explicit', notes: 'Med NV i namnet' },
  { name: 'Bollinger Special Cuvee NV', category: 'champagne_nv_explicit' },

  // CHAMPAGNE - Testa med vintage=NV parameter
  { name: 'Krug Grande Cuvee', vintage: 'NV', category: 'champagne_nv_param', notes: 'NV som vintage-param' },
  { name: 'Bollinger Special Cuvee', vintage: 'NV', category: 'champagne_nv_param' },

  // SHERRY
  { name: 'Lustau Pedro Ximenez San Emilio', category: 'sherry' },
  { name: 'Gonzalez Byass Tio Pepe', category: 'sherry' },
  { name: 'Tio Pepe Fino', category: 'sherry' },
  { name: 'Valdespino Inocente Fino', category: 'sherry' },
  { name: 'El Maestro Sierra Oloroso', category: 'sherry' },
  { name: 'Hidalgo La Gitana Manzanilla', category: 'sherry' },
  { name: 'Equipo Navazos La Bota', category: 'sherry', notes: 'Prestigesherry' },

  // PORTO
  { name: 'Taylor Fladgate 10 Year Tawny', category: 'porto' },
  { name: 'Taylor 10 Year Old Tawny Port', category: 'porto' },
  { name: 'Graham 20 Year Old Tawny', category: 'porto' },
  { name: 'Fonseca Bin 27', category: 'porto' },
  { name: 'Dow Fine Ruby Port', category: 'porto' },
  { name: 'Niepoort Ruby Dum', category: 'porto' },
  { name: 'Quinta do Noval 10 Year Tawny', category: 'porto' },
  { name: 'Sandeman 20 Year Old Tawny', category: 'porto' },
  { name: 'Warre Otima 10 Year Tawny', category: 'porto' },

  // MADEIRA
  { name: 'Blandy 10 Year Malmsey', category: 'madeira' },
  { name: 'Henriques & Henriques 15 Year Verdelho', category: 'madeira' },
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
  wsScore?: number;
  error?: string;
  rawXml?: string;
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
  });

  // Testa med vintage-parameter om specificerat
  if (wine.vintage) {
    params.append('vintage', wine.vintage.toString());
  }

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
      wsScore: parsed.wsScore,
      rawXml: xml,
    };
  } catch (error) {
    return {
      wine,
      found: false,
      error: String(error),
    };
  }
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Wine-Searcher NV Wine Test                           ║');
  console.log('║           Champagne, Sherry, Porto, Madeira                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📋 Testar ${NV_WINES.length} NV-viner...\n`);

  const results: TestResult[] = [];

  for (let i = 0; i < NV_WINES.length; i++) {
    const wine = NV_WINES[i];
    const vintageInfo = wine.vintage ? ` (vintage=${wine.vintage})` : '';
    const progress = `[${(i + 1).toString().padStart(2)}/${NV_WINES.length}]`;
    process.stdout.write(`${progress} ${wine.name.substring(0, 40).padEnd(40)}${vintageInfo.padEnd(15)} `);

    const result = await testWine(wine);
    results.push(result);

    if (result.found) {
      const price = result.priceAvg ? `$${result.priceAvg.toFixed(0)}` : '?';
      const score = result.wsScore ? `WS:${result.wsScore}` : '';
      console.log(`✅ ${result.region || ''} | ${price} ${score}`);
    } else {
      console.log(`❌ NOT FOUND`);
    }

    // Rate limiting
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

    console.log(`   ${cat.padEnd(25)} ${bar} ${found}/${total} (${rate}%)`);
  }

  // Totalt
  const totalFound = results.filter(r => r.found).length;
  const totalRate = Math.round((totalFound / results.length) * 100);
  console.log('');
  console.log(`   ${'TOTALT'.padEnd(25)} ${totalFound}/${results.length} (${totalRate}%)`);

  // Lista missade
  const missed = results.filter(r => !r.found);
  if (missed.length > 0) {
    console.log('');
    console.log('❌ MISSADE VINER:');
    for (const m of missed) {
      const vintageInfo = m.wine.vintage ? ` (vintage=${m.wine.vintage})` : '';
      console.log(`   - ${m.wine.name}${vintageInfo} [${m.wine.category}]`);
    }
  }

  // Insikter för NV-hantering
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                   INSIKTER FÖR NV-HANTERING                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const nvExplicit = results.filter(r => r.wine.category === 'champagne_nv_explicit');
  const nvParam = results.filter(r => r.wine.category === 'champagne_nv_param');
  const nvPlain = results.filter(r => r.wine.category === 'champagne_nv');

  console.log(`   Utan NV-markering:        ${nvPlain.filter(r => r.found).length}/${nvPlain.length} hittade`);
  console.log(`   Med "NV" i söksträngen:   ${nvExplicit.filter(r => r.found).length}/${nvExplicit.length} hittade`);
  console.log(`   Med vintage=NV param:     ${nvParam.filter(r => r.found).length}/${nvParam.length} hittade`);

  // Rekommendation
  const plainRate = nvPlain.length > 0 ? nvPlain.filter(r => r.found).length / nvPlain.length : 0;
  const explicitRate = nvExplicit.length > 0 ? nvExplicit.filter(r => r.found).length / nvExplicit.length : 0;
  const paramRate = nvParam.length > 0 ? nvParam.filter(r => r.found).length / nvParam.length : 0;

  console.log('');
  console.log('   📌 REKOMMENDATION:');
  if (plainRate >= explicitRate && plainRate >= paramRate) {
    console.log('      Sök UTAN "NV" i söksträngen för bäst resultat');
  } else if (explicitRate > paramRate) {
    console.log('      Lägg till "NV" i söksträngen för bäst resultat');
  } else {
    console.log('      Använd vintage=NV parameter för bäst resultat');
  }

  // Spara resultat
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = `scripts/output/nv-wine-results-${timestamp}.json`;

  const output = {
    timestamp: new Date().toISOString(),
    totalTested: results.length,
    found: totalFound,
    successRate: `${totalRate}%`,
    insights: {
      withoutNV: `${nvPlain.filter(r => r.found).length}/${nvPlain.length}`,
      withNVInName: `${nvExplicit.filter(r => r.found).length}/${nvExplicit.length}`,
      withNVParam: `${nvParam.filter(r => r.found).length}/${nvParam.length}`,
    },
    results: results.map(r => ({
      name: r.wine.name,
      vintage: r.wine.vintage,
      category: r.wine.category,
      found: r.found,
      region: r.region,
      grape: r.grape,
      priceAvg: r.priceAvg,
      wsScore: r.wsScore,
    })),
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log('');
  console.log(`💾 Resultat sparade: ${outputFile}`);
  console.log(`📡 API-anrop använda: ${results.length}`);
  console.log('');
}

main().catch(console.error);
