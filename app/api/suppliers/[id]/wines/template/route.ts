/**
 * GET /api/suppliers/[id]/wines/template
 *
 * Download Excel/CSV template for wine catalog import.
 * REQUIRES: SELLER role + ownership of supplier (or ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateExcelTemplate, generateExampleCSV } from '@/lib/parsers/excel-parser';
import { actorService } from '@/lib/actor-service';

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx';

    if (format === 'csv') {
      const csvContent = generateExampleCSV();

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="wine-import-template.csv"',
        },
      });
    }

    // Default: Excel format
    const excelBuffer = generateExcelTemplate();

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="wine-import-template.xlsx"',
      },
    });

  } catch (error: any) {
    console.error('[Wine Template] Error:', error);
    return NextResponse.json(
      { error: `Kunde inte generera mall: ${error.message}` },
      { status: 500 }
    );
  }
}
