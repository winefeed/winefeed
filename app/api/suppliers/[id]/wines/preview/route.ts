/**
 * POST /api/suppliers/[id]/wines/preview
 *
 * Preview wine import for a supplier.
 * Parses file and validates rows without importing.
 * REQUIRES: SELLER role + ownership of supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { parseWineFile } from '@/lib/parsers/excel-parser';
import { isPdfFile, parsePdfFile } from '@/lib/parsers/pdf-parser';
import { validateWineRows } from '@/lib/validators/wine-import';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  try {
    const supplierId = params.id;

    // Auth check
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must be SELLER or ADMIN
    if (!actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    // If SELLER, verify they own this supplier
    if (actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      if (actor.supplier_id !== supplierId) {
        return NextResponse.json(
          { error: 'Not authorized for this supplier' },
          { status: 403 }
        );
      }
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Ingen fil uppladdad' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Filen är för stor. Max ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    // Check file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];

    const hasValidExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Filformatet stöds inte. Ladda upp Excel (.xlsx, .xls), CSV eller PDF.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse file (PDF uses async parser, Excel/CSV uses sync parser)
    const parseResult = isPdfFile(file.name)
      ? await parsePdfFile(buffer)
      : parseWineFile(buffer, file.name);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error || 'Kunde inte läsa filen' },
        { status: 400 }
      );
    }

    // Validate rows
    const preview = validateWineRows(parseResult.rows);

    // Format response to match IMPORT endpoint expectations
    // Import expects: reference, producer, name, vintage, country, type, volume, price, quantity, q_per_box
    const response = {
      success: true,
      valid: preview.validRows.map(row => ({
        // Required fields for import
        reference: row.data?.sku || `${row.data?.producer}-${row.data?.wine_name}`.slice(0, 50),
        producer: row.data?.producer,
        name: row.data?.wine_name, // import expects 'name' not 'wine_name'
        vintage: row.data?.vintage === 'NV' ? 0 : parseInt(row.data?.vintage || '0'), // import expects number, 0 = NV
        country: row.data?.country || 'Unknown',
        type: row.data?.color, // import expects 'type' not 'color'
        volume: row.data?.bottle_size_ml, // import expects 'volume' not 'bottle_size_ml'
        price: row.data?.price,
        quantity: row.data?.stock_qty ?? undefined, // stock — only if explicitly provided in CSV
        q_per_box: row.data?.case_size, // import expects 'q_per_box' not 'case_size'
        // Optional fields
        region: row.data?.region,
        grapes: row.data?.grape, // import expects 'grapes' not 'grape'
        alcohol: row.data?.alcohol_pct, // import expects 'alcohol' not 'alcohol_pct'
        labels: [
          row.data?.organic ? 'organic' : null,
          row.data?.biodynamic ? 'biodynamic' : null,
        ].filter(Boolean).join(', ') || undefined,
        description: row.data?.description,
        // Also include original fields for frontend display
        wine_name: row.data?.wine_name,
        color: row.data?.color,
        grape: row.data?.grape,
        moq: row.data?.moq,
        sku: row.data?.sku,
        bottle_size_ml: row.data?.bottle_size_ml,
        case_size: row.data?.case_size,
        organic: row.data?.organic,
        biodynamic: row.data?.biodynamic,
        packaging_type: row.data?.packaging_type,
        location: row.data?.location,
      })),
      invalid: preview.invalidRows.map(row => ({
        row: row.rowNumber,
        data: row.raw,
        errors: row.errors,
      })),
      totalRows: preview.totalRows,
      validCount: preview.validCount,
      invalidCount: preview.invalidCount,
      warnings: parseResult.warnings,
      headerMapping: parseResult.headerMapping,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Wine Preview] Error:', error);
    return NextResponse.json(
      { error: `Fel vid filhantering: ${error.message}` },
      { status: 500 }
    );
  }
}
