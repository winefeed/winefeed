/**
 * GET /api/admin/wines/template
 *
 * Download Excel template for wine catalog import.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateExcelTemplate, generateExampleCSV } from '@/lib/parsers/excel-parser';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
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
