/**
 * SYSTEMBOLAGET SCRAPER
 *
 * Fetches wine data from Systembolaget product pages.
 * Extracts taste profiles, aromas, food pairings — NOT prices.
 *
 * Two modes:
 * 1. scrapeProductPage(url) — single product page
 * 2. scrapeCategory(categoryUrl) — discover + scrape wines in a category
 *
 * Rate-limited: 1 request per 2 seconds to be respectful.
 */

import { generateEmbedding, buildWineEmbeddingText } from './embeddings';

export interface ScrapedWine {
  wine_name: string;
  producer: string | null;
  grape: string | null;
  country: string | null;
  region: string | null;
  subregion: string | null;
  color: string | null;
  vintage: number | null;
  taste_clock_body: number | null;
  taste_clock_acidity: number | null;
  taste_clock_tannin: number | null;
  taste_clock_sweetness: number | null;
  aroma_description: string | null;
  taste_description: string | null;
  appearance: string | null;
  food_pairings: string | null;
  alcohol_pct: number | null;
  organic: boolean;
  biodynamic: boolean;
  vegan: boolean;
  serving_temp: string | null;
  aging_potential: string | null;
  source_url: string;
  source_id: string;
}

const RATE_LIMIT_MS = 2000;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Winefeed-Sommelier/1.0 (wine knowledge enrichment)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'sv-SE,sv;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

/**
 * Parse a Systembolaget product page HTML into structured wine data.
 */
export function parseProductPage(html: string, url: string): ScrapedWine | null {
  // Extract article number from URL
  const articleMatch = url.match(/(\d{5,8})\/?$/);
  if (!articleMatch) return null;
  const sourceId = articleMatch[1];

  // Helper to extract text between patterns
  const extract = (pattern: RegExp): string | null => {
    const match = html.match(pattern);
    return match ? match[1].trim() : null;
  };

  // Extract JSON-LD structured data if available
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  let productData: any = null;
  if (jsonLdMatch) {
    for (const script of jsonLdMatch) {
      try {
        const json = script.replace(/<\/?script[^>]*>/g, '');
        const parsed = JSON.parse(json);
        if (parsed['@type'] === 'Product' || parsed.name) {
          productData = parsed;
          break;
        }
      } catch {}
    }
  }

  // Wine name — from title tag or og:title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
  const rawTitle = ogTitleMatch?.[1] || titleMatch?.[1] || '';
  const wineName = rawTitle.replace(/\s*\|\s*Systembolaget.*$/, '').trim();

  if (!wineName) return null;

  // Color mapping
  const colorMap: Record<string, string> = {
    'rött vin': 'red', 'rödvin': 'red',
    'vitt vin': 'white', 'vitvin': 'white',
    'rosévin': 'rose', 'rosé': 'rose',
    'mousserande': 'sparkling',
    'orange vin': 'orange',
  };

  // Extract color from page content
  let color: string | null = null;
  const htmlLower = html.toLowerCase();
  for (const [key, value] of Object.entries(colorMap)) {
    if (htmlLower.includes(key)) {
      color = value;
      break;
    }
  }

  // Taste clock values — look for patterns like "Fyllighet: 10" or data attributes
  const bodyMatch = html.match(/(?:fyllighet|kropp|body)[^\d]*(\d{1,2})/i);
  const acidityMatch = html.match(/(?:fruktsyra|syra|acidity)[^\d]*(\d{1,2})/i);
  const tanninMatch = html.match(/(?:strävhet|tannin)[^\d]*(\d{1,2})/i);
  const sweetnessMatch = html.match(/(?:sötma|sweetness)[^\d]*(\d{1,2})/i);

  const parseClockValue = (match: RegExpMatchArray | null): number | null => {
    if (!match) return null;
    const val = parseInt(match[1]);
    return val >= 1 && val <= 12 ? val : null;
  };

  // Taste/aroma descriptions — look for characteristic Swedish sommelier text
  const aromaMatch = html.match(/(?:doft|arom)[^.]*?((?:nyanserad|aromatisk|kryddig|blommig|fruktig)[^.]+\.)/i);
  const tasteMatch = html.match(/(?:smak)[^.]*?((?:nyanserad|aromatisk|kryddig|fruktig|balanserad)[^.]+\.)/i);
  const appearanceMatch = html.match(/(?:färg|utseende)[^.]*?((?:ljus|mörk|blek|djup|klar)[^.]+\.)/i);

  // Food pairings
  const foodMatch = html.match(/(?:passar\s+till|matförslag)[^:]*[:]\s*([^.<]+)/i);

  // Producer
  const producerMatch = html.match(/(?:producent|producer)[^\w]*([^<,]+)/i);

  // Grape
  const grapeMatch = html.match(/(?:druva|grape|råvar)[^\w]*([^<,]+)/i);

  // Country & region
  const countryMatch = html.match(/(?:land|country)[^\w]*([^<,]+)/i);
  const regionMatch = html.match(/(?:region)[^\w]*([^<,]+)/i);

  // Alcohol
  const alcoholMatch = html.match(/(\d{1,2}[.,]\d)\s*%\s*vol/i);

  // Organic/vegan
  const organic = /ekologisk/i.test(html);
  const biodynamic = /biodynamisk/i.test(html);
  const vegan = /veganvänlig|vegansk/i.test(html);

  // Serving temp
  const tempMatch = html.match(/(\d{1,2}\s*[-–]\s*\d{1,2}\s*°C|cirka\s+\d{1,2}\s*°C)/i);

  // Aging
  const agingMatch = html.match(/(kan lagras|dricks\s+(?:nu|ung))/i);

  // Vintage
  const vintageMatch = wineName.match(/\b(19|20)\d{2}\b/);

  return {
    wine_name: wineName,
    producer: producerMatch?.[1]?.trim() || productData?.brand?.name || null,
    grape: grapeMatch?.[1]?.trim() || null,
    country: countryMatch?.[1]?.trim() || null,
    region: regionMatch?.[1]?.trim() || null,
    subregion: null, // Hard to extract reliably
    color,
    vintage: vintageMatch ? parseInt(vintageMatch[0]) : null,
    taste_clock_body: parseClockValue(bodyMatch),
    taste_clock_acidity: parseClockValue(acidityMatch),
    taste_clock_tannin: parseClockValue(tanninMatch),
    taste_clock_sweetness: parseClockValue(sweetnessMatch),
    aroma_description: aromaMatch?.[1] || null,
    taste_description: tasteMatch?.[1] || null,
    appearance: appearanceMatch?.[1] || null,
    food_pairings: foodMatch?.[1]?.trim() || null,
    alcohol_pct: alcoholMatch ? parseFloat(alcoholMatch[1].replace(',', '.')) : null,
    organic,
    biodynamic,
    vegan,
    serving_temp: tempMatch?.[1] || null,
    aging_potential: agingMatch?.[1] || null,
    source_url: url,
    source_id: sourceId,
  };
}

/**
 * Scrape a single Systembolaget product page.
 */
export async function scrapeProductPage(url: string): Promise<ScrapedWine | null> {
  try {
    const html = await rateLimitedFetch(url);
    return parseProductPage(html, url);
  } catch (error: any) {
    console.warn(`[Scraper] Failed to scrape ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Discover product URLs from a Systembolaget category page.
 * Returns array of product URLs found on the page.
 */
export async function discoverProductUrls(categoryUrl: string): Promise<string[]> {
  try {
    const html = await rateLimitedFetch(categoryUrl);
    const urls: string[] = [];

    // Look for product links like /produkt/vin/name-123456/
    const linkPattern = /href="(\/produkt\/vin\/[^"]+\d{5,8}\/?)""/g;
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const fullUrl = `https://www.systembolaget.se${match[1]}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }

    return urls;
  } catch (error: any) {
    console.warn(`[Scraper] Failed to discover URLs from ${categoryUrl}: ${error.message}`);
    return [];
  }
}

/**
 * Alternative: Import from GitHub data repo (AlexGustafsson/systembolaget-api-data).
 * This is faster and more reliable than scraping.
 */
export async function fetchGitHubData(): Promise<any[]> {
  const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/AlexGustafsson/systembolaget-api-data/main/data/assortment.json';

  try {
    const response = await fetch(GITHUB_DATA_URL);
    if (!response.ok) {
      throw new Error(`GitHub data fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : data.products || data.items || [];
  } catch (error: any) {
    console.warn(`[Scraper] GitHub data fetch failed: ${error.message}`);
    return [];
  }
}

/**
 * Transform GitHub data product to ScrapedWine format.
 */
export function transformGitHubProduct(product: any): ScrapedWine | null {
  if (!product.productName && !product.productNameBold) return null;

  // Only process wine
  const category = (product.categoryLevel1 || '').toLowerCase();
  if (!category.includes('vin') && !category.includes('wine')) return null;

  const name = [product.productNameBold, product.productNameThin]
    .filter(Boolean)
    .join(' ')
    .trim() || product.productName;

  if (!name) return null;

  // Map color
  let color: string | null = null;
  const cat2 = (product.categoryLevel2 || '').toLowerCase();
  if (cat2.includes('rött') || cat2.includes('red')) color = 'red';
  else if (cat2.includes('vitt') || cat2.includes('white')) color = 'white';
  else if (cat2.includes('rosé')) color = 'rose';
  else if (cat2.includes('mousserande') || cat2.includes('sparkling')) color = 'sparkling';

  // Taste clocks
  const tasteClocks = product.tasteClocks || product.taste || {};

  return {
    wine_name: name,
    producer: product.producerName || null,
    grape: product.grapeNames || product.grape || null,
    country: product.country || null,
    region: product.originLevel1 || null,
    subregion: product.originLevel2 || null,
    color,
    vintage: product.vintage ? parseInt(product.vintage) : null,
    taste_clock_body: tasteClocks.body || tasteClocks.fyllighet || null,
    taste_clock_acidity: tasteClocks.fruitAcidity || tasteClocks.fruktsyra || null,
    taste_clock_tannin: tasteClocks.roughness || tasteClocks.stravhet || null,
    taste_clock_sweetness: tasteClocks.sweetness || tasteClocks.sotma || null,
    aroma_description: product.aroma || product.tasteDescription || null,
    taste_description: product.taste || null,
    appearance: null,
    food_pairings: product.dishDescription || null,
    alcohol_pct: product.alcoholPercentage ? parseFloat(product.alcoholPercentage) : null,
    organic: product.isOrganic || false,
    biodynamic: false,
    vegan: product.isVegan || false,
    serving_temp: null,
    aging_potential: null,
    source_url: product.productId
      ? `https://www.systembolaget.se/produkt/vin/${product.productId}/`
      : '',
    source_id: String(product.productId || product.productNumber || ''),
  };
}

/**
 * Full ingestion: fetch GitHub data → transform → return ScrapedWine[].
 * Filters to wines with taste data only (no point storing empty records).
 */
export async function ingestFromGitHub(): Promise<ScrapedWine[]> {
  console.log('[Scraper] Fetching data from GitHub...');
  const products = await fetchGitHubData();
  console.log(`[Scraper] Got ${products.length} products from GitHub`);

  const wines: ScrapedWine[] = [];
  for (const product of products) {
    const wine = transformGitHubProduct(product);
    if (wine && (wine.taste_description || wine.aroma_description || wine.taste_clock_body)) {
      wines.push(wine);
    }
  }

  console.log(`[Scraper] ${wines.length} wines with taste data after filtering`);
  return wines;
}
