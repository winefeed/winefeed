/**
 * POST /api/suppliers/:id/imports
 *
 * Upload CSV price list and create import
 *
 * REQUIRES: User must be SELLER and owner of the supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { actorService } from '@/lib/actor-service';

/**
 * Decode CSV buffer handling multiple encodings (UTF-8, Windows-1252, ISO-8859-1)
 */
function decodeCSVBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Check for UTF-8 BOM
  const hasUTF8BOM = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (hasUTF8BOM) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }

  // Try UTF-8 first
  const utf8Text = new TextDecoder('utf-8').decode(bytes);

  // Check for garbled patterns indicating wrong encoding
  if (utf8Text.includes('Ã©') || utf8Text.includes('Ã¨') || utf8Text.includes('Ã¶') ||
      utf8Text.includes('Ã¤') || utf8Text.includes('Ã¥') || utf8Text.includes('Ã') ||
      utf8Text.includes('â€')) {
    // Fall back to Windows-1252/Latin-1
    console.log('[CSV Import] Detected non-UTF-8 encoding, converting from Windows-1252');
    return new TextDecoder('windows-1252').decode(bytes);
  }

  return utf8Text;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to generate content hash
function generateLineHash(line: any): string {
  const parts = [
    line.supplier_sku || '',
    line.producer_name || '',
    line.product_name || '',
    line.vintage || 'NV',
    line.volume_ml || '',
    line.pack_type || ''
  ];
  // Simple hash (in production, use crypto.createHash('md5'))
  return Buffer.from(parts.join('|')).toString('base64');
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: supplierId } = params;

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

    // Parse multipart form or JSON
    const contentType = request.headers.get('content-type') || '';
    let csvText: string;
    let filename: string = 'upload.csv';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      filename = file.name;
      // Use proper encoding detection instead of file.text()
      const buffer = await file.arrayBuffer();
      csvText = decodeCSVBuffer(buffer);
    } else {
      const body = await request.json();
      csvText = body.csvText;
      filename = body.filename || 'upload.csv';
    }

    // STEP 1: Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('supplier_imports')
      .insert({
        supplier_id: supplierId,
        filename,
        status: 'UPLOADED'
      })
      .select()
      .single();

    if (importError || !importRecord) {
      console.error('Failed to create import:', importError);
      return NextResponse.json(
        { error: 'Failed to create import', details: importError },
        { status: 500 }
      );
    }

    const importId = importRecord.id;

    // STEP 2: Parse CSV
    let records: any[];
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (parseError) {
      await supabase
        .from('supplier_imports')
        .update({ status: 'FAILED' })
        .eq('id', importId);

      return NextResponse.json(
        { error: 'Failed to parse CSV', details: parseError },
        { status: 400 }
      );
    }

    // STEP 3: Insert lines
    const lines = records.map((row, index) => {
      const vintage = row.vintage ? parseInt(row.vintage, 10) : null;
      const volumeMl = parseInt(row.volume_ml, 10);
      const unitsPerCase = row.units_per_case ? parseInt(row.units_per_case, 10) : null;
      const abvPercent = row.abv_percent ? parseFloat(row.abv_percent) : null;
      const priceExVatSek = parseFloat(row.price_net || row.price_ex_vat_sek);

      const contentHash = generateLineHash(row);

      return {
        import_id: importId,
        line_number: index + 1,
        raw_data: row,
        supplier_sku: row.supplier_sku,
        gtin_each: row.gtin_each || null,
        gtin_case: row.gtin_case || null,
        producer_name: row.producer_name,
        product_name: row.product_name,
        vintage,
        volume_ml: volumeMl,
        abv_percent: abvPercent,
        pack_type: row.pack_type,
        units_per_case: unitsPerCase,
        country_of_origin: row.country_of_origin || null,
        region: row.region || null,
        grape_variety: row.grape_variety || null,
        price_ex_vat_sek: priceExVatSek,
        currency: row.currency || 'SEK',
        content_hash: contentHash,
        match_status: 'PENDING'
      };
    });

    const { error: linesError } = await supabase
      .from('supplier_import_lines')
      .insert(lines);

    if (linesError) {
      console.error('Failed to insert lines:', linesError);
      await supabase
        .from('supplier_imports')
        .update({ status: 'FAILED' })
        .eq('id', importId);

      return NextResponse.json(
        { error: 'Failed to insert lines', details: linesError },
        { status: 500 }
      );
    }

    // STEP 4: Update import status
    await supabase
      .from('supplier_imports')
      .update({
        status: 'PARSED',
        total_lines: records.length
      })
      .eq('id', importId);

    return NextResponse.json({
      importId,
      supplierId,
      filename,
      totalLines: records.length,
      status: 'PARSED'
    });

  } catch (error) {
    console.error('Import upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
