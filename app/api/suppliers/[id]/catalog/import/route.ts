import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface CatalogRow {
  name: string;
  producer: string;
  country: string;
  region?: string;
  vintage?: number;
  grape?: string;
  priceExVatSek: number;  // In SEK (will be converted to öre)
  vatRate?: number;
  stockQty?: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  deliveryAreas?: string;  // Comma-separated
}

/**
 * POST /api/suppliers/[id]/catalog/import
 *
 * Imports wine catalog from CSV for a specific supplier.
 * Authenticated endpoint - requires supplier user auth.
 *
 * Expected CSV format:
 * name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas
 * "Château Margaux 2015","Château Margaux","France","Bordeaux",2015,"Cabernet Sauvignon",450.00,25.00,24,6,7,"Stockholm,Göteborg"
 *
 * Request body:
 * {
 *   csvData: string;  // CSV file content as string
 *   replaceExisting?: boolean;  // If true, deactivates existing catalog first
 * }
 *
 * Response:
 * {
 *   imported: number;
 *   updated: number;
 *   failed: number;
 *   errors: Array<{ row: number; error: string }>;
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const body = await req.json();

    if (!body.csvData || typeof body.csvData !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid csvData field' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify supplier exists and is active
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, type, is_active')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    if (!supplier.is_active) {
      return NextResponse.json(
        { error: 'Supplier is not active' },
        { status: 403 }
      );
    }

    // Parse CSV
    const rows = parseCSV(body.csvData);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV is empty or invalid' },
        { status: 400 }
      );
    }

    // Validate and transform data
    const validatedRows: CatalogRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and we're 0-indexed

      try {
        const validated = validateCatalogRow(row, rowNumber);
        validatedRows.push(validated);
      } catch (error: any) {
        errors.push({ row: rowNumber, error: error.message });
      }
    }

    // If replaceExisting, deactivate all current wines
    if (body.replaceExisting === true) {
      await supabase
        .from('supplier_wines')
        .update({ is_active: false })
        .eq('supplier_id', supplierId);
    }

    // Insert/update wines
    let imported = 0;
    let updated = 0;

    for (const row of validatedRows) {
      try {
        // Check if wine already exists (by name + producer + vintage)
        const { data: existing } = await supabase
          .from('supplier_wines')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('name', row.name)
          .eq('producer', row.producer)
          .eq('vintage', row.vintage || null)
          .maybeSingle();

        const wineData = {
          supplier_id: supplierId,
          name: row.name,
          producer: row.producer,
          country: row.country,
          region: row.region || null,
          vintage: row.vintage || null,
          grape: row.grape || null,
          price_ex_vat_sek: Math.round(row.priceExVatSek * 100), // Convert SEK to öre
          vat_rate: row.vatRate || 25.00,
          stock_qty: row.stockQty || null,
          min_order_qty: row.minOrderQty || 6,
          lead_time_days: row.leadTimeDays || 3,
          delivery_areas: row.deliveryAreas
            ? row.deliveryAreas.split(',').map(s => s.trim())
            : null,
          is_active: true,
        };

        if (existing) {
          // Update existing wine
          const { error } = await supabase
            .from('supplier_wines')
            .update(wineData)
            .eq('id', existing.id);

          if (error) throw error;
          updated++;
        } else {
          // Insert new wine
          const { error } = await supabase
            .from('supplier_wines')
            .insert(wineData);

          if (error) throw error;
          imported++;
        }
      } catch (error: any) {
        errors.push({
          row: validatedRows.indexOf(row) + 2,
          error: `Database error: ${error.message}`,
        });
      }
    }

    return NextResponse.json(
      {
        imported,
        updated,
        failed: errors.length,
        errors: errors.slice(0, 100), // Limit error list to first 100
        totalRows: rows.length,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV string into array of objects
 */
function parseCSV(csvData: string): Array<Record<string, string>> {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  // Parse rows
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length !== header.length) {
      console.warn(`Row ${i + 1}: Column count mismatch`);
      continue;
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j];
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Validate and transform a catalog row
 */
function validateCatalogRow(row: Record<string, string>, rowNumber: number): CatalogRow {
  // Required fields
  if (!row.name) throw new Error(`Row ${rowNumber}: Missing 'name'`);
  if (!row.producer) throw new Error(`Row ${rowNumber}: Missing 'producer'`);
  if (!row.country) throw new Error(`Row ${rowNumber}: Missing 'country'`);
  if (!row.priceExVatSek) throw new Error(`Row ${rowNumber}: Missing 'priceExVatSek'`);

  // Parse and validate price
  const price = parseFloat(row.priceExVatSek);
  if (isNaN(price) || price <= 0) {
    throw new Error(`Row ${rowNumber}: Invalid price '${row.priceExVatSek}'`);
  }

  // Parse optional numeric fields
  const vintage = row.vintage ? parseInt(row.vintage) : undefined;
  if (vintage !== undefined && (isNaN(vintage) || vintage < 1900 || vintage > new Date().getFullYear())) {
    throw new Error(`Row ${rowNumber}: Invalid vintage '${row.vintage}'`);
  }

  const vatRate = row.vatRate ? parseFloat(row.vatRate) : 25.00;
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
    throw new Error(`Row ${rowNumber}: Invalid VAT rate '${row.vatRate}'`);
  }

  const stockQty = row.stockQty ? parseInt(row.stockQty) : undefined;
  if (stockQty !== undefined && (isNaN(stockQty) || stockQty < 0)) {
    throw new Error(`Row ${rowNumber}: Invalid stock quantity '${row.stockQty}'`);
  }

  const minOrderQty = row.minOrderQty ? parseInt(row.minOrderQty) : 6;
  if (isNaN(minOrderQty) || minOrderQty <= 0) {
    throw new Error(`Row ${rowNumber}: Invalid minimum order quantity '${row.minOrderQty}'`);
  }

  const leadTimeDays = row.leadTimeDays ? parseInt(row.leadTimeDays) : 3;
  if (isNaN(leadTimeDays) || leadTimeDays < 0) {
    throw new Error(`Row ${rowNumber}: Invalid lead time '${row.leadTimeDays}'`);
  }

  return {
    name: row.name.trim(),
    producer: row.producer.trim(),
    country: row.country.trim(),
    region: row.region?.trim(),
    vintage,
    grape: row.grape?.trim(),
    priceExVatSek: price,
    vatRate,
    stockQty,
    minOrderQty,
    leadTimeDays,
    deliveryAreas: row.deliveryAreas?.trim(),
  };
}
