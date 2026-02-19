/**
 * Food Scan Agent — Wolt Consumer API Client
 *
 * Uses Wolt's public consumer API to search venues and fetch menus.
 * Rate-limited to 2s between requests.
 */

import { WoltMenuItem, WoltVenue } from './types';

const WOLT_API_BASE = 'https://restaurant-api.wolt.com';
const RATE_LIMIT_MS = 2000;

let lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Winefeed/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Wolt API ${res.status}: ${res.statusText}`);
  }

  return res;
}

/**
 * Search Wolt venues by query and city.
 * Returns top matches with slug, name, address.
 */
export async function searchVenues(query: string, city: string): Promise<WoltVenue[]> {
  const citySlug = city.toLowerCase().trim();
  const q = encodeURIComponent(query.trim());

  const res = await rateLimitedFetch(
    `${WOLT_API_BASE}/v1/pages/search?q=${q}&lat=59.3293&lon=18.0686`
  );
  const data = await res.json();

  const venues: WoltVenue[] = [];

  // Wolt search response has sections → items
  const sections = data?.sections || [];
  for (const section of sections) {
    const items = section?.items || [];
    for (const item of items) {
      const venue = item?.venue || item;
      if (venue?.slug) {
        venues.push({
          slug: venue.slug,
          name: venue.name?.[0]?.value || venue.name || venue.slug,
          city: citySlug,
          address: venue.address || venue.short_description?.[0]?.value || '',
        });
      }
    }
  }

  return venues.slice(0, 10);
}

/**
 * Fetch full menu for a venue by slug.
 * Returns flattened list of menu items.
 */
export async function fetchMenu(slug: string): Promise<WoltMenuItem[]> {
  const res = await rateLimitedFetch(
    `${WOLT_API_BASE}/v3/venues/slug/${slug}/menu`
  );
  const data = await res.json();

  const items: WoltMenuItem[] = [];
  const seen = new Set<string>();

  // Wolt menu structure: categories → items
  const categories = data?.categories || data?.results || [];
  for (const cat of categories) {
    const categoryName = cat?.name?.[0]?.value || cat?.name || '';
    const menuItems = cat?.items || [];

    for (const item of menuItems) {
      const name = item?.name?.[0]?.value || item?.name || '';
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      items.push({
        name,
        description: item?.description?.[0]?.value || item?.description || undefined,
        price: item?.baseprice != null ? item.baseprice / 100 : undefined,
        category: categoryName || undefined,
      });
    }
  }

  return items;
}
