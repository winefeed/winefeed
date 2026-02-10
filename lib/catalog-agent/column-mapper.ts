/**
 * Catalog Agent — AI Column Mapper
 *
 * Maps unknown column headers to standard wine fields using OpenRouter.
 * Only called for headers that couldn't be resolved via alias lookup.
 *
 * Uses sample rows for context so the AI can infer meaning from data patterns.
 */

import { callOpenRouter } from '../ai/openrouter';
import { COLUMN_ALIASES } from '../validators/wine-import';
import { RawWineRow } from '../validators/wine-import';
import { ColumnMappingResult } from './types';

/** Standard fields the AI can map to */
const STANDARD_FIELDS = Object.keys(COLUMN_ALIASES);

/**
 * Use AI to map unknown column headers to standard wine fields.
 *
 * @param unknownHeaders - Headers that couldn't be mapped by alias lookup
 * @param sampleRows - First 3 rows of raw data for context
 * @param allHeaders - All original headers (for context)
 */
export async function smartMapColumns(
  unknownHeaders: string[],
  sampleRows: RawWineRow[],
  allHeaders: string[]
): Promise<ColumnMappingResult> {
  if (unknownHeaders.length === 0) {
    return { mapping: {}, aiMapped: [], unmapped: [], confidence: {} };
  }

  // Build sample data string for context
  const sampleDataStr = sampleRows.slice(0, 3).map((row, i) => {
    const values = allHeaders.map(h => `${h}: ${(row as any)[h] ?? ''}`).join(', ');
    return `Row ${i + 1}: ${values}`;
  }).join('\n');

  const prompt = `You are a wine catalog data expert. Given unknown column headers from a wine import file, map each to the most likely standard field.

STANDARD FIELDS (pick from these ONLY):
${STANDARD_FIELDS.join(', ')}

UNKNOWN HEADERS TO MAP:
${unknownHeaders.join(', ')}

ALL HEADERS IN FILE:
${allHeaders.join(', ')}

SAMPLE DATA:
${sampleDataStr}

RULES:
- Only map if you are at least 70% confident
- If unsure, mark as "unmapped"
- Consider the language (French, German, Swedish, Italian, Spanish headers are common)
- Look at sample data values to confirm your mapping

Respond ONLY with a JSON object. Example:
{"nom_du_vin": {"field": "wine_name", "confidence": 0.95}, "cépage": {"field": "grape", "confidence": 0.9}, "weird_col": {"field": "unmapped", "confidence": 0}}

JSON:`;

  try {
    const response = await callOpenRouter(prompt, 500);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr) as Record<string, { field: string; confidence: number }>;

    const mapping: Record<string, string> = {};
    const aiMapped: string[] = [];
    const unmapped: string[] = [];
    const confidence: Record<string, number> = {};

    for (const header of unknownHeaders) {
      const result = parsed[header];

      if (result && result.field !== 'unmapped' && STANDARD_FIELDS.includes(result.field) && result.confidence >= 0.7) {
        mapping[header] = result.field;
        aiMapped.push(header);
        confidence[header] = result.confidence;
      } else {
        unmapped.push(header);
      }
    }

    return { mapping, aiMapped, unmapped, confidence };
  } catch (error) {
    console.warn('[Column Mapper] AI mapping failed:', error);
    // Graceful degradation — all unknown headers become unmapped
    return {
      mapping: {},
      aiMapped: [],
      unmapped: unknownHeaders,
      confidence: {},
    };
  }
}
