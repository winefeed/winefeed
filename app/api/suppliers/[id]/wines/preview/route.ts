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
import { validateWineRows } from '@/lib/validators/wine-import';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];

    const hasValidExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Filformatet stöds inte. Ladda upp Excel (.xlsx, .xls) eller CSV.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse file
    const parseResult = parseWineFile(buffer, file.name);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error || 'Kunde inte läsa filen' },
        { status: 400 }
      );
    }

    // Validate rows
    const preview = validateWineRows(parseResult.rows);

    // Format response to match frontend expectations
    const response = {
      success: true,
      valid: preview.validRows.map(row => ({
        wine_name: row.data?.wine_name,
        producer: row.data?.producer,
        vintage: row.data?.vintage,
        region: row.data?.region,
        country: row.data?.country,
        grape: row.data?.grape,
        color: row.data?.color,
        price: row.data?.price,
        stock: row.data?.moq, // MOQ as initial stock
        moq: row.data?.moq,
        bottle_size_ml: row.data?.bottle_size_ml,
        case_size: row.data?.case_size,
        alcohol_pct: row.data?.alcohol_pct,
        organic: row.data?.organic,
        biodynamic: row.data?.biodynamic,
        description: row.data?.description,
        sku: row.data?.sku,
        packaging_type: row.data?.packaging_type,
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
