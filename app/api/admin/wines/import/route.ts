/**
 * POST /api/admin/wines/import
 *
 * Import validated wines into supplier_wines table.
 * Called after preview has been reviewed and approved.
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ValidatedWine } from '@/lib/validators/wine-import';
import { actorService } from '@/lib/actor-service';

// Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface ImportRequest {
  supplierId: string;
  tenantId: string;
  wines: ValidatedWine[];
  filename?: string;
  importedBy?: string;
}

export interface ImportResponse {
  success: boolean;
  imported: number;
  skipped: number;
  updated: number;
  batchId?: string;
  errors: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResponse>> {
  try {
    // Auth check
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, updated: 0, errors: ['Missing authentication context'] },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, updated: 0, errors: ['Admin access required'] },
        { status: 403 }
      );
    }

    const body: ImportRequest = await request.json();
    const { supplierId, tenantId: bodyTenantId, wines, filename, importedBy } = body;

    // Validate inputs
    if (!supplierId) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, updated: 0, errors: ['Leverantörs-ID saknas'] },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, updated: 0, errors: ['Tenant-ID saknas'] },
        { status: 400 }
      );
    }

    if (!wines || wines.length === 0) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, updated: 0, errors: ['Inga viner att importera'] },
        { status: 400 }
      );
    }

    // Verify supplier exists
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, updated: 0, errors: ['Leverantör hittades inte'] },
        { status: 404 }
      );
    }

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from('wine_import_batches')
      .insert({
        tenant_id: tenantId,
        supplier_id: supplierId,
        filename: filename || 'unknown',
        imported_by: importedBy || null,
        total_rows: wines.length,
        valid_rows: wines.length,
        invalid_rows: 0,
        status: 'pending',
      })
      .select('id')
      .single();

    if (batchError) {
      console.error('[Wine Import] Failed to create batch:', batchError);
      // Continue without batch tracking
    }

    const batchId = batch?.id;

    // Import wines
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    let updated = 0;

    for (let i = 0; i < wines.length; i++) {
      const wine = wines[i];

      try {
        // Check if wine already exists (by SKU or name+producer+vintage)
        let existingWine = null;

        if (wine.sku) {
          const { data } = await supabase
            .from('supplier_wines')
            .select('id')
            .eq('supplier_id', supplierId)
            .eq('sku', wine.sku)
            .single();
          existingWine = data;
        }

        if (!existingWine) {
          const { data } = await supabase
            .from('supplier_wines')
            .select('id')
            .eq('supplier_id', supplierId)
            .eq('name', wine.wine_name)
            .eq('producer', wine.producer)
            .eq('vintage', wine.vintage === 'NV' ? null : parseInt(wine.vintage, 10))
            .single();
          existingWine = data;
        }

        // Prepare wine data for insert/update
        const wineData = {
          supplier_id: supplierId,
          name: wine.wine_name,
          producer: wine.producer,
          country: wine.country || wine.region.split(',')[0].trim(), // Fallback to first part of region
          region: wine.region,
          color: wine.color,
          vintage: wine.vintage === 'NV' ? null : parseInt(wine.vintage, 10),
          grape: wine.grape,
          price_ex_vat_sek: Math.round(wine.price * 100), // Convert to öre
          moq: wine.moq,
          case_size: wine.case_size,
          alcohol_pct: wine.alcohol_pct,
          bottle_size_ml: wine.bottle_size_ml,
          organic: wine.organic,
          biodynamic: wine.biodynamic,
          description: wine.description,
          sku: wine.sku,
          appellation: wine.appellation,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        if (existingWine) {
          // Update existing wine
          const { error: updateError } = await supabase
            .from('supplier_wines')
            .update(wineData)
            .eq('id', existingWine.id);

          if (updateError) {
            errors.push(`Rad ${i + 1}: Kunde inte uppdatera ${wine.wine_name}: ${updateError.message}`);
            skipped++;
          } else {
            updated++;
          }
        } else {
          // Insert new wine
          const { error: insertError } = await supabase
            .from('supplier_wines')
            .insert(wineData);

          if (insertError) {
            errors.push(`Rad ${i + 1}: Kunde inte importera ${wine.wine_name}: ${insertError.message}`);
            skipped++;
          } else {
            imported++;
          }
        }
      } catch (err: any) {
        errors.push(`Rad ${i + 1}: ${wine.wine_name}: ${err.message}`);
        skipped++;
      }
    }

    // Update batch record
    if (batchId) {
      await supabase
        .from('wine_import_batches')
        .update({
          status: errors.length === wines.length ? 'failed' : 'imported',
          imported_count: imported + updated,
          completed_at: new Date().toISOString(),
          validation_errors: errors.length > 0 ? errors : null,
        })
        .eq('id', batchId);
    }

    return NextResponse.json({
      success: skipped < wines.length,
      imported,
      updated,
      skipped,
      batchId,
      errors,
    });

  } catch (error: any) {
    console.error('[Wine Import] Error:', error);
    return NextResponse.json(
      {
        success: false,
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: [`Serverfel: ${error.message}`],
      },
      { status: 500 }
    );
  }
}
