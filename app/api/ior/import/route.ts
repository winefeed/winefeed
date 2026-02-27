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

interface CombiProduct {
  productName?: { value: string };
  producer?: { value: string };
  vintage?: { value: string };
  type?: { value: string };
  grapes?: { value: string };
  Appellation?: { value: string };
  appellation?: { value: string };
  description?: { value: string };
  Volume?: { value: string };
  volume?: { value: string };
  price?: { value: string };
  Combi?: { value: string };
  combi?: { value: string };
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
      errors: [] as string[],
    };

    // Process each producer
    for (const [producerName, products] of productsByProducer) {
      const combiTag = combiTagByProducer.get(producerName) || null;

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
        // Create producer with combi_tag
        const { data: newProducer, error: producerError } = await adminClient
          .from('ior_producers')
          .insert({
            tenant_id: ctx.tenantId,
            importer_id: ctx.importerId,
            name: producerName,
            country: 'France', // Default, can be updated later
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
        const productName = product.productName?.value
          || (product as any).product_name?.value
          || (product as any)['Product Name']?.value
          || (product as any).name?.value
          || (product as any).productName  // flat string
          || (product as any).product_name // flat string
          || (product as any).name;        // flat string
        if (!productName || (typeof productName === 'object')) {
          // Log first skipped product to help debug field name issues
          if (results.productsSkipped === 0) {
            console.error('[IOR Import] First product skipped - no productName found. Keys:', Object.keys(product));
          }
          results.productsSkipped++;
          continue;
        }

        // Parse vintage
        const vintageStr = product.vintage?.value;
        let vintage: number | null = null;
        if (vintageStr && vintageStr !== 'NV' && /^\d{4}$/.test(vintageStr)) {
          vintage = parseInt(vintageStr, 10);
        }

        // Parse volume
        const volumeStr = product.Volume?.value || product.volume?.value || '750';
        const bottleSizeMl = parseInt(volumeStr, 10) || 750;

        // Map wine type
        const typeStr = product.type?.value || '';
        const wineType = WINE_TYPE_MAP[typeStr] || 'RED';

        // Parse grapes
        const grapesStr = product.grapes?.value || '';
        const grapeVarieties = grapesStr
          ? grapesStr.split(/[,;]/).map(g => g.trim()).filter(Boolean)
          : [];

        // Get appellation
        const appellation = product.Appellation?.value || product.appellation?.value || null;

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
            is_active: true,
          })
          .select('id')
          .single();

        if (productError || !newProduct) {
          console.error(`[IOR Import] Product insert failed: ${productName}`, productError?.message, productError?.code);
          results.errors.push(`Failed to create product: ${productName} (${productError?.message || 'unknown error'})`);
          results.productsSkipped++;
        } else {
          results.productsCreated++;
        }
      }
    }

    console.log('[IOR Import] Results:', JSON.stringify(results));

    return NextResponse.json({
      success: true,
      results,
      summary: `Imported ${results.productsCreated} products across ${results.producersCreated + results.producersExisting} producers`,
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    );
  }
}
