/**
 * Catalog Agent — Anomaly Detection
 *
 * Pure logic (no AI calls). Detects:
 * - Price outliers (z-score based)
 * - Duplicate wines (name+producer+vintage)
 * - Missing recommended data
 * - Suspicious values (negative prices, future vintages, etc.)
 */

import { ValidatedWine } from '../validators/wine-import';
import { AnomalyWarning, AnomalySeverity, AnomalyType } from './types';

// ============================================================================
// Price Anomaly Detection
// ============================================================================

/**
 * Detect price outliers using IQR (Interquartile Range) method.
 * More robust than z-score for small datasets with skewed distributions.
 */
function detectPriceOutliers(wines: (ValidatedWine | null)[]): AnomalyWarning[] {
  const warnings: AnomalyWarning[] = [];

  const prices = wines
    .map((w, i) => ({ price: w?.price ?? 0, index: i }))
    .filter(p => p.price > 0);

  if (prices.length < 4) return warnings; // Need enough data for IQR

  const sorted = [...prices].sort((a, b) => a.price - b.price);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index].price;
  const q3 = sorted[q3Index].price;
  const iqr = q3 - q1;

  // Use 2.5x IQR as threshold (generous to avoid false positives)
  const lowerBound = q1 - 2.5 * iqr;
  const upperBound = q3 + 2.5 * iqr;

  const median = sorted[Math.floor(sorted.length / 2)].price;

  for (const { price, index } of prices) {
    if (price < lowerBound && lowerBound > 0) {
      warnings.push({
        type: 'price_outlier',
        severity: 'warning',
        rowIndex: index,
        field: 'price',
        message: `Ovanligt lågt pris: ${price} kr (median: ${median} kr)`,
        suggestion: `Kontrollera om priset ${price} kr stämmer`,
      });
    } else if (price > upperBound) {
      warnings.push({
        type: 'price_outlier',
        severity: 'warning',
        rowIndex: index,
        field: 'price',
        message: `Ovanligt högt pris: ${price} kr (median: ${median} kr)`,
        suggestion: `Kontrollera om priset ${price} kr stämmer`,
      });
    }
  }

  return warnings;
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Detect potential duplicate wines based on name + producer + vintage.
 */
function detectDuplicates(wines: (ValidatedWine | null)[]): AnomalyWarning[] {
  const warnings: AnomalyWarning[] = [];
  const seen = new Map<string, number>(); // key → first row index

  for (let i = 0; i < wines.length; i++) {
    const wine = wines[i];
    if (!wine) continue;

    const key = `${wine.wine_name.toLowerCase().trim()}|${wine.producer.toLowerCase().trim()}|${wine.vintage}`;

    if (seen.has(key)) {
      const firstIndex = seen.get(key)!;
      warnings.push({
        type: 'duplicate_wine',
        severity: 'warning',
        rowIndex: i,
        message: `Möjlig dubblett: "${wine.wine_name}" (${wine.producer}, ${wine.vintage}) — samma som rad ${firstIndex + 2}`,
        suggestion: 'Kontrollera om detta är samma vin eller en annan variant',
      });
    } else {
      seen.set(key, i);
    }
  }

  return warnings;
}

// ============================================================================
// Missing Data Detection
// ============================================================================

/**
 * Detect missing recommended (but not required) fields.
 */
function detectMissingData(wines: (ValidatedWine | null)[]): AnomalyWarning[] {
  const warnings: AnomalyWarning[] = [];

  for (let i = 0; i < wines.length; i++) {
    const wine = wines[i];
    if (!wine) continue;

    if (!wine.country) {
      warnings.push({
        type: 'missing_data',
        severity: 'info',
        rowIndex: i,
        field: 'country',
        message: `Rad ${i + 2}: Land saknas för "${wine.wine_name}"`,
        suggestion: 'Lägg till land för bättre matchning',
      });
    }

    if (!wine.description) {
      warnings.push({
        type: 'missing_data',
        severity: 'info',
        rowIndex: i,
        field: 'description',
        message: `Rad ${i + 2}: Beskrivning saknas för "${wine.wine_name}"`,
        suggestion: 'Aktivera AI-beskrivningar för att generera automatiskt',
      });
    }

    if (!wine.appellation && wine.region) {
      // Only flag if we can tell it's a wine that typically has appellations
      const frenchRegions = ['bordeaux', 'bourgogne', 'burgundy', 'rhône', 'rhone', 'loire', 'alsace'];
      const italianRegions = ['toscana', 'tuscany', 'piemonte', 'piedmont', 'veneto'];
      const regionLower = wine.region.toLowerCase();
      if (frenchRegions.some(r => regionLower.includes(r)) || italianRegions.some(r => regionLower.includes(r))) {
        warnings.push({
          type: 'missing_data',
          severity: 'info',
          rowIndex: i,
          field: 'appellation',
          message: `Rad ${i + 2}: Appellation saknas för "${wine.wine_name}" (${wine.region})`,
        });
      }
    }
  }

  return warnings;
}

// ============================================================================
// Suspicious Value Detection
// ============================================================================

/**
 * Detect values that are technically valid but suspicious.
 */
function detectSuspiciousValues(wines: (ValidatedWine | null)[]): AnomalyWarning[] {
  const warnings: AnomalyWarning[] = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < wines.length; i++) {
    const wine = wines[i];
    if (!wine) continue;

    // Future vintage
    if (wine.vintage !== 'NV') {
      const year = parseInt(wine.vintage);
      if (year > currentYear) {
        warnings.push({
          type: 'suspicious_value',
          severity: 'warning',
          rowIndex: i,
          field: 'vintage',
          message: `Framtida årgång: ${wine.vintage} (nuvarande år: ${currentYear})`,
          suggestion: 'Kontrollera om årgången stämmer',
        });
      }
      if (year < 1950) {
        warnings.push({
          type: 'suspicious_value',
          severity: 'info',
          rowIndex: i,
          field: 'vintage',
          message: `Mycket gammal årgång: ${wine.vintage}`,
        });
      }
    }

    // Very low price (< 20 SEK per bottle)
    if (wine.price > 0 && wine.price < 20) {
      warnings.push({
        type: 'suspicious_value',
        severity: 'warning',
        rowIndex: i,
        field: 'price',
        message: `Mycket lågt pris: ${wine.price} kr — kan priset vara i annan valuta?`,
        suggestion: 'Kontrollera om priset är i SEK',
      });
    }

    // Very high alcohol (> 20% for non-fortified)
    if (wine.alcohol_pct && wine.alcohol_pct > 20 && wine.color !== 'fortified') {
      warnings.push({
        type: 'suspicious_value',
        severity: 'warning',
        rowIndex: i,
        field: 'alcohol_pct',
        message: `Ovanligt hög alkoholhalt: ${wine.alcohol_pct}% för ${wine.color}`,
      });
    }

    // Unusual bottle size
    const commonSizes = [187, 200, 250, 375, 500, 750, 1000, 1500, 3000, 5000, 6000, 9000, 12000, 15000, 18000, 20000];
    if (!commonSizes.includes(wine.bottle_size_ml) && wine.bottle_size_ml < 100) {
      warnings.push({
        type: 'suspicious_value',
        severity: 'warning',
        rowIndex: i,
        field: 'bottle_size_ml',
        message: `Ovanlig flaskstorlek: ${wine.bottle_size_ml} ml`,
        suggestion: 'Kontrollera om storleken är i ml',
      });
    }
  }

  return warnings;
}

// ============================================================================
// Main Detector
// ============================================================================

/**
 * Run all anomaly detections on validated wine data.
 * Returns a flat list of warnings sorted by severity (error > warning > info).
 */
export function detectAnomalies(validatedWines: (ValidatedWine | null)[]): AnomalyWarning[] {
  const warnings: AnomalyWarning[] = [
    ...detectPriceOutliers(validatedWines),
    ...detectDuplicates(validatedWines),
    ...detectMissingData(validatedWines),
    ...detectSuspiciousValues(validatedWines),
  ];

  // Sort by severity
  const severityOrder: Record<AnomalySeverity, number> = { error: 0, warning: 1, info: 2 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return warnings;
}
