/**
 * Catalog Agent — Quality Report Builder
 *
 * Aggregates results from all pipeline steps into a quality report.
 */

import {
  QualityReport,
  EnrichmentResult,
  AnomalyWarning,
  AnomalySeverity,
  AnomalyType,
  ColumnMappingResult,
  DescriptionMeta,
} from './types';

/**
 * Build a quality report from pipeline results.
 */
export function buildQualityReport(params: {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  columnMapping?: ColumnMappingResult;
  enrichments: EnrichmentResult[];
  anomalies: AnomalyWarning[];
  descriptionMeta: Record<number, DescriptionMeta>;
  originalHeaders?: string[];
}): QualityReport {
  const {
    totalRows,
    validCount,
    invalidCount,
    columnMapping,
    enrichments,
    anomalies,
    descriptionMeta,
    originalHeaders,
  } = params;

  // Column mapping summary
  const totalHeaders = originalHeaders?.length ?? (columnMapping ? Object.keys(columnMapping.mapping).length + columnMapping.unmapped.length : 0);
  const aiMapped = columnMapping?.aiMapped.length ?? 0;
  const unmapped = columnMapping?.unmapped.length ?? 0;
  const aliasMapped = totalHeaders - aiMapped - unmapped;

  // Enrichment summary
  const enrichmentByField: Record<string, number> = {};
  let lookupCount = 0;
  let aiEnrichCount = 0;

  for (const result of enrichments) {
    for (const field of result.enrichedFields) {
      enrichmentByField[field.field] = (enrichmentByField[field.field] || 0) + 1;
      if (field.source === 'lookup') lookupCount++;
      else aiEnrichCount++;
    }
  }

  // Anomaly summary
  const bySeverity: Record<AnomalySeverity, number> = { info: 0, warning: 0, error: 0 };
  const byType: Record<AnomalyType, number> = {
    price_outlier: 0,
    duplicate_wine: 0,
    missing_data: 0,
    suspicious_value: 0,
  };

  for (const anomaly of anomalies) {
    bySeverity[anomaly.severity]++;
    byType[anomaly.type]++;
  }

  // Description summary
  let existingDescriptions = 0;
  let generatedDescriptions = 0;
  let failedDescriptions = 0;

  for (const meta of Object.values(descriptionMeta)) {
    if (meta.source === 'manual') existingDescriptions++;
    else generatedDescriptions++;
  }

  // Calculate quality score (0-100)
  const score = calculateScore({
    totalRows,
    validCount,
    invalidCount,
    enrichmentCount: enrichments.length,
    warningCount: bySeverity.warning,
    errorCount: bySeverity.error,
    unmappedColumns: unmapped,
  });

  return {
    score,
    columnMapping: {
      totalHeaders,
      aliasMapped,
      aiMapped,
      unmapped,
    },
    enrichment: {
      totalEnriched: enrichments.length,
      byField: enrichmentByField,
      bySource: { lookup: lookupCount, ai: aiEnrichCount },
    },
    anomalies: {
      total: anomalies.length,
      bySeverity,
      byType,
      items: anomalies,
    },
    descriptions: {
      existing: existingDescriptions,
      generated: generatedDescriptions,
      failed: failedDescriptions,
    },
  };
}

/**
 * Calculate a data quality score (0-100).
 *
 * Scoring:
 * - Start at 100
 * - -20 if >10% rows invalid
 * - -10 if >5% rows invalid
 * - -5 per unmapped column
 * - -2 per warning anomaly
 * - -5 per error anomaly
 * - +5 for enrichments applied (max +10)
 */
function calculateScore(params: {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  enrichmentCount: number;
  warningCount: number;
  errorCount: number;
  unmappedColumns: number;
}): number {
  let score = 100;

  const invalidRatio = params.totalRows > 0 ? params.invalidCount / params.totalRows : 0;

  if (invalidRatio > 0.1) score -= 20;
  else if (invalidRatio > 0.05) score -= 10;
  else if (invalidRatio > 0) score -= 5;

  score -= params.unmappedColumns * 5;
  score -= params.warningCount * 2;
  score -= params.errorCount * 5;

  // Bonus for enrichments
  score += Math.min(params.enrichmentCount, 2) * 5;

  return Math.max(0, Math.min(100, score));
}
