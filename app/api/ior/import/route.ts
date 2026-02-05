/**
 * IOR CATALOG IMPORT API
 *
 * POST /api/ior/import
 * Accepts Combi JSON format and creates producers + products
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map Combi wine types to our enum
const WINE_TYPE_MAP: Record<string, string> = {
  'Red': 'RED',
  'White': 'WHITE',
  'Rose': 'ROSE',
  'Rosé': 'ROSE',
  'Sparkling': 'SPARKLING',
  'Orange': 'ORANGE',
  'Dessert': 'DESSERT',
  'Fortified': 'FORTIFIED',
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

  try {
    const body = await request.json() as CombiDataset;

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: 'Invalid format: expected { data: [...] }' },
        { status: 400 }
      );
    }

    // Group products by producer
    const productsByProducer = new Map<string, CombiProduct[]>();

    for (const item of body.data) {
      const producerName = item.producer?.value || 'Unknown Producer';
      if (!productsByProducer.has(producerName)) {
        productsByProducer.set(producerName, []);
      }
      productsByProducer.get(producerName)!.push(item);
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
      // Check if producer exists
      const { data: existingProducer } = await supabase
        .from('ior_producers')
        .select('id')
        .eq('importer_id', ctx.importerId)
        .eq('name', producerName)
        .single();

      let producerId: string;

      if (existingProducer) {
        producerId = existingProducer.id;
        results.producersExisting++;
      } else {
        // Create producer
        const { data: newProducer, error: producerError } = await supabase
          .from('ior_producers')
          .insert({
            tenant_id: ctx.tenantId,
            importer_id: ctx.importerId,
            name: producerName,
            country: 'France', // Default, can be updated later
            is_active: true,
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
        const productName = product.productName?.value;
        if (!productName) {
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
        const { data: existingProduct } = await supabase
          .from('ior_products')
          .select('id')
          .eq('producer_id', producerId)
          .eq('name', productName)
          .eq('vintage', vintage)
          .single();

        if (existingProduct) {
          results.productsSkipped++;
          continue;
        }

        // Create product
        const { error: productError } = await supabase
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
          });

        if (productError) {
          results.errors.push(`Failed to create product: ${productName}`);
          results.productsSkipped++;
        } else {
          results.productsCreated++;
        }
      }
    }

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
