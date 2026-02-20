/**
 * Brasri Import Pipeline for Vinkoll Access
 *
 * Handles importing wine catalogs from Brasri's non-standard JSON format.
 * Flattens nested field objects, maps to WineInput, and creates wines via access-service.
 */

import { normalizeColor } from './validators/wine-import';
import { normalizeCountry, lookupCountryFromRegion } from './catalog-agent/enrichment';
import {
  getOrCreateProducer,
  createWine,
  createLot,
  getImporters,
} from './access-service';
import type { WineInput } from './access-types';

// ============================================================================
// Types
// ============================================================================

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: { index: number; name: string; reason: string }[];
  wines: { id: string; name: string; producer: string; wine_type: string }[];
}

// ============================================================================
// Flatten
// ============================================================================

/**
 * Flatten a Brasri item from nested `{fieldName, displayName, value}` objects
 * to a plain `{key: value}` record. Handles both nested and already-flat fields.
 */
export function flattenBrasriItem(item: Record<string, any>): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, val] of Object.entries(item)) {
    if (val === null || val === undefined) continue;

    if (typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
      // Nested Brasri format: { fieldName, displayName, value }
      const v = val.value;
      if (v !== null && v !== undefined) {
        flat[key] = String(v).trim();
      }
    } else {
      // Already flat (string, number, etc.)
      flat[key] = String(val).trim();
    }
  }

  return flat;
}

// ============================================================================
// Map to WineInput
// ============================================================================

/**
 * Map a flattened Brasri record to WineInput fields + producer name + price.
 */
export function mapToWineInput(flat: Record<string, string>): {
  wine: Partial<WineInput>;
  producerName: string;
  price?: number;
} {
  const region = flat.Region?.trim() || flat.region?.trim() || undefined;

  // Country: normalize, then fallback to region lookup
  let country: string | undefined;
  const rawCountry = flat.Country?.trim() || flat.country?.trim() || undefined;
  if (rawCountry) {
    country = normalizeCountry(rawCountry) || rawCountry;
  }
  if (!country && region) {
    country = lookupCountryFromRegion(region);
  }

  // Wine type: normalize via COLOR_ALIASES
  const rawType = flat.type?.trim() || flat.wine_type?.trim() || undefined;
  let wineType = normalizeColor(rawType) || 'red';
  if (rawType && !normalizeColor(rawType)) {
    console.warn(`[brasri-import] Unknown wine type "${rawType}", defaulting to "red"`);
  }

  // Vintage: parse integer, null if NV or empty
  let vintage: number | null = null;
  const rawVintage = flat.vintage?.trim();
  if (rawVintage) {
    const parsed = parseInt(rawVintage, 10);
    if (!isNaN(parsed) && parsed >= 1800 && parsed <= 2100) {
      vintage = parsed;
    }
  }

  // Price
  let price: number | undefined;
  const rawPrice = flat.price?.trim() || flat.price_sek?.trim();
  if (rawPrice) {
    const parsed = parseFloat(rawPrice.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      price = parsed;
    }
  }

  const producerName = flat.producer?.trim() || flat.Producer?.trim() || '';

  const wine: Partial<WineInput> = {
    name: flat.productName?.trim() || flat.product_name?.trim() || flat.name?.trim() || '',
    wine_type: wineType,
    vintage,
    country: country || '',
    region: region || '',
    grape: flat.grape?.trim() || flat.grapes?.trim() || flat.Grape?.trim() || flat.Grapes?.trim() || null,
    appellation: flat.appellation?.trim() || flat.Appellation?.trim() || null,
    description: flat.description?.trim() || flat.Description?.trim() || null,
    image_url: flat.Picture?.trim() || flat.picture?.trim() || flat.image?.trim() || flat.image_url?.trim() || null,
    price_sek: price ?? null,
    volume_ml: parseInt(flat['Volume ml'] || flat.volume_ml || '750', 10) || 750,
    status: 'DRAFT',
  };

  return { wine, producerName, price };
}

// ============================================================================
// Import Orchestrator
// ============================================================================

/**
 * Import a full Brasri catalog into Access.
 *
 * Steps:
 * 1. Flatten each item
 * 2. Map to WineInput
 * 3. Validate required fields (name, country, region)
 * 4. If dryRun, return preview without writing to DB
 * 5. getOrCreateProducer for each unique producer
 * 6. createWine with status DRAFT
 * 7. createLot linked to importer
 */
export async function importBrasriCatalog(
  items: any[],
  importerName: string,
  opts?: { dryRun?: boolean },
): Promise<ImportResult> {
  const result: ImportResult = {
    total: items.length,
    created: 0,
    skipped: 0,
    errors: [],
    wines: [],
  };

  // Flatten + map all items
  const mapped = items.map((item, index) => {
    const flat = flattenBrasriItem(item);
    const { wine, producerName, price } = mapToWineInput(flat);
    return { index, wine, producerName, price };
  });

  // Validate required fields
  const valid: typeof mapped = [];
  for (const entry of mapped) {
    const missing: string[] = [];
    if (!entry.wine.name) missing.push('name');
    if (!entry.wine.country) missing.push('country');
    if (!entry.wine.region) missing.push('region');

    if (missing.length > 0) {
      result.errors.push({
        index: entry.index,
        name: entry.wine.name || '(unknown)',
        reason: `Missing required fields: ${missing.join(', ')}`,
      });
      result.skipped++;
    } else {
      valid.push(entry);
    }
  }

  // Dry run — return preview without DB writes
  if (opts?.dryRun) {
    result.wines = valid.map((entry) => ({
      id: '',
      name: entry.wine.name!,
      producer: entry.producerName,
      wine_type: entry.wine.wine_type!,
    }));
    return result;
  }

  // Resolve importer
  const importers = await getImporters();
  const importer = importers.find(
    (i) => i.name.toLowerCase() === importerName.toLowerCase(),
  );
  const importerId = importer?.id || null;

  // Cache producer lookups to avoid repeated DB calls
  const producerCache = new Map<string, string>();

  for (const entry of valid) {
    try {
      // Resolve producer
      let producerId: string;
      const pKey = entry.producerName.toLowerCase();
      if (producerCache.has(pKey)) {
        producerId = producerCache.get(pKey)!;
      } else {
        producerId = await getOrCreateProducer(entry.producerName);
        producerCache.set(pKey, producerId);
      }

      // Create wine
      const wine = await createWine({
        ...(entry.wine as WineInput),
        producer_id: producerId,
      });

      // Create lot linked to importer
      await createLot({
        wine_id: wine.id,
        importer_id: importerId,
        price_sek: entry.price ?? null,
        available: true,
      });

      result.created++;
      result.wines.push({
        id: wine.id,
        name: wine.name,
        producer: entry.producerName,
        wine_type: wine.wine_type,
      });
    } catch (err: any) {
      result.errors.push({
        index: entry.index,
        name: entry.wine.name || '(unknown)',
        reason: err.message,
      });
      result.skipped++;
    }
  }

  return result;
}
