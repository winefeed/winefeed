/**
 * PDF Parser for Wine Import
 *
 * Extracts wine data from PDF price lists using:
 * 1. Text extraction via pdf-parse
 * 2. Table detection (header row + column separators)
 * 3. AI fallback via OpenRouter for unstructured PDFs
 *
 * Returns the same ParseResult shape as excel-parser.
 */

// Import pdf-parse core directly (skip index.js which tries to load a test PDF)
const pdf: (buffer: Buffer) => Promise<{ text: string; numpages: number; info: any }> = require('pdf-parse/lib/pdf-parse'); // eslint-disable-line

import { RawWineRow, normalizeColumnHeaders } from '../validators/wine-import';
import { ParseResult } from './excel-parser';
import { callOpenRouter } from '../ai/openrouter';

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a filename is a PDF
 */
export function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

/**
 * Parse a PDF file buffer into wine rows
 */
export async function parsePdfFile(buffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    // Step 1: Extract text from PDF
    const data = await pdf(buffer);

    if (!data.text || data.text.trim().length === 0) {
      return {
        success: false,
        rows: [],
        headers: [],
        headerMapping: {},
        error: 'PDF:en innehåller ingen text. Kanske en skannad bild?',
        warnings,
      };
    }

    if (data.numpages > 50) {
      warnings.push(`PDF:en har ${data.numpages} sidor. Bara de första 50 sidorna bearbetas.`);
    }

    // Step 2: Try structured table detection
    const tableResult = detectAndParseTable(data.text);

    if (tableResult) {
      return tableResult;
    }

    // Step 3: Fall back to AI extraction
    warnings.push('Ingen tydlig tabell hittades i PDF:en. Använder AI för att extrahera vindata.');
    const aiResult = await extractWithAI(data.text, warnings);
    return aiResult;
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      headers: [],
      headerMapping: {},
      error: `Kunde inte läsa PDF:en: ${error.message}`,
      warnings,
    };
  }
}

// ============================================================================
// Table Detection
// ============================================================================

// Keywords that indicate a header row (Swedish + English + French + Italian)
const HEADER_KEYWORDS = [
  'namn', 'vin', 'wine', 'name', 'nom', 'vino',
  'producent', 'producer', 'producteur', 'produttore',
  'pris', 'price', 'prix', 'prezzo',
  'druva', 'grape', 'cépage', 'vitigno',
  'region', 'région', 'regione',
  'land', 'country', 'pays', 'paese',
  'årgång', 'vintage', 'millésime', 'annata',
  'färg', 'color', 'colour', 'typ', 'type',
  'storlek', 'volume', 'bottle', 'flaska', 'cl', 'ml',
  'alkohol', 'alcohol', 'alc',
  'sku', 'artikel', 'article', 'art.nr', 'artnr',
];

/**
 * Try to detect a tabular structure in the PDF text.
 * Returns ParseResult if a table is found, null otherwise.
 */
function detectAndParseTable(text: string): ParseResult | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 3) return null;

  // Step A: Find header row
  const headerIndex = findHeaderRow(lines);
  if (headerIndex === -1) return null;

  const headerLine = lines[headerIndex];

  // Step B: Detect column separator pattern
  const separator = detectSeparator(headerLine);
  const headerCells = splitLine(headerLine, separator);

  if (headerCells.length < 2) return null;

  // Step C: Normalize headers
  const headers = headerCells.map(h => h.trim()).filter(h => h.length > 0);
  const headerMapping = normalizeColumnHeaders(headers);

  // Check we mapped at least 2 useful fields
  const mappedFields = Object.values(headerMapping);
  const usefulFields = ['wine_name', 'producer', 'price', 'region', 'grape', 'vintage'];
  const usefulMapped = usefulFields.filter(f => mappedFields.includes(f));

  if (usefulMapped.length < 2) return null;

  // Step D: Parse data rows
  const warnings: string[] = [];
  const rows: RawWineRow[] = [];
  let skippedRows = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip page numbers, footers, empty-ish lines
    if (isNoiseLine(line)) continue;

    const cells = splitLine(line, separator);

    // Row should have roughly the same number of columns as header
    if (cells.length < Math.max(2, headers.length - 2)) {
      skippedRows++;
      continue;
    }

    const row: RawWineRow = {};
    for (let j = 0; j < Math.min(cells.length, headers.length); j++) {
      const field = headerMapping[headers[j]];
      if (field) {
        const value = cells[j].trim();
        if (value) {
          (row as any)[field] = value;
        }
      }
    }

    // Only include rows that have at least a wine name or producer
    if (row.wine_name || row.producer) {
      rows.push(row);
    } else {
      skippedRows++;
    }
  }

  if (skippedRows > 0) {
    warnings.push(`${skippedRows} rader kunde inte tolkas och hoppades över.`);
  }

  if (rows.length === 0) return null;

  return {
    success: true,
    rows,
    headers,
    headerMapping,
    warnings,
  };
}

/**
 * Find the index of the header row by looking for lines
 * that contain multiple header keywords.
 */
function findHeaderRow(lines: string[]): number {
  let bestIndex = -1;
  let bestScore = 0;

  // Only check first 30 lines (header won't be deep in the document)
  const searchLimit = Math.min(lines.length, 30);

  for (let i = 0; i < searchLimit; i++) {
    const lower = lines[i].toLowerCase();
    let score = 0;

    for (const keyword of HEADER_KEYWORDS) {
      if (lower.includes(keyword)) {
        score++;
      }
    }

    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Detect the column separator used in a line.
 * Returns: 'tab', 'semicolon', 'pipe', or 'spaces'
 */
function detectSeparator(line: string): 'tab' | 'semicolon' | 'pipe' | 'spaces' {
  const tabCount = (line.match(/\t/g) || []).length;
  const semiCount = (line.match(/;/g) || []).length;
  const pipeCount = (line.match(/\|/g) || []).length;
  const multiSpaceCount = (line.match(/ {3,}/g) || []).length;

  const counts = [
    { type: 'tab' as const, count: tabCount },
    { type: 'semicolon' as const, count: semiCount },
    { type: 'pipe' as const, count: pipeCount },
    { type: 'spaces' as const, count: multiSpaceCount },
  ];

  counts.sort((a, b) => b.count - a.count);

  // Need at least 1 separator occurrence
  if (counts[0].count >= 1) {
    return counts[0].type;
  }

  return 'spaces';
}

/**
 * Split a line into cells based on the detected separator.
 */
function splitLine(line: string, separator: 'tab' | 'semicolon' | 'pipe' | 'spaces'): string[] {
  switch (separator) {
    case 'tab':
      return line.split('\t');
    case 'semicolon':
      return line.split(';');
    case 'pipe':
      return line.split('|').map(s => s.trim());
    case 'spaces':
      // Split on 3+ spaces (common in fixed-width PDF tables)
      return line.split(/ {3,}/).filter(s => s.trim().length > 0);
  }
}

/**
 * Check if a line is noise (page numbers, footers, etc.)
 */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();

  // Pure numbers (page numbers)
  if (/^\d{1,3}$/.test(trimmed)) return true;

  // "Page X of Y" / "Sida X av Y"
  if (/^(page|sida)\s+\d+/i.test(trimmed)) return true;

  // Very short lines (< 5 chars) that aren't data
  if (trimmed.length < 3) return true;

  // Lines that are just dashes/underscores (separators)
  if (/^[-_=.]{3,}$/.test(trimmed)) return true;

  return false;
}

// ============================================================================
// AI Fallback Extraction
// ============================================================================

const MAX_CHARS_PER_AI_CALL = 8000;

/**
 * Use AI to extract wine data from unstructured PDF text.
 */
async function extractWithAI(text: string, warnings: string[]): Promise<ParseResult> {
  try {
    // Clean and limit text
    const cleanedText = cleanPdfText(text);

    if (cleanedText.length < 20) {
      return {
        success: false,
        rows: [],
        headers: [],
        headerMapping: {},
        error: 'PDF:en innehåller för lite text för att extrahera vindata.',
        warnings,
      };
    }

    // Split into chunks if too large
    const chunks = splitIntoChunks(cleanedText, MAX_CHARS_PER_AI_CALL);
    const allRows: RawWineRow[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkRows = await extractChunkWithAI(chunk);
      allRows.push(...chunkRows);

      // Limit to 200 wines total
      if (allRows.length >= 200) {
        warnings.push('Max 200 viner extraherades. PDF:en kan innehålla fler.');
        break;
      }
    }

    if (allRows.length === 0) {
      return {
        success: false,
        rows: [],
        headers: [],
        headerMapping: {},
        error: 'Kunde inte extrahera vindata ur PDF:en. Prova med Excel eller CSV istället.',
        warnings,
      };
    }

    // Build headers from the fields that actually have data
    const fieldSet = new Set<string>();
    for (const row of allRows) {
      for (const [key, value] of Object.entries(row)) {
        if (value !== undefined && value !== null && value !== '') {
          fieldSet.add(key);
        }
      }
    }
    const headers = Array.from(fieldSet);

    // Header mapping is identity since AI returns normalized field names
    const headerMapping: Record<string, string> = {};
    for (const h of headers) {
      headerMapping[h] = h;
    }

    return {
      success: true,
      rows: allRows,
      headers,
      headerMapping,
      warnings,
    };
  } catch (error: any) {
    console.error('[PDF Parser] AI extraction failed:', error.message);
    return {
      success: false,
      rows: [],
      headers: [],
      headerMapping: {},
      error: 'AI-extrahering misslyckades. Prova med Excel eller CSV istället.',
      warnings,
    };
  }
}

/**
 * Extract wine rows from a single text chunk using AI.
 */
async function extractChunkWithAI(text: string): Promise<RawWineRow[]> {
  const prompt = `Du är en expert på att extrahera vindata ur prislistor.

Här är text från en PDF-prislista. Extrahera varje vin som ett JSON-objekt i en array.

Använd EXAKT dessa fältnamn (utelämna fält utan data):
- wine_name (vinets namn)
- producer (producent)
- price (pris, bara siffror)
- vintage (årgång, t.ex. "2022" eller "NV")
- region (region)
- country (land)
- grape (druva/druvor)
- color (färg: red, white, rosé, sparkling, orange, dessert)
- bottle_size_ml (flaskstorlek i ml, standard = 750)
- alcohol_pct (alkoholhalt, bara siffror)
- sku (artikelnummer)
- case_size (antal per kartong)
- moq (minsta beställning)
- organic (true/false)
- description (kort beskrivning om tillgänglig)

Svara BARA med en JSON-array, inget annat. Exempel:
[{"wine_name": "Château Example", "producer": "Example Wines", "price": "189", "vintage": "2022", "color": "red"}]

Om du inte hittar några viner, svara med en tom array: []

Text från PDF:
${text}`;

  const response = await callOpenRouter(prompt, 4000);

  // Extract JSON array from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // Filter to valid RawWineRow objects
    return parsed.filter((item: any) =>
      typeof item === 'object' && item !== null && (item.wine_name || item.producer)
    ) as RawWineRow[];
  } catch {
    return [];
  }
}

/**
 * Clean PDF text: remove excessive whitespace, page breaks, etc.
 */
function cleanPdfText(text: string): string {
  return text
    // Remove form feed characters (page breaks)
    .replace(/\f/g, '\n')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Remove lines that are just page numbers
    .replace(/^\s*\d{1,3}\s*$/gm, '')
    // Remove "Page X of Y" lines
    .replace(/^.*(page|sida)\s+\d+\s*(of|av)\s*\d+.*$/gim, '')
    .trim();
}

/**
 * Split text into chunks of max size, splitting at line boundaries.
 */
function splitIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Limit to 5 chunks (5 * 8000 = 40000 chars max)
  return chunks.slice(0, 5);
}
