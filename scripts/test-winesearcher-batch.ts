#!/usr/bin/env npx tsx
/**
 * Wine-Searcher Batch Test Script
 *
 * Testar Wine-Searcher API med ett set av viner och loggar resultaten strukturerat.
 * Kör innan API-nyckeln går ut den 23:e för att utvärdera kvaliteten.
 *
 * Användning:
 *   npx tsx scripts/test-winesearcher-batch.ts
 *
 * Output:
 *   - Konsollogg med progress
 *   - JSON-fil: scripts/output/winesearcher-test-results-{timestamp}.json
 *   - CSV-fil: scripts/output/winesearcher-test-results-{timestamp}.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

// ============================================================================
// Konfiguration
// ============================================================================

const WINESEARCHER_API_KEY = process.env.WINESEARCHER_API_KEY;
const DELAY_BETWEEN_REQUESTS_MS = 500; // Undvik rate limiting

// Testset med viner - varierande typer, regioner, stavningar
const TEST_WINES: Array<{ name: string; vintage?: string; category: string }> = [
  // Bordeaux - kända viner
  { name: 'Chateau Margaux', vintage: '2015', category: 'bordeaux-premier-cru' },
  { name: 'Chateau Lafite Rothschild', vintage: '2018', category: 'bordeaux-premier-cru' },
  { name: 'Chateau Mouton Rothschild', vintage: '2016', category: 'bordeaux-premier-cru' },
  { name: 'Petrus', vintage: '2019', category: 'bordeaux-pomerol' },
  { name: 'Chateau Cheval Blanc', vintage: '2017', category: 'bordeaux-st-emilion' },

  // Bourgogne
  { name: 'Domaine de la Romanée-Conti Romanée-Conti', vintage: '2018', category: 'bourgogne-grand-cru' },
  { name: 'Domaine Leroy Musigny', vintage: '2017', category: 'bourgogne-grand-cru' },
  { name: 'Louis Jadot Gevrey-Chambertin', vintage: '2019', category: 'bourgogne-village' },

  // Champagne
  { name: 'Dom Perignon', vintage: '2012', category: 'champagne' },
  { name: 'Krug Grande Cuvée', category: 'champagne-nv' },
  { name: 'Louis Roederer Cristal', vintage: '2014', category: 'champagne' },

  // Italien
  { name: 'Sassicaia', vintage: '2018', category: 'italy-super-tuscan' },
  { name: 'Tignanello Antinori', vintage: '2019', category: 'italy-super-tuscan' },
  { name: 'Gaja Barbaresco', vintage: '2017', category: 'italy-piedmont' },

  // Spanien
  { name: 'Vega Sicilia Unico', vintage: '2011', category: 'spain-ribera' },
  { name: 'Pingus', vintage: '2018', category: 'spain-ribera' },

  // Rhône
  { name: 'Guigal Côte-Rôtie La Mouline', vintage: '2017', category: 'rhone-north' },
  { name: 'Château de Beaucastel Châteauneuf-du-Pape', vintage: '2019', category: 'rhone-south' },

  // Nya världen
  { name: 'Opus One', vintage: '2018', category: 'usa-napa' },
  { name: 'Screaming Eagle Cabernet Sauvignon', vintage: '2019', category: 'usa-napa' },
  { name: 'Penfolds Grange', vintage: '2017', category: 'australia' },

  // Felstavningar och varianter (för att testa fuzzy matching)
  { name: 'Chateau Margau', vintage: '2015', category: 'test-misspelling' },
  { name: 'Ch. Lafite Rothschild', vintage: '2018', category: 'test-abbreviation' },
  { name: 'Romanee Conti DRC', vintage: '2018', category: 'test-variation' },

  // Svenska och nordiska importörer-stil
  { name: 'Margaux 2015 Chateau', vintage: '2015', category: 'test-word-order' },

  // Mindre kända viner
  { name: 'Domaine Weinbach Riesling Grand Cru Schlossberg', vintage: '2020', category: 'alsace' },
  { name: 'Egon Müller Scharzhofberger Riesling Spätlese', vintage: '2019', category: 'germany-mosel' },

  // Edge cases
  { name: 'Unknown Wine That Does Not Exist XYZ123', vintage: '2020', category: 'test-not-found' },
  { name: '', vintage: '2020', category: 'test-empty-name' },
];

// ============================================================================
// Types
// ============================================================================

type MatchStatus = 'FOUND' | 'NOT_FOUND' | 'ERROR';

/**
 * Wine Check API (/x) returnerar:
 * - region, grape
 * - price-average, price-min, price-max (i vald valuta)
 * - ws-score (Wine-Searcher aggregerat kritikerbetyg)
 */
interface WineCheckResult {
  region: string | null;
  grape: string | null;
  price_average: number | null;
  price_min: number | null;
  price_max: number | null;
  ws_score: number | null;
  currency: string | null;
  match_status: MatchStatus;
  raw_xml?: string;
}

interface TestResult {
  input: {
    name: string;
    vintage?: string;
    category: string;
  };
  output: WineCheckResult | null;
  duration_ms: number;
  timestamp: string;
  error?: string;
}

interface TestSummary {
  total_tests: number;
  successful: number;
  failed: number;
  by_status: Record<MatchStatus, number>;
  by_category: Record<string, { total: number; found: number; not_found: number; error: number }>;
  average_ws_score: number;
  average_price_avg: number;
  average_duration_ms: number;
}

// ============================================================================
// API Client
// ============================================================================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

async function callWineSearcherAPI(
  name: string,
  vintage?: string
): Promise<{ result: WineCheckResult; rawXml?: string }> {
  if (!WINESEARCHER_API_KEY) {
    throw new Error('WINESEARCHER_API_KEY environment variable not set');
  }

  if (!name || name.trim() === '') {
    return {
      result: {
        region: null,
        grape: null,
        price_average: null,
        price_min: null,
        price_max: null,
        ws_score: null,
        currency: null,
        match_status: 'ERROR'
      }
    };
  }

  const params = new URLSearchParams({
    api_key: WINESEARCHER_API_KEY,
    winename: name,
    ...(vintage && { vintage })
  });

  const response = await fetch(`https://api.wine-searcher.com/x?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/xml',
      'User-Agent': 'Winefeed-Test/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const rawXml = await response.text();
  const result = parseWineSearcherXML(rawXml);

  return { result, rawXml };
}

/**
 * Parsar Wine-Searcher XML-svar
 * Format:
 * <wine-searcher>
 *   <return-code>0</return-code>
 *   <list-currency-code>USD</list-currency-code>
 *   <wine-details>
 *     <wine>
 *       <region>Pomerol</region>
 *       <grape>Merlot</grape>
 *       <price-average>3584.99</price-average>
 *       <price-min>2899.84</price-min>
 *       <price-max>5352.73</price-max>
 *       <ws-score>94</ws-score>
 *     </wine>
 *   </wine-details>
 * </wine-searcher>
 */
function parseWineSearcherXML(rawXml: string): WineCheckResult {
  try {
    const parsed = xmlParser.parse(rawXml);
    const ws = parsed['wine-searcher'];

    if (!ws) {
      return {
        region: null,
        grape: null,
        price_average: null,
        price_min: null,
        price_max: null,
        ws_score: null,
        currency: null,
        match_status: 'ERROR',
        raw_xml: rawXml
      };
    }

    const returnCode = ws['return-code'];
    const currency = ws['list-currency-code'] || null;
    const wineDetails = ws['wine-details'];
    const wine = wineDetails?.wine;

    // return-code 0 = success, annat = not found/error
    if (returnCode !== 0 && returnCode !== '0') {
      return {
        region: null,
        grape: null,
        price_average: null,
        price_min: null,
        price_max: null,
        ws_score: null,
        currency,
        match_status: 'NOT_FOUND',
        raw_xml: rawXml
      };
    }

    if (!wine) {
      return {
        region: null,
        grape: null,
        price_average: null,
        price_min: null,
        price_max: null,
        ws_score: null,
        currency,
        match_status: 'NOT_FOUND',
        raw_xml: rawXml
      };
    }

    return {
      region: wine.region || null,
      grape: wine.grape || null,
      price_average: wine['price-average'] ? parseFloat(wine['price-average']) : null,
      price_min: wine['price-min'] ? parseFloat(wine['price-min']) : null,
      price_max: wine['price-max'] ? parseFloat(wine['price-max']) : null,
      ws_score: wine['ws-score'] ? parseInt(wine['ws-score'], 10) : null,
      currency,
      match_status: 'FOUND',
      raw_xml: rawXml
    };
  } catch (err: any) {
    return {
      region: null,
      grape: null,
      price_average: null,
      price_min: null,
      price_max: null,
      ws_score: null,
      currency: null,
      match_status: 'ERROR',
      raw_xml: rawXml
    };
  }
}

// ============================================================================
// Test Runner
// ============================================================================

async function runTest(wine: typeof TEST_WINES[0]): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const { result } = await callWineSearcherAPI(wine.name, wine.vintage);
    const duration_ms = Date.now() - startTime;

    return {
      input: wine,
      output: result,
      duration_ms,
      timestamp
    };
  } catch (err: any) {
    const duration_ms = Date.now() - startTime;

    return {
      input: wine,
      output: null,
      duration_ms,
      timestamp,
      error: err.message
    };
  }
}

function calculateSummary(results: TestResult[]): TestSummary {
  const byStatus: Record<MatchStatus, number> = {
    FOUND: 0,
    NOT_FOUND: 0,
    ERROR: 0
  };

  const byCategory: Record<string, { total: number; found: number; not_found: number; error: number }> = {};

  let totalWsScore = 0;
  let wsScoreCount = 0;
  let totalPriceAvg = 0;
  let priceCount = 0;
  let totalDuration = 0;
  let successful = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.output?.match_status || 'ERROR';
    byStatus[status]++;

    const category = result.input.category;
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, found: 0, not_found: 0, error: 0 };
    }
    byCategory[category].total++;

    if (status === 'FOUND') byCategory[category].found++;
    if (status === 'NOT_FOUND') byCategory[category].not_found++;
    if (status === 'ERROR') byCategory[category].error++;

    if (result.output?.ws_score) {
      totalWsScore += result.output.ws_score;
      wsScoreCount++;
    }

    if (result.output?.price_average) {
      totalPriceAvg += result.output.price_average;
      priceCount++;
    }

    totalDuration += result.duration_ms;

    if (result.error || status === 'ERROR') {
      failed++;
    } else {
      successful++;
    }
  }

  return {
    total_tests: results.length,
    successful,
    failed,
    by_status: byStatus,
    by_category: byCategory,
    average_ws_score: wsScoreCount > 0 ? Math.round(totalWsScore / wsScoreCount) : 0,
    average_price_avg: priceCount > 0 ? Math.round(totalPriceAvg / priceCount) : 0,
    average_duration_ms: Math.round(totalDuration / results.length)
  };
}

function generateCSV(results: TestResult[]): string {
  const headers = [
    'timestamp',
    'input_name',
    'input_vintage',
    'category',
    'match_status',
    'region',
    'grape',
    'price_avg_usd',
    'price_min_usd',
    'price_max_usd',
    'ws_score',
    'currency',
    'duration_ms',
    'error'
  ];

  const rows = results.map(r => [
    r.timestamp,
    `"${(r.input.name || '').replace(/"/g, '""')}"`,
    r.input.vintage || '',
    r.input.category,
    r.output?.match_status || 'ERROR',
    `"${(r.output?.region || '').replace(/"/g, '""')}"`,
    `"${(r.output?.grape || '').replace(/"/g, '""')}"`,
    r.output?.price_average ?? '',
    r.output?.price_min ?? '',
    r.output?.price_max ?? '',
    r.output?.ws_score ?? '',
    r.output?.currency || '',
    r.duration_ms,
    `"${(r.error || '').replace(/"/g, '""')}"`
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Wine-Searcher Batch Test                             ║');
  console.log('║           Utvärdering innan nyckeln går ut 2026-01-23          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!WINESEARCHER_API_KEY) {
    console.error('❌ FEL: WINESEARCHER_API_KEY miljövariabel saknas!');
    console.error('   Kör: export WINESEARCHER_API_KEY="din-nyckel"');
    process.exit(1);
  }

  console.log(`📋 Antal viner att testa: ${TEST_WINES.length}`);
  console.log(`⏱️  Delay mellan anrop: ${DELAY_BETWEEN_REQUESTS_MS}ms`);
  console.log('');

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < TEST_WINES.length; i++) {
    const wine = TEST_WINES[i];
    const progress = `[${i + 1}/${TEST_WINES.length}]`;

    process.stdout.write(`${progress} Testar: ${wine.name || '(tom)'} ${wine.vintage || ''} ... `);

    const result = await runTest(wine);
    results.push(result);

    const status = result.output?.match_status || 'ERROR';
    const statusIcon = {
      FOUND: '✅',
      NOT_FOUND: '❌',
      ERROR: '💥'
    }[status];

    const extra = status === 'FOUND'
      ? ` | ${result.output?.region || '?'} | $${result.output?.price_average?.toFixed(0) || '?'} | WS:${result.output?.ws_score || '?'}`
      : '';

    console.log(`${statusIcon} ${status}${extra} (${result.duration_ms}ms)`);

    if (i < TEST_WINES.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  const totalDuration = Date.now() - startTime;
  const summary = calculateSummary(results);

  // Skapa output-katalog
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Spara JSON
  const jsonPath = path.join(outputDir, `winesearcher-test-results-${timestamp}.json`);
  const jsonOutput = {
    test_run: {
      timestamp: new Date().toISOString(),
      total_duration_ms: totalDuration,
      api_key_prefix: WINESEARCHER_API_KEY.slice(0, 8) + '...'
    },
    summary,
    results
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));

  // Spara CSV
  const csvPath = path.join(outputDir, `winesearcher-test-results-${timestamp}.csv`);
  fs.writeFileSync(csvPath, generateCSV(results));

  // Skriv ut sammanfattning
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        SAMMANFATTNING                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Total tid: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Genomsnittlig svarstid: ${summary.average_duration_ms}ms`);
  console.log('');
  console.log('📊 Resultat per status:');
  console.log(`   ✅ FOUND:     ${summary.by_status.FOUND} (${Math.round(summary.by_status.FOUND / summary.total_tests * 100)}%)`);
  console.log(`   ❌ NOT_FOUND: ${summary.by_status.NOT_FOUND} (${Math.round(summary.by_status.NOT_FOUND / summary.total_tests * 100)}%)`);
  console.log(`   💥 ERROR:     ${summary.by_status.ERROR} (${Math.round(summary.by_status.ERROR / summary.total_tests * 100)}%)`);
  console.log('');
  console.log(`📈 Genomsnittligt WS-score: ${summary.average_ws_score}`);
  console.log(`💰 Genomsnittligt pris (USD): $${summary.average_price_avg}`);
  console.log('');
  console.log('📁 Resultat per kategori:');
  for (const [category, stats] of Object.entries(summary.by_category)) {
    const foundPct = Math.round(stats.found / stats.total * 100);
    console.log(`   ${category}: ${stats.found}/${stats.total} hittade (${foundPct}%)`);
  }
  console.log('');
  console.log('📄 Filer sparade:');
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   CSV:  ${csvPath}`);
  console.log('');

  // Exit kod baserat på resultat
  const successRate = summary.by_status.FOUND / summary.total_tests;
  if (successRate < 0.5) {
    console.log('⚠️  Varning: Mindre än 50% av vinerna matchades.');
    process.exit(1);
  }

  console.log('✅ Test genomfört!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
