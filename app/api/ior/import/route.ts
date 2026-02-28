/**
 * IOR CATALOG IMPORT API
 *
 * POST /api/ior/import
 * Accepts Combi JSON format and creates producers + products
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { createRouteClients } from '@/lib/supabase/route-client';

// Map Combi wine types to our enum
// Enum: RED, WHITE, ROSE, ORANGE, SPARKLING, DESSERT, FORTIFIED, OTHER
const WINE_TYPE_MAP: Record<string, string> = {
  'Red': 'RED',
  'White': 'WHITE',
  'Rose': 'ROSE',
  'Rosé': 'ROSE',
  'Sparkling': 'SPARKLING',
  'Orange': 'ORANGE',
  'Dessert': 'DESSERT',
  'Fortified': 'FORTIFIED',
  'Natural': 'OTHER',
  'Other': 'OTHER',
};

interface CombiField {
  fieldName?: string;
  displayName?: string;
  value: string;
}

interface CombiProduct {
  // Wine name variants
  wineName?: CombiField;
  productName?: CombiField;
  // Producer
  producer?: CombiField;
  // Wine details
  vintage?: CombiField;
  color?: CombiField;
  type?: CombiField;
  grape?: CombiField;
  grapes?: CombiField;
  region?: CombiField;
  country?: CombiField;
  // Appellation
  Appellation?: CombiField;
  appellation?: CombiField;
  // Size & packaging
  bottleSizeMl?: CombiField;
  Volume?: CombiField;
  volume?: CombiField;
  caseSize?: CombiField;
  // Other
  description?: CombiField;
  price?: CombiField;
  moq?: CombiField;
  alcoholPct?: CombiField;
  organic?: CombiField;
  sku?: CombiField;
  packagingType?: CombiField;
  // Combi tag
  Combi?: CombiField;
  combi?: CombiField;
}

interface CombiDataset {
  id: string;
  name: string;
  data: CombiProduct[];
}

export async function POST(request: NextRequest) {
  // Auth check
  const guardResult = await requireIORContext(request);
  if (isGuardError(guardResult)) {
    return guardErrorResponse(guardResult);
  }
  const { ctx } = guardResult;
  const { adminClient } = await createRouteClients();

  try {
    const body = await request.json() as CombiDataset;

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: 'Invalid format: expected { data: [...] }' },
        { status: 400 }
      );
    }

    // Log first item structure for debugging
    if (body.data.length > 0) {
      console.log('[IOR Import] First item keys:', Object.keys(body.data[0]));
      console.log('[IOR Import] First item sample:', JSON.stringify(body.data[0]).substring(0, 500));
    }
    console.log('[IOR Import] Total items:', body.data.length);

    // Group products by producer and extract combi tags
    const productsByProducer = new Map<string, CombiProduct[]>();
    const combiTagByProducer = new Map<string, string>();

    for (const item of body.data) {
      const producerName = item.producer?.value || 'Unknown Producer';
      if (!productsByProducer.has(producerName)) {
        productsByProducer.set(producerName, []);
      }
      productsByProducer.get(producerName)!.push(item);

      // Extract combi tag (use first non-empty value found for producer)
      const combiTag = item.Combi?.value || item.combi?.value;
      if (combiTag && !combiTagByProducer.has(producerName)) {
        combiTagByProducer.set(producerName, combiTag);
      }
    }

    const results = {
      producersCreated: 0,
      producersExisting: 0,
      productsCreated: 0,
      productsSkipped: 0,
      skipReasons: { noName: 0, duplicate: 0, dbError: 0 } as Record<string, number>,
      errors: [] as string[],
    };

    // Process each producer
    for (const [producerName, products] of productsByProducer) {
      const combiTag = combiTagByProducer.get(producerName) || null;
      // Extract country and region from first product of this producer
      const firstProduct = products[0];
      const producerCountry = firstProduct?.country?.value || 'France';
      const producerRegion = firstProduct?.region?.value || null;

      // Check if producer exists
      const { data: existingProducer } = await adminClient
        .from('ior_producers')
        .select('id, combi_tag')
        .eq('importer_id', ctx.importerId)
        .eq('name', producerName)
        .maybeSingle();

      let producerId: string;

      if (existingProducer) {
        producerId = existingProducer.id;
        results.producersExisting++;

        // Update combi_tag if we have one and producer doesn't
        if (combiTag && !existingProducer.combi_tag) {
          await adminClient
            .from('ior_producers')
            .update({ combi_tag: combiTag })
            .eq('id', producerId);
        }
      } else {
        // Create producer with country/region from data
        const { data: newProducer, error: producerError } = await adminClient
          .from('ior_producers')
          .insert({
            tenant_id: ctx.tenantId,
            importer_id: ctx.importerId,
            name: producerName,
            country: producerCountry,
            region: producerRegion,
            is_active: true,
            combi_tag: combiTag,
          })
          .select('id')
          .single();

        if (producerError || !newProducer) {
          results.errors.push(`Failed to create producer: ${producerName}`);
          continue;
        }

        producerId = newProducer.id;
        results.producersCreated++;
      }

      // Create products for this producer
      for (const product of products) {
        // Support multiple field name variants from Combi exports
        // Primary: wineName (plot.farm format), fallback: productName, product_name, name
        const productName = product.wineName?.value
          || product.productName?.value
          || (product as any).product_name?.value
          || (product as any)['Product Name']?.value
          || (product as any).name?.value;
        if (!productName) {
          if (results.skipReasons.noName === 0) {
            console.error('[IOR Import] First product skipped - no name found. Keys:', Object.keys(product));
          }
          results.productsSkipped++;
          results.skipReasons.noName++;
          continue;
        }

        // Parse vintage
        const vintageStr = product.vintage?.value;
        let vintage: number | null = null;
        if (vintageStr && vintageStr !== 'NV' && /^\d{4}$/.test(vintageStr)) {
          vintage = parseInt(vintageStr, 10);
        }

        // Parse volume: bottleSizeMl (plot.farm) > Volume > volume
        const volumeStr = product.bottleSizeMl?.value || product.Volume?.value || product.volume?.value || '750';
        const bottleSizeMl = parseInt(volumeStr, 10) || 750;

        // Map wine type: color (plot.farm) > type
        const typeStr = product.color?.value || product.type?.value || '';
        const wineType = WINE_TYPE_MAP[typeStr] || 'RED';

        // Parse grapes: grape (plot.farm) > grapes
        const grapesStr = product.grape?.value || product.grapes?.value || '';
        const grapeVarieties = grapesStr
          ? grapesStr.split(/[,;]/).map(g => g.trim()).filter(Boolean)
          : [];

        // Get appellation
        const appellation = product.Appellation?.value || product.appellation?.value || null;

        // Parse additional fields from plot.farm format
        const alcoholStr = product.alcoholPct?.value;
        const alcoholPct = alcoholStr ? parseFloat(alcoholStr) || null : null;
        const caseSizeStr = product.caseSize?.value;
        const caseSize = caseSizeStr ? parseInt(caseSizeStr, 10) || 6 : 6;
        const sku = product.sku?.value || null;
        const description = product.description?.value || null;

        // Check if product already exists (by name + vintage + producer)
        // Note: For NULL vintage (NV wines), we need .is() not .eq()
        let existingProductQuery = adminClient
          .from('ior_products')
          .select('id')
          .eq('producer_id', producerId)
          .eq('name', productName);

        if (vintage === null) {
          existingProductQuery = existingProductQuery.is('vintage', null);
        } else {
          existingProductQuery = existingProductQuery.eq('vintage', vintage);
        }

        const { data: existingProduct } = await existingProductQuery.maybeSingle();

        if (existingProduct) {
          results.productsSkipped++;
          results.skipReasons.duplicate++;
          continue;
        }

        // Create product
        const { data: newProduct, error: productError } = await adminClient
          .from('ior_products')
          .insert({
            tenant_id: ctx.tenantId,
            importer_id: ctx.importerId,
            producer_id: producerId,
            name: productName,
            vintage,
            wine_type: wineType,
            bottle_size_ml: bottleSizeMl,
            grape_varieties: grapeVarieties.length > 0 ? grapeVarieties : null,
            appellation,
            alcohol_pct: alcoholPct,
            case_size: caseSize,
            sku,
            tasting_notes: description,
            is_active: true,
          })
          .select('id')
          .single();

        if (productError || !newProduct) {
          console.error(`[IOR Import] Product insert failed: ${productName}`, productError?.message, productError?.code);
          results.errors.push(`Failed to create product: ${productName} (${productError?.message || 'unknown error'})`);
          results.productsSkipped++;
          results.skipReasons.dbError++;
        } else {
          results.productsCreated++;
        }
      }
    }

    console.log('[IOR Import] Results:', JSON.stringify(results));

    return NextResponse.json({
      success: true,
      results,
      summary: `Importerade ${results.productsCreated} produkter från ${results.producersCreated + results.producersExisting} producenter`,
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    );
  }
}
