/**
 * Excel/CSV Parser for Wine Import
 *
 * Parses Excel (.xlsx, .xls) and CSV files into standardized wine data.
 * Uses SheetJS (xlsx) library for Excel parsing.
 * Handles multiple character encodings (UTF-8, Windows-1252, ISO-8859-1).
 */

import * as XLSX from 'xlsx';
import { RawWineRow, normalizeColumnHeaders } from '../validators/wine-import';

// ============================================================================
// Encoding Detection & Conversion
// ============================================================================

/**
 * Detect if buffer has UTF-8 BOM (Byte Order Mark)
 */
function hasUTF8BOM(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

/**
 * Detect if buffer appears to be valid UTF-8
 */
function isValidUTF8(buffer: Buffer): boolean {
  try {
    const text = buffer.toString('utf8');
    // Check for common garbled patterns that indicate wrong encoding
    // "Ã©" is é in UTF-8 misread as Latin-1
    // "Ã¨" is è in UTF-8 misread as Latin-1
    // "Ã¶" is ö in UTF-8 misread as Latin-1
    if (text.includes('Ã©') || text.includes('Ã¨') || text.includes('Ã¶') ||
        text.includes('Ã¤') || text.includes('Ã¥') || text.includes('Ã') ||
        text.includes('â€')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert buffer from Windows-1252/ISO-8859-1 to UTF-8
 */
function convertToUTF8(buffer: Buffer): string {
  // Windows-1252 (CP1252) to UTF-8 conversion map for characters 0x80-0x9F
  const cp1252Map: Record<number, string> = {
    0x80: '\u20AC', // €
    0x82: '\u201A', // ‚
    0x83: '\u0192', // ƒ
    0x84: '\u201E', // „
    0x85: '\u2026', // …
    0x86: '\u2020', // †
    0x87: '\u2021', // ‡
    0x88: '\u02C6', // ˆ
    0x89: '\u2030', // ‰
    0x8A: '\u0160', // Š
    0x8B: '\u2039', // ‹
    0x8C: '\u0152', // Œ
    0x8E: '\u017D', // Ž
    0x91: '\u2018', // '
    0x92: '\u2019', // '
    0x93: '\u201C', // "
    0x94: '\u201D', // "
    0x95: '\u2022', // •
    0x96: '\u2013', // –
    0x97: '\u2014', // —
    0x98: '\u02DC', // ˜
    0x99: '\u2122', // ™
    0x9A: '\u0161', // š
    0x9B: '\u203A', // ›
    0x9C: '\u0153', // œ
    0x9E: '\u017E', // ž
    0x9F: '\u0178', // Ÿ
  };

  let result = '';
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte < 0x80) {
      // ASCII character
      result += String.fromCharCode(byte);
    } else if (byte >= 0x80 && byte <= 0x9F && cp1252Map[byte]) {
      // Windows-1252 specific characters
      result += cp1252Map[byte];
    } else {
      // ISO-8859-1 / Latin-1 character (0xA0-0xFF maps directly to Unicode)
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

/**
 * Detect encoding and convert CSV buffer to properly encoded string
 */
function decodeCSVBuffer(buffer: Buffer): string {
  // Check for UTF-8 BOM
  if (hasUTF8BOM(buffer)) {
    return buffer.slice(3).toString('utf8');
  }

  // Try UTF-8 first
  const utf8Text = buffer.toString('utf8');

  // Check if UTF-8 decoding looks correct
  if (isValidUTF8(buffer)) {
    return utf8Text;
  }

  // Fall back to Windows-1252/Latin-1 conversion
  console.log('[Excel Parser] Detected non-UTF-8 encoding, converting from Windows-1252/Latin-1');
  return convertToUTF8(buffer);
}

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

    let workbook: XLSX.WorkBook;

    if (isCSV) {
      // For CSV files, handle encoding properly
      const csvText = decodeCSVBuffer(buffer);
      workbook = XLSX.read(csvText, {
        type: 'string',
        raw: false,
      });
    } else {
      // For Excel files, XLSX handles encoding internally
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false,
        codepage: 65001, // UTF-8
      });
    }

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
 * Get sample rows from a file buffer (for AI column mapping context).
 * Returns up to 3 rows of raw data as key-value objects.
 */
export function getSampleRows(buffer: Buffer, filename: string, count: number = 3): Record<string, any>[] {
  try {
    const isCSV = filename.toLowerCase().endsWith('.csv');
    let workbook: XLSX.WorkBook;

    if (isCSV) {
      const csvText = decodeCSVBuffer(buffer);
      workbook = XLSX.read(csvText, { type: 'string', raw: false });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });

    return rawData.slice(0, count);
  } catch {
    return [];
  }
}

/**
 * Parse CSV string directly (assumes string is already properly decoded)
 */
export function parseCSVString(csvContent: string): ParseResult {
  const warnings: string[] = [];

  try {
    // Check for garbled encoding patterns and warn
    if (csvContent.includes('Ã©') || csvContent.includes('Ã¨') || csvContent.includes('Ã¶')) {
      warnings.push('Texten verkar ha kodningsproblem. Kontrollera att filen är sparad som UTF-8.');
    }

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
