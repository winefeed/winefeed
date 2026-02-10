/**
 * Catalog Agent Types
 *
 * Types for the AI-assisted catalog import pipeline.
 * The agent wraps the existing import flow — it doesn't replace it.
 */

import { RawWineRow, ValidatedWine } from '../validators/wine-import';

// ============================================================================
// Pipeline Options
// ============================================================================

export interface CatalogAgentOptions {
  /** Enable AI column mapping for unrecognized headers */
  enableSmartMapping?: boolean;
  /** Enable data enrichment (country from region, grape from appellation) */
  enableEnrichment?: boolean;
  /** Enable anomaly detection (price outliers, duplicates) */
  enableAnomalyDetection?: boolean;
  /** Enable AI description generation for wines without descriptions */
  enableDescriptions?: boolean;
}

export const DEFAULT_OPTIONS: CatalogAgentOptions = {
  enableSmartMapping: true,
  enableEnrichment: true,
  enableAnomalyDetection: true,
  enableDescriptions: false, // Off by default — user opt-in
};

// ============================================================================
// Column Mapping
// ============================================================================

export interface ColumnMappingResult {
  /** Original header → standard field name */
  mapping: Record<string, string>;
  /** Headers that were mapped by AI (not by alias lookup) */
  aiMapped: string[];
  /** Headers that could not be mapped at all */
  unmapped: string[];
  /** Confidence score per AI-mapped header (0-1) */
  confidence: Record<string, number>;
}

// ============================================================================
// Enrichment
// ============================================================================

export interface EnrichmentResult {
  /** Original row index */
  rowIndex: number;
  /** Fields that were enriched */
  enrichedFields: EnrichedField[];
}

export interface EnrichedField {
  field: keyof RawWineRow;
  originalValue: string | undefined;
  enrichedValue: string;
  source: 'lookup' | 'ai';
  confidence: number;
}

// ============================================================================
// Anomaly Detection
// ============================================================================

export type AnomalySeverity = 'info' | 'warning' | 'error';
export type AnomalyType =
  | 'price_outlier'
  | 'duplicate_wine'
  | 'missing_data'
  | 'suspicious_value';

export interface AnomalyWarning {
  type: AnomalyType;
  severity: AnomalySeverity;
  rowIndex: number;
  field?: string;
  message: string;
  /** Suggested fix (if any) */
  suggestion?: string;
}

// ============================================================================
// Description Tracking
// ============================================================================

export interface DescriptionMeta {
  source: 'manual' | 'ai';
  originalDescription?: string | null;
}

// ============================================================================
// Quality Report
// ============================================================================

export interface QualityReport {
  /** Overall data quality score (0-100) */
  score: number;
  /** Column mapping summary */
  columnMapping: {
    totalHeaders: number;
    aliasMapped: number;
    aiMapped: number;
    unmapped: number;
  };
  /** Enrichment summary */
  enrichment: {
    totalEnriched: number;
    byField: Record<string, number>;
    bySource: { lookup: number; ai: number };
  };
  /** Anomaly summary */
  anomalies: {
    total: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<AnomalyType, number>;
    items: AnomalyWarning[];
  };
  /** Description generation summary */
  descriptions: {
    existing: number;
    generated: number;
    failed: number;
  };
}

// ============================================================================
// Pipeline Result
// ============================================================================

export interface CatalogAgentPreview {
  /** Standard preview data (same shape as existing preview) */
  valid: any[];
  invalid: any[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  warnings: string[];
  headerMapping: Record<string, string>;

  /** Catalog Agent additions */
  qualityReport: QualityReport;
  enrichments: EnrichmentResult[];
  anomalies: AnomalyWarning[];
  descriptionMeta: Record<number, DescriptionMeta>;
}
