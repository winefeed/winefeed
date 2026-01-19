/**
 * POST /api/admin/wines/preview
 *
 * Upload and preview wine catalog file (Excel/CSV) before import.
 * Returns validated rows with errors for review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseWineFile } from '@/lib/parsers/excel-parser';
import { validateWineRows, ImportPreview } from '@/lib/validators/wine-import';

// Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface PreviewResponse {
  success: boolean;
  preview?: ImportPreview;
  supplierName?: string;
  headerMapping?: Record<string, string>;
  warnings?: string[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PreviewResponse>> {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const supplierId = formData.get('supplierId') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Ingen fil uppladdad' },
        { status: 400 }
      );
    }

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'Leverantörs-ID saknas' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/csv',
    ];

    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidExtension = ['xlsx', 'xls', 'csv'].includes(fileExtension || '');

    if (!isValidExtension) {
      return NextResponse.json(
        { success: false, error: 'Ogiltig filtyp. Tillåtna: .xlsx, .xls, .csv' },
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
        { success: false, error: 'Leverantör hittades inte' },
        { status: 404 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Check file size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Filen är för stor. Max 10 MB.' },
        { status: 400 }
      );
    }

    // Parse file
    const parseResult = parseWineFile(buffer, file.name);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    // Validate rows
    const preview = validateWineRows(parseResult.rows);

    return NextResponse.json({
      success: true,
      preview,
      supplierName: supplier.name,
      headerMapping: parseResult.headerMapping,
      warnings: parseResult.warnings,
    });

  } catch (error: any) {
    console.error('[Wine Preview] Error:', error);
    return NextResponse.json(
      { success: false, error: `Serverfel: ${error.message}` },
      { status: 500 }
    );
  }
}
