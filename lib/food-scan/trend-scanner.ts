/**
 * Food Scan Agent — Trend Scanner
 *
 * Scrapes Köket.se sitemap for new recipes, extracts dish names from JSON-LD.
 * Rate-limited to 3s between page fetches. Max 50 recipes per run.
 */

import { analyzeDishes } from './menu-analyzer';
import type { TrendScanResult, WoltMenuItem } from './types';

const KOKET_SITEMAP_URL = 'https://www.koket.se/sitemap-recipes.xml';
const MAX_RECIPES_PER_RUN = 50;
const RATE_LIMIT_MS = 3000;

/**
 * Scan Köket.se for recent recipes, analyze against food pairing table.
 */
export async function scanKoketTrends(): Promise<TrendScanResult> {
  const recipeUrls = await fetchSitemapUrls();
  const recent = recipeUrls.slice(0, MAX_RECIPES_PER_RUN);

  console.log(`[TrendScanner] Found ${recipeUrls.length} recipes in sitemap, processing ${recent.length}`);

  const dishes: WoltMenuItem[] = [];

  for (const url of recent) {
    try {
      await delay(RATE_LIMIT_MS);
      const dishName = await extractRecipeName(url);
      if (dishName) {
        dishes.push({ name: dishName, category: 'recept' });
      }
    } catch (err: any) {
      console.warn(`[TrendScanner] Failed to extract ${url}: ${err.message}`);
    }
  }

  console.log(`[TrendScanner] Extracted ${dishes.length} dish names from ${recent.length} recipes`);

  const analyzed = analyzeDishes(dishes);
  const unmatched = analyzed.filter(d => !d.matched);

  return {
    source: 'Köket.se',
    recipes_found: dishes.length,
    new_dishes: unmatched.length,
    dishes: analyzed,
  };
}

async function fetchSitemapUrls(): Promise<string[]> {
  try {
    const res = await fetch(KOKET_SITEMAP_URL, {
      headers: { 'User-Agent': 'Winefeed/1.0 (food-trend-scanner)' },
    });

    if (!res.ok) {
      console.warn(`[TrendScanner] Sitemap fetch failed: ${res.status}`);
      return [];
    }

    const xml = await res.text();

    // Extract <loc> URLs from sitemap XML
    const urls: string[] = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1];
      if (url.includes('/recept/') || url.includes('/recipe/')) {
        urls.push(url);
      }
    }

    return urls;
  } catch (err: any) {
    console.warn(`[TrendScanner] Sitemap error: ${err.message}`);
    return [];
  }
}

async function extractRecipeName(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Winefeed/1.0 (food-trend-scanner)' },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Try JSON-LD first
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        const recipe = Array.isArray(ld) ? ld.find((item: any) => item['@type'] === 'Recipe') : ld;
        if (recipe?.name) {
          return typeof recipe.name === 'string' ? recipe.name : null;
        }
      } catch {
        // JSON parse failed, try fallback
      }
    }

    // Fallback: <title> tag
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      // Remove site name suffix
      const title = titleMatch[1].split('|')[0].split('-')[0].trim();
      if (title && title.length > 2 && title.length < 100) {
        return title;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
