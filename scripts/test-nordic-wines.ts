/**
 * Wine-Searcher Nordic Wine Test
 *
 * Tests API coverage for Swedish, Danish, and Norwegian wines.
 * Run with: npx ts-node scripts/test-nordic-wines.ts
 */

import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = 'wnestest82020261601';
const BASE_URL = 'https://api.wine-searcher.com/x';

interface TestWine {
  name: string;
  vintage?: number | string;
  country: string;
  category: string;
}

interface TestResult {
  wine: TestWine;
  found: boolean;
  matchedName?: string;
  matchedVintage?: string;
  matchedRegion?: string;
  error?: string;
}

interface CountryStats {
  country: string;
  found: number;
  total: number;
  rate: number;
}

// Test wines
const NORDIC_WINES: TestWine[] = [
  // Swedish wines - Skåne
  { name: 'Kullabergs Solaris', vintage: 2022, country: 'Sweden', category: 'Skåne' },
  { name: 'Kullabergs Rondo', vintage: 2021, country: 'Sweden', category: 'Skåne' },
  { name: 'Arilds Vingård Solaris', vintage: 2022, country: 'Sweden', category: 'Skåne' },
  { name: 'Hällåkra Solaris', vintage: 2022, country: 'Sweden', category: 'Skåne' },
  { name: 'Villa Mathilda', vintage: 2022, country: 'Sweden', category: 'Skåne' },
  { name: 'Vejby Vingård', vintage: 2021, country: 'Sweden', category: 'Skåne' },

  // Swedish wines - Gotland
  { name: 'Gutevinen', vintage: 2022, country: 'Sweden', category: 'Gotland' },
  { name: 'Wannborga Solaris', vintage: 2021, country: 'Sweden', category: 'Gotland' },

  // Swedish wines - Other
  { name: 'Blaxsta Solaris', vintage: 2022, country: 'Sweden', category: 'Södermanland' },
  { name: 'Thora Vingård', vintage: 2021, country: 'Sweden', category: 'Other' },

  // Swedish wines - No vintage
  { name: 'Kullabergs Solaris', country: 'Sweden', category: 'No vintage test' },

  // Danish wines
  { name: 'Frederiksdal Kirsebærvin', vintage: 2020, country: 'Denmark', category: 'Cherry wine' },
  { name: 'Frederiksdal Vin af Kirsebær', vintage: 'NV', country: 'Denmark', category: 'Cherry wine NV' },
  { name: 'Dyrehøj Solaris', vintage: 2021, country: 'Denmark', category: 'White' },
  { name: 'Skaersogaard', vintage: 2021, country: 'Denmark', category: 'White' },
  { name: 'Vesterhave Vin', vintage: 2021, country: 'Denmark', category: 'White' },

  // Norwegian wines
  { name: 'Egge Gård', vintage: 2021, country: 'Norway', category: 'White' },
  { name: 'Lerkekåsa Vingård', vintage: 2021, country: 'Norway', category: 'White' },

  // Alternative searches
  { name: 'Solaris Sweden', country: 'Sweden', category: 'Alt search' },
  { name: 'Swedish Solaris', country: 'Sweden', category: 'Alt search' },
  { name: 'Rondo Sweden', country: 'Sweden', category: 'Alt search' },
];

// Country flags
const FLAGS: Record<string, string> = {
  'Sweden': '🇸🇪',
  'Denmark': '🇩🇰',
  'Norway': '🇳🇴',
};

async function searchWine(wine: TestWine): Promise<TestResult> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    winename: wine.name,
  });

  // Add vintage if specified
  if (wine.vintage) {
    params.append('vintage', wine.vintage.toString());
  }

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    // Parse XML response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const data = parser.parse(text);

    // Check for wine results
    const wines = data?.wines?.wine;

    if (wines) {
      const wineData = Array.isArray(wines) ? wines[0] : wines;
      return {
        wine,
        found: true,
        matchedName: wineData.name || wineData.winename,
        matchedVintage: wineData.vintage,
        matchedRegion: wineData.region || wineData.appellation,
      };
    }

    return { wine, found: false };

  } catch (error: any) {
    return { wine, found: false, error: error.message };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createProgressBar(found: number, total: number, width: number = 10): string {
  const filled = Math.round((found / total) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function runTests(): Promise<void> {
  console.log('\n🍷 Wine-Searcher Nordic Wine Test');
  console.log('=====================================\n');

  const results: TestResult[] = [];
  let currentCountry = '';

  for (let i = 0; i < NORDIC_WINES.length; i++) {
    const wine = NORDIC_WINES[i];

    // Print country header if changed
    if (wine.country !== currentCountry) {
      currentCountry = wine.country;
      console.log(`\n${FLAGS[wine.country]} ${wine.country.toUpperCase()}`);
      console.log('-'.repeat(50));
    }

    const result = await searchWine(wine);
    results.push(result);

    // Format output
    const vintageStr = wine.vintage ? ` ${wine.vintage}` : '';
    const wineLabel = `${wine.name}${vintageStr}`.padEnd(35);

    if (result.found) {
      console.log(`  ${wineLabel} ✅ → ${result.matchedName}`);
    } else {
      console.log(`  ${wineLabel} ❌ NOT FOUND`);
    }

    // Rate limit - wait 500ms between requests
    if (i < NORDIC_WINES.length - 1) {
      await sleep(500);
    }
  }

  // Calculate statistics
  const byCountry: CountryStats[] = [];
  const countries = ['Sweden', 'Denmark', 'Norway'];

  for (const country of countries) {
    const countryResults = results.filter(r => r.wine.country === country);
    const found = countryResults.filter(r => r.found).length;
    const total = countryResults.length;
    byCountry.push({
      country,
      found,
      total,
      rate: Math.round((found / total) * 100),
    });
  }

  const totalFound = results.filter(r => r.found).length;
  const totalTested = results.length;
  const totalRate = Math.round((totalFound / totalTested) * 100);

  // Print summary
  console.log('\n=====================================');
  console.log('📊 SAMMANFATTNING\n');

  console.log('PER LAND:');
  for (const stats of byCountry) {
    const flag = FLAGS[stats.country];
    const bar = createProgressBar(stats.found, stats.total);
    console.log(`  ${flag} ${stats.country.padEnd(10)} ${bar} ${stats.found}/${stats.total} (${stats.rate}%)`);
  }

  console.log(`\nTOTALT: ${totalFound}/${totalTested} (${totalRate}%)`);

  // Print found wines
  const foundWines = results.filter(r => r.found);
  if (foundWines.length > 0) {
    console.log('\n✅ HITTADE VINER:');
    for (const r of foundWines) {
      console.log(`  - ${r.wine.name} → ${r.matchedName}`);
    }
  }

  // Print not found wines
  const notFoundWines = results.filter(r => !r.found);
  if (notFoundWines.length > 0) {
    console.log('\n❌ EJ HITTADE:');
    for (const r of notFoundWines) {
      const vintageStr = r.wine.vintage ? ` ${r.wine.vintage}` : '';
      console.log(`  - ${r.wine.name}${vintageStr} (${r.wine.country})`);
    }
  }

  // Recommendation
  console.log('\n💡 REKOMMENDATION:');
  if (totalRate >= 50) {
    console.log('  ✅ Wine-Searcher har acceptabel täckning för nordiska viner.');
  } else if (totalRate >= 25) {
    console.log('  ⚠️ Wine-Searcher har begränsad täckning för nordiska viner.');
    console.log('  → Kan användas som komplement, men behöver alternativ datakälla.');
  } else {
    console.log('  ❌ Wine-Searcher har låg täckning för nordiska viner.');
    console.log('  → Behöver alternativ datakälla för svenska/danska/norska viner.');
    console.log('  → Överväg: Systembolaget API, lokala vinregister, manuell data.');
  }

  // Save results to JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(__dirname, 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `nordic-wine-results-${timestamp}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    apiKey: API_KEY.slice(0, 8) + '...',
    totalTested,
    found: totalFound,
    rate: totalRate,
    byCountry,
    results: results.map(r => ({
      name: r.wine.name,
      vintage: r.wine.vintage,
      country: r.wine.country,
      category: r.wine.category,
      found: r.found,
      matchedName: r.matchedName,
      matchedVintage: r.matchedVintage,
      matchedRegion: r.matchedRegion,
      error: r.error,
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📁 Resultat sparade: ${outputPath}`);
}

// Run tests
runTests().catch(console.error);
