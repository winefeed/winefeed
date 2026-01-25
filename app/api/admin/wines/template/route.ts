/**
 * GET /api/admin/wines/template
 *
 * Download Excel template for wine catalog import.
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateExcelTemplate, generateExampleCSV } from '@/lib/parsers/excel-parser';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
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

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
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
