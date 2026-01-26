/**
 * Excel/CSV Parser for Wine Import
 *
 * Parses Excel (.xlsx, .xls) and CSV files into standardized wine data.
 * Uses SheetJS (xlsx) library for Excel parsing.
 */

import * as XLSX from 'xlsx';
import { RawWineRow, normalizeColumnHeaders } from '../validators/wine-import';

// ============================================================================
// Types
// ============================================================================

export interface ParseResult {
  success: boolean;
  rows: RawWineRow[];
  headers: string[];
  headerMapping: Record<string, string>;
  error?: string;
  warnings: string[];
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse Excel or CSV file buffer into wine rows
 */
export function parseWineFile(buffer: Buffer, filename: string): ParseResult {
  const warnings: string[] = [];

  try {
    // Determine file type
    const isCSV = filename.toLowerCase().endsWith('.csv');

    // Parse workbook
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        rows: [],
        headers: [],
        headerMapping: {},
        error: 'Filen innehåller inga ark/sheets',
        warnings,
      };
    }

    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with headers
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: '',
      raw: false, // Convert all values to strings for consistent handling
    });

    if (rawData.length === 0) {
      return {
        success: false,
        rows: [],
        headers: [],
        headerMapping: {},
        error: 'Filen innehåller inga datarader',
        warnings,
      };
    }

    // Get headers from first row's keys
    const headers = Object.keys(rawData[0]);

    // Map headers to standard field names
    const headerMapping = normalizeColumnHeaders(headers);

    // Check for required headers
    const requiredFields = ['wine_name', 'producer', 'region', 'color', 'vintage', 'grape', 'price', 'moq'];
    const mappedFields = Object.values(headerMapping);
    const missingFields = requiredFields.filter(f => !mappedFields.includes(f));

    if (missingFields.length > 0) {
      warnings.push(`Kolumner kunde inte mappas: ${missingFields.join(', ')}. Kontrollera kolumnnamnen.`);
    }

    // Transform rows using header mapping
    const rows: RawWineRow[] = rawData.map(row => {
      const transformed: RawWineRow = {};

      for (const [originalHeader, value] of Object.entries(row)) {
        const mappedField = headerMapping[originalHeader];
        if (mappedField) {
          (transformed as any)[mappedField] = value;
        }
      }

      return transformed;
    });

    return {
      success: true,
      rows,
      headers,
      headerMapping,
      warnings,
    };
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      headers: [],
      headerMapping: {},
      error: `Kunde inte läsa filen: ${error.message}`,
      warnings,
    };
  }
}

/**
 * Parse CSV string directly
 */
export function parseCSVString(csvContent: string): ParseResult {
  const warnings: string[] = [];

  try {
    // Parse CSV using SheetJS
    const workbook = XLSX.read(csvContent, {
      type: 'string',
      raw: false,
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: '',
      raw: false,
    });

    if (rawData.length === 0) {
      return {
        success: false,
        rows: [],
        headers: [],
        headerMapping: {},
        error: 'CSV innehåller inga datarader',
        warnings,
      };
    }

    const headers = Object.keys(rawData[0]);
    const headerMapping = normalizeColumnHeaders(headers);

    const rows: RawWineRow[] = rawData.map(row => {
      const transformed: RawWineRow = {};

      for (const [originalHeader, value] of Object.entries(row)) {
        const mappedField = headerMapping[originalHeader];
        if (mappedField) {
          (transformed as any)[mappedField] = value;
        }
      }

      return transformed;
    });

    return {
      success: true,
      rows,
      headers,
      headerMapping,
      warnings,
    };
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      headers: [],
      headerMapping: {},
      error: `Kunde inte läsa CSV: ${error.message}`,
      warnings,
    };
  }
}

/**
 * Generate example CSV content for download
 */
export function generateExampleCSV(): string {
  const headers = [
    'wine_name',
    'producer',
    'region',
    'color',
    'vintage',
    'grape',
    'price',
    'moq',
    'alcohol_pct',
    'bottle_size_ml',
    'organic',
    'description',
    'sku',
    'case_size',
    'appellation',
    'country',
    'packaging_type',
  ];

  const exampleRows = [
    [
      'Château La Yotte',
      'Château La Yotte',
      'Bordeaux',
      'red',
      '2022',
      'Merlot, Cabernet Sauvignon',
      '89',
      '36',
      '13.5',
      '750',
      'false',
      'Elegant bordeaux med mogna tanniner',
      'CLY-2022-750',
      '6',
      'Côtes de Bordeaux',
      'France',
      'bottle',
    ],
    [
      'Krug Grande Cuvée',
      'Krug',
      'Champagne',
      'sparkling',
      'NV',
      'Pinot Noir, Chardonnay, Pinot Meunier',
      '2400',
      '6',
      '12',
      '750',
      'false',
      'Prestigechampagne med djup och komplexitet',
      'KRUG-GC-NV',
      '6',
      'Champagne',
      'France',
      'bottle',
    ],
    [
      'House Red Draft',
      'Banjo Vino',
      'Languedoc',
      'red',
      'NV',
      'Grenache, Syrah',
      '850',
      '1',
      '13',
      '20000',
      'false',
      'Fruktigt rödvin på fat',
      'BV-DRAFT-20L',
      '1',
      '',
      'France',
      'keg',
    ],
  ];

  const csvRows = [
    headers.join(','),
    ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ];

  return csvRows.join('\n');
}

/**
 * Generate Excel template buffer
 */
export function generateExcelTemplate(): Buffer {
  const headers = [
    'wine_name',
    'producer',
    'region',
    'color',
    'vintage',
    'grape',
    'price',
    'moq',
    'alcohol_pct',
    'bottle_size_ml',
    'organic',
    'description',
    'sku',
    'case_size',
    'appellation',
    'country',
    'packaging_type',
  ];

  const exampleData = [
    {
      wine_name: 'Château La Yotte',
      producer: 'Château La Yotte',
      region: 'Bordeaux',
      color: 'red',
      vintage: '2022',
      grape: 'Merlot, Cabernet Sauvignon',
      price: 89,
      moq: 36,
      alcohol_pct: 13.5,
      bottle_size_ml: 750,
      organic: 'false',
      description: 'Elegant bordeaux med mogna tanniner',
      sku: 'CLY-2022-750',
      case_size: 6,
      appellation: 'Côtes de Bordeaux',
      country: 'France',
      packaging_type: 'bottle',
    },
    {
      wine_name: 'Krug Grande Cuvée',
      producer: 'Krug',
      region: 'Champagne',
      color: 'sparkling',
      vintage: 'NV',
      grape: 'Pinot Noir, Chardonnay, Pinot Meunier',
      price: 2400,
      moq: 6,
      alcohol_pct: 12,
      bottle_size_ml: 750,
      organic: 'false',
      description: 'Prestigechampagne med djup och komplexitet',
      sku: 'KRUG-GC-NV',
      case_size: 6,
      appellation: 'Champagne',
      country: 'France',
      packaging_type: 'bottle',
    },
    {
      wine_name: 'House Red Draft',
      producer: 'Banjo Vino',
      region: 'Languedoc',
      color: 'red',
      vintage: 'NV',
      grape: 'Grenache, Syrah',
      price: 850,
      moq: 1,
      alcohol_pct: 13,
      bottle_size_ml: 20000,
      organic: 'false',
      description: 'Fruktigt rödvin på fat',
      sku: 'BV-DRAFT-20L',
      case_size: 1,
      appellation: '',
      country: 'France',
      packaging_type: 'keg',
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exampleData, { header: headers });

  // Set column widths
  worksheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length, 15) }));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Wines');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
