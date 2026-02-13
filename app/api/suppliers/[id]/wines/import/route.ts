/**
 * SUPPLIER WINES IMPORT API
 *
 * POST /api/suppliers/[id]/wines/import
 *
 * Import wines from parsed CSV/Excel data
 *
 * REQUIRES: User must be SELLER and owner of the supplier
 *
 * REQUIRED FIELDS (as of 2026-01-21):
 * - reference (sku) - unique article number per supplier
 * - producer
 * - name (cuvée)
 * - vintage (0 for NV)
 * - country
 * - type (color: red, white, rose, sparkling, fortified, orange)
 * - volume (bottle_size_ml)
 * - price (price_ex_vat_sek in öre)
 * - quantity (stock_qty) - total bottles
 * - q_per_box (case_size) - bottles per case, for logistics
 *
 * OPTIONAL FIELDS:
 * - moq (min_order) - minimum order quantity in bottles (defaults to case_size)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';
import { checkActionGate, createGatedResponse } from '@/lib/feature-gates';
import { batchTranslateToSwedish } from '@/lib/ai/translate';

// Wine types that match the wine_color enum in database
const VALID_WINE_TYPES = ['red', 'white', 'rose', 'sparkling', 'fortified', 'orange'];

// Map common type names to our enum values
const WINE_TYPE_MAP: Record<string, string> = {
  'red': 'red',
  'röd': 'red',
  'rött': 'red',
  'rouge': 'red',
  'rosso': 'red',
  'tinto': 'red',
  'white': 'white',
  'vit': 'white',
  'vitt': 'white',
  'blanc': 'white',
  'bianco': 'white',
  'rose': 'rose',
  'rosé': 'rose',
  'rosa': 'rose',
  'rosado': 'rose',
  'sparkling': 'sparkling',
  'mousserande': 'sparkling',
  'bubbel': 'sparkling',
  'champagne': 'sparkling',
  'cremant': 'sparkling',
  'crémant': 'sparkling',
  'pet-nat': 'sparkling',
  'petnat': 'sparkling',
  'pet nat': 'sparkling',
  'fortified': 'fortified',
  'stärkt': 'fortified',
  'starkvin': 'fortified',
  'sherry': 'fortified',
  'port': 'fortified',
  'porto': 'fortified',
  'madeira': 'fortified',
  'marsala': 'fortified',
  'pastis': 'fortified',
  'vermouth': 'fortified',
  'vermut': 'fortified',
  'armagnac': 'fortified',
  'cognac': 'fortified',
  'grappa': 'fortified',
  'orange': 'orange',
};

interface WineImportRow {
  // Required fields
  reference?: string;        // sku / article_number
  producer?: string;
  name?: string;             // cuvée
  cuvee?: string;            // alternative name for name
  vintage?: number | string;
  country?: string;
  type?: string;             // wine type (red, white, etc.)
  volume?: number | string;  // bottle size in ml
  price?: number | string;   // list price
  quantity?: number | string; // stock quantity (total bottles)
  q_per_box?: number | string; // case_size (bottles per case)
  moq?: number | string;       // minimum order quantity (defaults to case_size)
  min_order?: number | string; // alternative name for moq

  // Optional fields
  region?: string;           // area/AOP
  grapes?: string;           // grape varieties
  alcohol?: number | string; // alcohol percentage
  labels?: string;           // certifications (organic, biodynamic, etc.)
  description?: string;
  location?: string;         // warehouse location (domestic, eu, non_eu)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params;

    // Auth check - verify user owns this supplier
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER and own this supplier (or ADMIN)
    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'SELLER') || actor.supplier_id !== supplierId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { wines, mode = 'merge' } = await request.json() as {
      wines: WineImportRow[];
      mode: 'merge' | 'replace';
    };

    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      return NextResponse.json(
        { error: 'No wines provided for import' },
        { status: 400 }
      );
    }

    // Use adminClient for DB operations — auth is already verified above
    const { adminClient } = await createRouteClients();

    // Validate supplier exists
    const { data: supplier } = await adminClient
      .from('suppliers')
      .select('id')
      .eq('id', supplierId)
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check subscription limit for adding wines
    const gateCheck = await checkActionGate(supplierId, 'add_wine');
    if (!gateCheck.allowed) {
      return createGatedResponse(gateCheck);
    }

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: { row: number; error: string }[] = [];

    // Translate descriptions to Swedish if needed (with 8s timeout to avoid function timeout)
    const descriptions = wines.map(w => w.description?.trim() || '');
    let translatedDescriptions: string[] = descriptions;
    try {
      const translationTimeout = new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('Translation timeout')), 8000)
      );
      translatedDescriptions = await Promise.race([
        batchTranslateToSwedish(descriptions),
        translationTimeout,
      ]);
    } catch (translationError: any) {
      console.warn('[Wine Import] Translation skipped:', translationError?.message || translationError);
    }

    // If replace mode, deactivate all existing wines first
    if (mode === 'replace') {
      await adminClient
        .from('supplier_wines')
        .update({ is_active: false })
        .eq('supplier_id', supplierId);
    }

    // Process each wine
    for (let i = 0; i < wines.length; i++) {
      const wine = wines[i];
      const rowErrors: string[] = [];

      // Extract and validate required fields
      const reference = wine.reference?.toString().trim();
      const producer = wine.producer?.toString().trim();
      const name = (wine.name || wine.cuvee)?.toString().trim();
      const country = wine.country?.toString().trim();
      const typeRaw = wine.type?.toString().trim().toLowerCase();
      const type = typeRaw ? WINE_TYPE_MAP[typeRaw] || typeRaw : undefined;

      // Parse vintage (0 = NV)
      let vintage: number | undefined;
      if (wine.vintage !== undefined && wine.vintage !== null && wine.vintage !== '') {
        const vintageStr = String(wine.vintage).trim().toUpperCase();
        // Handle NV variants
        if (['NV', 'N/V', 'N.V.', 'NON-VINTAGE', 'SA'].includes(vintageStr)) {
          vintage = 0;
        } else {
          const parsed = parseInt(vintageStr);
          if (!isNaN(parsed)) {
            if (parsed === 0 || (parsed >= 1900 && parsed <= 2100)) {
              vintage = parsed;
            } else {
              rowErrors.push('Årgång måste vara 0 (NV) eller mellan 1900-2100');
            }
          } else {
            rowErrors.push('Ogiltig årgång');
          }
        }
      } else {
        vintage = 0; // Default to NV if not provided
      }

      // Parse volume
      let volume: number | undefined;
      if (wine.volume !== undefined && wine.volume !== null && wine.volume !== '') {
        const parsed = parseInt(String(wine.volume).replace(/[^\d]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          volume = parsed;
        } else {
          rowErrors.push('Ogiltig volym');
        }
      }

      // Parse price (convert to öre if needed)
      let price: number | undefined;
      if (wine.price !== undefined && wine.price !== null && wine.price !== '') {
        const parsed = parseFloat(String(wine.price).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          // Assume price is in SEK, convert to öre
          price = Math.round(parsed * 100);
        } else {
          rowErrors.push('Ogiltigt pris');
        }
      }

      // Parse quantity
      let quantity: number | undefined;
      if (wine.quantity !== undefined && wine.quantity !== null && wine.quantity !== '') {
        const parsed = parseInt(String(wine.quantity));
        if (!isNaN(parsed) && parsed >= 0) {
          quantity = parsed;
        } else {
          rowErrors.push('Ogiltig kvantitet');
        }
      }

      // Parse case_size (Q/box)
      let caseSize: number | undefined;
      if (wine.q_per_box !== undefined && wine.q_per_box !== null && wine.q_per_box !== '') {
        const parsed = parseInt(String(wine.q_per_box));
        if (!isNaN(parsed) && parsed > 0 && parsed <= 24) {
          caseSize = parsed;
        } else {
          rowErrors.push('Q/box måste vara mellan 1-24');
        }
      }

      // Parse MOQ (minimum order quantity) - optional, defaults to case_size
      let moq: number | undefined;
      const moqInput = wine.moq ?? wine.min_order;
      if (moqInput !== undefined && moqInput !== null && moqInput !== '') {
        const parsed = parseInt(String(moqInput));
        if (!isNaN(parsed) && parsed > 0) {
          // Validate MOQ is reasonable (max 10x case_size or 100)
          const maxMoq = caseSize ? Math.max(caseSize * 10, 100) : 100;
          if (parsed > maxMoq) {
            rowErrors.push(`MOQ ${parsed} verkar orimligt hög (max ${maxMoq})`);
          } else {
            moq = parsed;
          }
        } else {
          rowErrors.push('Ogiltig MOQ (måste vara positivt heltal)');
        }
      }

      // Auto-generate reference if missing
      const effectiveReference = reference ||
        `${(producer || '').substring(0, 10)}-${(name || '').substring(0, 20)}-${vintage ?? 0}`
          .toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

      // Validate required fields
      if (!producer) rowErrors.push('Producer saknas');
      if (!name) rowErrors.push('Cuvée/namn saknas');
      if (vintage === undefined) rowErrors.push('Vintage saknas (använd 0 för NV)');
      if (!country) rowErrors.push('Country saknas');
      if (!type) rowErrors.push('Type saknas');
      if (type && !VALID_WINE_TYPES.includes(type)) {
        rowErrors.push(`Ogiltig type: ${type}. Giltiga: ${VALID_WINE_TYPES.join(', ')}`);
      }
      if (price === undefined) rowErrors.push('List price saknas');
      if (caseSize === undefined) rowErrors.push('Q/box saknas');

      // Skip row if validation errors
      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, error: rowErrors.join('; ') });
        errorCount++;
        continue;
      }

      // Parse optional fields
      const alcohol = wine.alcohol ? parseFloat(String(wine.alcohol).replace(',', '.')) : null;
      const organic = wine.labels?.toLowerCase().includes('organic') ||
                      wine.labels?.toLowerCase().includes('ekologisk') || false;
      const biodynamic = wine.labels?.toLowerCase().includes('biodynamic') ||
                         wine.labels?.toLowerCase().includes('biodynamisk') || false;

      // Prepare wine data (using correct column names from schema)
      const wineData = {
        supplier_id: supplierId,
        sku: effectiveReference,
        name: name!,
        producer: producer!,
        vintage: vintage!,
        country: country!,
        color: type as 'red' | 'white' | 'rose' | 'sparkling' | 'fortified' | 'orange',
        bottle_size_ml: volume ?? 750,
        price_ex_vat_sek: price!,
        stock_qty: quantity ?? 0,
        case_size: caseSize!,
        moq: moq ?? caseSize!, // Use explicit MOQ or default to case_size
        region: wine.region?.trim() || null,
        grape: wine.grapes?.trim() || null,
        alcohol_pct: alcohol,
        organic,
        biodynamic,
        description: translatedDescriptions[i] || wine.description?.trim() || null,
        is_active: true,
        location: (wine.location as 'domestic' | 'eu' | 'non_eu') || 'domestic',
      };

      // Check for existing wine by sku (reference)
      const { data: existingWine } = await adminClient
        .from('supplier_wines')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('sku', effectiveReference)
        .single();

      // Insert or update
      if (existingWine) {
        const { error } = await adminClient
          .from('supplier_wines')
          .update(wineData)
          .eq('id', existingWine.id);

        if (error) {
          console.error(`[Wine Import] Update failed row ${i + 1}:`, error.message, error.code);
          errors.push({ row: i + 1, error: error.message });
          errorCount++;
        } else {
          updatedCount++;
        }
      } else {
        const { error } = await adminClient
          .from('supplier_wines')
          .insert(wineData);

        if (error) {
          console.error(`[Wine Import] Insert failed row ${i + 1}:`, error.message, error.code);
          errors.push({ row: i + 1, error: error.message });
          errorCount++;
        } else {
          importedCount++;
        }
      }
    }

    console.log(`[Wine Import] Done for ${supplierId}: ${importedCount} imported, ${updatedCount} updated, ${errorCount} errors out of ${wines.length} total`);
    if (errors.length > 0) {
      console.log('[Wine Import] First errors:', JSON.stringify(errors.slice(0, 3)));
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: wines.length,
        imported: importedCount,
        updated: updatedCount,
        errors: errorCount,
      },
      errors: errors.slice(0, 10), // Return first 10 errors
    });

  } catch (error: any) {
    console.error('Error in wines import:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
