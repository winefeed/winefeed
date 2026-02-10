/**
 * Catalog Agent — Description Generator with Source Tracking
 *
 * Wraps the existing generate-description.ts to add:
 * - Source tracking (manual vs ai)
 * - Original description preservation
 * - Batch processing with rate limiting
 */

import { generateWineDescription, WineForDescription } from '../ai/generate-description';
import { ValidatedWine } from '../validators/wine-import';
import { DescriptionMeta } from './types';

interface DescriptionResult {
  /** Row index → generated description */
  descriptions: Record<number, string>;
  /** Row index → metadata about the description */
  meta: Record<number, DescriptionMeta>;
  /** Number of descriptions successfully generated */
  generated: number;
  /** Number of descriptions that failed */
  failed: number;
}

/**
 * Convert a ValidatedWine to WineForDescription format.
 */
function toWineForDescription(wine: ValidatedWine, index: number): WineForDescription {
  return {
    id: `import-${index}`,
    namn: wine.wine_name,
    producent: wine.producer,
    land: wine.country || undefined,
    region: wine.region || undefined,
    druva: wine.grape || undefined,
    color: wine.color,
    argang: wine.vintage !== 'NV' ? parseInt(wine.vintage) : undefined,
    alkohol: wine.alcohol_pct || undefined,
    ekologisk: wine.organic,
    biodynamiskt: wine.biodynamic,
  };
}

/**
 * Generate descriptions for wines that don't have one.
 * Preserves existing descriptions and tracks source.
 */
export async function generateDescriptionsWithTracking(
  wines: (ValidatedWine | null)[]
): Promise<DescriptionResult> {
  const descriptions: Record<number, string> = {};
  const meta: Record<number, DescriptionMeta> = {};
  let generated = 0;
  let failed = 0;

  for (let i = 0; i < wines.length; i++) {
    const wine = wines[i];
    if (!wine) continue;

    // If wine already has a description, mark as manual
    if (wine.description) {
      meta[i] = { source: 'manual' };
      continue;
    }

    // Generate AI description
    try {
      const wineForDesc = toWineForDescription(wine, i);
      const description = await generateWineDescription(wineForDesc);

      if (description) {
        descriptions[i] = description;
        meta[i] = {
          source: 'ai',
          originalDescription: null,
        };
        // Apply to the wine object so it shows in preview
        wine.description = description;
        generated++;
      } else {
        failed++;
      }
    } catch (error: any) {
      console.warn(`[Description Generator] Failed for row ${i}: ${error.message}`);
      failed++;
    }

    // Rate limit: 500ms between AI calls
    if (i < wines.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { descriptions, meta, generated, failed };
}
