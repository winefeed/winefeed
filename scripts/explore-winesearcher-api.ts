/**
 * Wine-Searcher API Explorer
 *
 * Utforskar alla möjligheter med Wine-Searcher API:t
 * innan trial-perioden går ut.
 *
 * Run: npx ts-node scripts/explore-winesearcher-api.ts
 */

import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = 'wnestest82020261601';

// ============================================================================
// ENDPOINTS ATT TESTA
// ============================================================================

const ENDPOINTS = {
  // Wine Check - grundläggande vininfo
  wineCheck: 'https://api.wine-searcher.com/x',

  // Market Price - prisdata från handlare (kräver kanske PRO)
  marketPrice: 'https://api.wine-searcher.com/a',

  // Alternativa endpoints att testa
  search: 'https://api.wine-searcher.com/search',
  wine: 'https://api.wine-searcher.com/wine',
  vintage: 'https://api.wine-searcher.com/vintage',
};

// ============================================================================
// TEST CASES
// ============================================================================

interface TestCase {
  name: string;
  endpoint: string;
  params: Record<string, string>;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // === WINE CHECK ENDPOINT (/x) ===
  {
    name: 'Wine Check - Basic',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Chateau Margaux', vintage: '2015' },
    description: 'Grundläggande vininfo för känt vin',
  },
  {
    name: 'Wine Check - Med LWIN',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'LWIN1012361' },
    description: 'Sökning med LWIN-kod',
  },
  {
    name: 'Wine Check - NV Champagne',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Krug Grande Cuvee', vintage: 'NV' },
    description: 'Non-vintage champagne',
  },
  {
    name: 'Wine Check - Svensk producent',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Kullaberg' },
    description: 'Testa om svenska producenter finns',
  },
  {
    name: 'Wine Check - Bred sökning',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Barolo' },
    description: 'Sökning på region/typ',
  },
  {
    name: 'Wine Check - Med land',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Riesling', country: 'Germany' },
    description: 'Testa country-parameter',
  },
  {
    name: 'Wine Check - Med region',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Cabernet Sauvignon', region: 'Napa Valley' },
    description: 'Testa region-parameter',
  },
  {
    name: 'Wine Check - Med druva',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Pinot Noir', grape: 'Pinot Noir' },
    description: 'Testa grape-parameter',
  },
  {
    name: 'Wine Check - Multiple results',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Penfolds Grange',Rone: '1' },
    description: 'Testa Rone parameter för fler resultat',
  },

  // === MARKET PRICE ENDPOINT (/a) ===
  {
    name: 'Market Price - Basic',
    endpoint: ENDPOINTS.marketPrice,
    params: { winename: 'Chateau Margaux', vintage: '2015' },
    description: 'Prisdata för känt vin',
  },
  {
    name: 'Market Price - Med land',
    endpoint: ENDPOINTS.marketPrice,
    params: { winename: 'Opus One', vintage: '2019', country: 'Sweden' },
    description: 'Priser från svenska handlare',
  },
  {
    name: 'Market Price - Med currency',
    endpoint: ENDPOINTS.marketPrice,
    params: { winename: 'Dom Perignon', vintage: '2012', Xcurr: 'SEK' },
    description: 'Priser i SEK',
  },

  // === ALTERNATIVA PARAMETRAR ===
  {
    name: 'Wine Check - Alla fält',
    endpoint: ENDPOINTS.wineCheck,
    params: {
      winename: 'Sassicaia',
      vintage: '2018',
      Xcurr: 'SEK',
      Xnum_sams: '10',
    },
    description: 'Testa alla kända parametrar',
  },
  {
    name: 'Wine Check - Output format',
    endpoint: ENDPOINTS.wineCheck,
    params: { winename: 'Petrus', vintage: '2010', output: 'json' },
    description: 'Testa JSON output istället för XML',
  },
];

// ============================================================================
// API CALLER
// ============================================================================

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

async function callApi(testCase: TestCase): Promise<any> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    ...testCase.params,
  });

  const url = `${testCase.endpoint}?${params.toString()}`;

  console.log(`\n📡 ${testCase.name}`);
  console.log(`   ${testCase.description}`);
  console.log(`   URL: ${testCase.endpoint}?${Object.entries(testCase.params).map(([k,v]) => `${k}=${v}`).join('&')}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Winefeed-Explorer/1.0',
        'Accept': '*/*',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${contentType}`);

    let parsed: any = null;

    if (contentType.includes('json')) {
      try {
        parsed = JSON.parse(text);
        console.log(`   Format: JSON`);
      } catch {
        console.log(`   Format: Text (JSON parse failed)`);
      }
    } else if (contentType.includes('xml') || text.startsWith('<?xml') || text.startsWith('<')) {
      try {
        parsed = parser.parse(text);
        console.log(`   Format: XML`);
      } catch {
        console.log(`   Format: Text (XML parse failed)`);
      }
    } else {
      console.log(`   Format: Unknown`);
    }

    // Analysera response-struktur
    if (parsed) {
      const fields = extractAllFields(parsed);
      console.log(`   Fields found: ${fields.length}`);
      if (fields.length > 0) {
        console.log(`   Sample fields: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);
      }
    }

    return {
      testCase: testCase.name,
      status: response.status,
      contentType,
      rawLength: text.length,
      raw: text.substring(0, 2000), // First 2000 chars
      parsed,
      fields: parsed ? extractAllFields(parsed) : [],
    };

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      testCase: testCase.name,
      error: error.message,
    };
  }
}

function extractAllFields(obj: any, prefix = ''): string[] {
  const fields: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return fields;
  }

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    fields.push(fullKey);

    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      fields.push(...extractAllFields(value, fullKey));
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      fields.push(...extractAllFields(value[0], `${fullKey}[]`));
    }
  }

  return fields;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🍷 WINE-SEARCHER API EXPLORER');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`API Key: ${API_KEY.slice(0, 8)}...`);
  console.log(`Tests: ${TEST_CASES.length}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const results: any[] = [];

  for (const testCase of TEST_CASES) {
    const result = await callApi(testCase);
    results.push(result);
    await sleep(1000); // Rate limiting
  }

  // Sammanställ alla unika fält
  const allFields = new Set<string>();
  for (const result of results) {
    if (result.fields) {
      result.fields.forEach((f: string) => allFields.add(f));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SAMMANFATTNING');
  console.log('═══════════════════════════════════════════════════════════════');

  const successful = results.filter(r => !r.error && r.status === 200);
  const failed = results.filter(r => r.error || r.status !== 200);

  console.log(`\n✅ Lyckade anrop: ${successful.length}/${results.length}`);
  console.log(`❌ Misslyckade: ${failed.length}/${results.length}`);

  console.log(`\n📋 ALLA FÄLT SOM HITTADES (${allFields.size} st):`);
  const sortedFields = Array.from(allFields).sort();
  for (const field of sortedFields) {
    console.log(`   - ${field}`);
  }

  // Kategorisera fälten
  console.log('\n📊 FÄLTKATEGORIER:');

  const priceFields = sortedFields.filter(f => /price|cost|offer|currency|sek|usd|eur/i.test(f));
  console.log(`\n💰 Prisfält (${priceFields.length}):`);
  priceFields.forEach(f => console.log(`   - ${f}`));

  const wineFields = sortedFields.filter(f => /wine|name|producer|region|grape|vintage|appellation/i.test(f));
  console.log(`\n🍇 Vinfält (${wineFields.length}):`);
  wineFields.forEach(f => console.log(`   - ${f}`));

  const scoreFields = sortedFields.filter(f => /score|rating|point/i.test(f));
  console.log(`\n⭐ Betygsfält (${scoreFields.length}):`);
  scoreFields.forEach(f => console.log(`   - ${f}`));

  const merchantFields = sortedFields.filter(f => /merchant|shop|store|seller|retailer/i.test(f));
  console.log(`\n🏪 Handlarfält (${merchantFields.length}):`);
  merchantFields.forEach(f => console.log(`   - ${f}`));

  // Spara resultat
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(__dirname, 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `winesearcher-exploration-${timestamp}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    apiKey: API_KEY.slice(0, 8) + '...',
    totalTests: TEST_CASES.length,
    successful: successful.length,
    failed: failed.length,
    allFields: sortedFields,
    fieldCategories: {
      price: priceFields,
      wine: wineFields,
      score: scoreFields,
      merchant: merchantFields,
    },
    results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📁 Fullständiga resultat sparade: ${outputPath}`);

  // Rekommendationer
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 POTENTIELLA USE CASES FÖR WINEFEED');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log(`
1. 🏷️  VINVALIDERING
   - Verifiera att vinnamn är korrekta
   - Normalisera stavningar
   - Koppla till kanoniska namn

2. 📊 MARKNADSPRISER (om tillgängligt)
   - Referenspriser för prisförhandling
   - Prishistorik och trender
   - Jämför leverantörspriser mot marknad

3. ⭐ KRITKERBETYG
   - Visa betyg i sökresultat
   - Filtrera på betyg
   - "Bäst i klassen" för budgetintervall

4. 🍇 VINDATA-ENRICHMENT
   - Druvor, region, producent
   - Alkoholhalt
   - Årgångsinformation

5. 🔗 LWIN-INTEGRATION
   - Standardiserade vin-ID:n
   - Koppling till global vindata
   - Förenklad matchning

6. 🌍 GEOGRAFISK DATA
   - Land, region, subregion
   - Appellation
   - Terroir-information

7. 📈 INVESTERINGSDATA
   - Vin som investering
   - Prisutveckling över tid
   - Sällsynta viner
`);
}

main().catch(console.error);
