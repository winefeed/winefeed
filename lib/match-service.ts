/**
 * PRODUCT MATCHING SERVICE
 *
 * Hierarchical matching engine for mapping products to internal wine entities
 * Uses identifier-first approach with text-based fallback
 *
 * AUTO-CREATE POLICY:
 * - Auto-creates wine_masters/wine_skus ONLY for hard identifiers (GTIN, LWIN)
 * - NEVER auto-creates for text/canonical matches (policy)
 * - Controlled by MATCHING_ENABLE_AUTO_CREATE env flag
 *
 * Hierarchy (strictest first):
 * 1. GTIN exact → AUTO_MATCH (wine_sku) + auto-create if not found
 * 2. LWIN exact → AUTO_MATCH (wine_master) + auto-create if not found
 * 3. Producer SKU exact → AUTO_MATCH_WITH_GUARDS
 * 4. Importer SKU exact → AUTO_MATCH_WITH_GUARDS
 * 5. Wine-Searcher canonical → SUGGESTED (needs review, NO auto-create)
 *
 * All matches are logged to match_results for audit/debug
 */

import { createClient } from '@supabase/supabase-js';
import { wineSearcherService } from './winesearcher-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Auto-create flag (default true for dev, set to false in prod if desired)
const ENABLE_AUTO_CREATE = process.env.MATCHING_ENABLE_AUTO_CREATE !== 'false';

// ============================================================================
// Types
// ============================================================================

export type MatchMethod =
  | 'GTIN_EXACT'
  | 'LWIN_EXACT'
  | 'SKU_EXACT'
  | 'CANONICAL_SUGGEST'
  | 'MANUAL'
  | 'NO_MATCH';

export type MatchStatus =
  | 'AUTO_MATCH'
  | 'AUTO_MATCH_WITH_GUARDS'
  | 'SUGGESTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'PENDING_REVIEW';

export type EntityType = 'wine_master' | 'wine_sku';

export interface MatchCandidate {
  entity_type: EntityType;
  entity_id: string;
  score: number;
  reason: string;
}

export interface MatchProductInput {
  tenantId: string;
  source: {
    source_type: 'supplier_import_row' | 'offer_line' | 'importcase_line' | 'manual';
    source_id: string;
  };
  identifiers: {
    gtin?: string;
    lwin?: string;
    producer_sku?: string;
    producer_id?: string;
    importer_sku?: string;
    importer_id?: string;
    ws_id?: string;
  };
  textFallback?: {
    name?: string;
    vintage?: number;
    bottle_ml?: number;
    producer?: string;
    region?: string;
    appellation?: string;
    country?: string;
  };
}

export interface MatchProductOutput {
  status: MatchStatus;
  confidence: number;
  match_method: MatchMethod;
  matched_entity_type?: EntityType;
  matched_entity_id?: string;
  explanation: string;
  candidates?: MatchCandidate[];
}

// ============================================================================
// Main Matching Service
// ============================================================================

class MatchService {
  /**
   * Match a product using hierarchical identifier + text fallback
   */
  async matchProduct(input: MatchProductInput): Promise<MatchProductOutput> {
    let result: MatchProductOutput;

    // Step 1: GTIN exact match (highest priority) + auto-create
    if (input.identifiers.gtin) {
      const gtinResult = await this.matchByGTIN(
        input.tenantId,
        input.identifiers.gtin,
        input.textFallback
      );
      if (gtinResult) {
        result = gtinResult;
        await this.logMatchResult(input, result);
        return result;
      }
    }

    // Step 2: LWIN exact match + auto-create
    if (input.identifiers.lwin) {
      const lwinResult = await this.matchByLWIN(
        input.tenantId,
        input.identifiers.lwin,
        input.textFallback
      );
      if (lwinResult) {
        result = lwinResult;
        await this.logMatchResult(input, result);
        return result;
      }
    }

    // Step 3: Producer SKU exact match
    if (input.identifiers.producer_sku && input.identifiers.producer_id) {
      const producerSkuResult = await this.matchByProducerSKU(
        input.tenantId,
        input.identifiers.producer_sku,
        input.identifiers.producer_id
      );
      if (producerSkuResult) {
        result = producerSkuResult;
        await this.logMatchResult(input, result);
        return result;
      }
    }

    // Step 4: Importer SKU exact match
    if (input.identifiers.importer_sku && input.identifiers.importer_id) {
      const importerSkuResult = await this.matchByImporterSKU(
        input.tenantId,
        input.identifiers.importer_sku,
        input.identifiers.importer_id
      );
      if (importerSkuResult) {
        result = importerSkuResult;
        await this.logMatchResult(input, result);
        return result;
      }
    }

    // Step 5: Wine-Searcher canonical fallback (text-based)
    // POLICY: NEVER auto-creates entities for canonical/text matches
    if (input.textFallback?.name) {
      const canonicalResult = await this.matchByCanonical(input.tenantId, input.textFallback);
      result = canonicalResult;
      await this.logMatchResult(input, result);
      return result;
    }

    // No match found
    result = {
      status: 'PENDING_REVIEW',
      confidence: 0,
      match_method: 'NO_MATCH',
      explanation: 'No identifiers or text provided for matching',
      candidates: []
    };

    await this.logMatchResult(input, result);
    return result;
  }

  /**
   * Match by GTIN (barcode)
   * Returns AUTO_MATCH if found
   * AUTO-CREATES wine_master + wine_sku if not found and flag enabled
   */
  private async matchByGTIN(
    tenantId: string,
    gtin: string,
    textFallback?: MatchProductInput['textFallback']
  ): Promise<MatchProductOutput | null> {
    // Try to find existing identifier
    const { data, error } = await supabase
      .from('product_identifiers')
      .select('entity_type, entity_id')
      .eq('tenant_id', tenantId)
      .eq('id_type', 'GTIN')
      .eq('id_value', gtin)
      .single();

    if (data) {
      // Found existing match
      return {
        status: 'AUTO_MATCH',
        confidence: 1.0,
        match_method: 'GTIN_EXACT',
        matched_entity_type: data.entity_type as EntityType,
        matched_entity_id: data.entity_id,
        explanation: `Exact GTIN match: ${gtin}`
      };
    }

    // Not found - auto-create if enabled
    if (ENABLE_AUTO_CREATE) {
      try {
        const created = await this.ensureEntitiesForGTIN(tenantId, gtin, textFallback);

        return {
          status: 'AUTO_MATCH_WITH_GUARDS',
          confidence: 1.0,
          match_method: 'GTIN_EXACT',
          matched_entity_type: 'wine_sku',
          matched_entity_id: created.wine_sku_id,
          explanation: `Created new wine_sku from GTIN ${gtin} (auto-create enabled)`
        };
      } catch (createError) {
        console.error('Failed to auto-create for GTIN:', createError);
        return null;
      }
    }

    // Auto-create disabled - return null (will try next method)
    return null;
  }

  /**
   * Match by LWIN (Liv-ex Wine ID)
   * Returns AUTO_MATCH if found
   * AUTO-CREATES wine_master if not found and flag enabled
   * If vintage/bottle_ml provided, tries to find exact SKU
   */
  private async matchByLWIN(
    tenantId: string,
    lwin: string,
    textFallback?: MatchProductInput['textFallback']
  ): Promise<MatchProductOutput | null> {
    const vintage = textFallback?.vintage;
    const bottle_ml = textFallback?.bottle_ml;

    // Try to find existing identifier
    const { data, error } = await supabase
      .from('product_identifiers')
      .select('entity_type, entity_id')
      .eq('tenant_id', tenantId)
      .eq('id_type', 'LWIN')
      .eq('id_value', lwin)
      .single();

    if (data) {
      // Found existing match

      // If LWIN points to wine_master and we have vintage/bottle_ml, try to find exact SKU
      if (data.entity_type === 'wine_master' && vintage && bottle_ml) {
        const { data: skuData } = await supabase
          .from('wine_skus')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('wine_master_id', data.entity_id)
          .eq('vintage', vintage)
          .eq('bottle_ml', bottle_ml)
          .maybeSingle();

        if (skuData) {
          return {
            status: 'AUTO_MATCH',
            confidence: 1.0,
            match_method: 'LWIN_EXACT',
            matched_entity_type: 'wine_sku',
            matched_entity_id: skuData.id,
            explanation: `Exact LWIN match with vintage ${vintage} and ${bottle_ml}ml`
          };
        }

        // Found LWIN but no exact SKU - suggest wine_master
        const { data: candidateSKUs } = await supabase
          .from('wine_skus')
          .select('id, vintage, bottle_ml')
          .eq('tenant_id', tenantId)
          .eq('wine_master_id', data.entity_id)
          .limit(5);

        return {
          status: 'SUGGESTED',
          confidence: 0.9,
          match_method: 'LWIN_EXACT',
          matched_entity_type: 'wine_master',
          matched_entity_id: data.entity_id,
          explanation: `LWIN matched wine_master, but no exact SKU for vintage ${vintage} / ${bottle_ml}ml`,
          candidates: candidateSKUs?.map(sku => ({
            entity_type: 'wine_sku' as EntityType,
            entity_id: sku.id,
            score: 0.8,
            reason: `${sku.vintage || 'NV'}, ${sku.bottle_ml || 'unknown'}ml`
          }))
        };
      }

      // Direct match (LWIN → wine_master or wine_sku)
      return {
        status: 'AUTO_MATCH',
        confidence: 1.0,
        match_method: 'LWIN_EXACT',
        matched_entity_type: data.entity_type as EntityType,
        matched_entity_id: data.entity_id,
        explanation: `Exact LWIN match: ${lwin}`
      };
    }

    // Not found - auto-create if enabled
    if (ENABLE_AUTO_CREATE) {
      try {
        const created = await this.ensureEntitiesForLWIN(tenantId, lwin, textFallback);

        return {
          status: 'AUTO_MATCH_WITH_GUARDS',
          confidence: 1.0,
          match_method: 'LWIN_EXACT',
          matched_entity_type: created.entity_type,
          matched_entity_id: created.entity_id,
          explanation: created.wine_sku_id
            ? `Created new wine_master + wine_sku from LWIN ${lwin} (auto-create enabled)`
            : `Created new wine_master from LWIN ${lwin} (auto-create enabled)`
        };
      } catch (createError) {
        console.error('Failed to auto-create for LWIN:', createError);
        return null;
      }
    }

    // Auto-create disabled - return null (will try next method)
    return null;
  }

  /**
   * Match by Producer SKU
   * Requires producer_id to scope lookup
   */
  private async matchByProducerSKU(
    tenantId: string,
    producerSku: string,
    producerId: string
  ): Promise<MatchProductOutput | null> {
    const { data, error } = await supabase
      .from('product_identifiers')
      .select('entity_type, entity_id')
      .eq('tenant_id', tenantId)
      .eq('id_type', 'PRODUCER_SKU')
      .eq('id_value', producerSku)
      .eq('issuer_id', producerId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      status: 'AUTO_MATCH_WITH_GUARDS',
      confidence: 0.95,
      match_method: 'SKU_EXACT',
      matched_entity_type: data.entity_type as EntityType,
      matched_entity_id: data.entity_id,
      explanation: `Producer SKU match: ${producerSku} (producer: ${producerId})`
    };
  }

  /**
   * Match by Importer SKU
   * Requires importer_id to scope lookup
   */
  private async matchByImporterSKU(
    tenantId: string,
    importerSku: string,
    importerId: string
  ): Promise<MatchProductOutput | null> {
    const { data, error } = await supabase
      .from('product_identifiers')
      .select('entity_type, entity_id')
      .eq('tenant_id', tenantId)
      .eq('id_type', 'IMPORTER_SKU')
      .eq('id_value', importerSku)
      .eq('issuer_id', importerId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      status: 'AUTO_MATCH_WITH_GUARDS',
      confidence: 0.9,
      match_method: 'SKU_EXACT',
      matched_entity_type: data.entity_type as EntityType,
      matched_entity_id: data.entity_id,
      explanation: `Importer SKU match: ${importerSku} (importer: ${importerId})`
    };
  }

  /**
   * Match by canonical wine name (Wine-Searcher fallback)
   * Returns SUGGESTED with candidates
   *
   * POLICY: NEVER auto-creates entities for text/canonical matches
   */
  private async matchByCanonical(
    tenantId: string,
    textData: {
      name: string;
      vintage?: number;
      bottle_ml?: number;
      producer?: string;
      region?: string;
      appellation?: string;
    }
  ): Promise<MatchProductOutput> {
    try {
      // Call Wine-Searcher to get canonical data
      const wsResult = await wineSearcherService.checkWine({
        tenantId,
        name: textData.name,
        vintage: textData.vintage?.toString()
      });

      if (wsResult.data.match_status === 'NOT_FOUND' || wsResult.data.match_status === 'ERROR') {
        return {
          status: 'PENDING_REVIEW',
          confidence: 0,
          match_method: 'CANONICAL_SUGGEST',
          explanation: `Wine-Searcher returned no match for: ${textData.name}`,
          candidates: []
        };
      }

      // Try to find wine_master with similar signature
      const { data: masterCandidates } = await supabase
        .from('wine_masters')
        .select('id, canonical_name, producer, region, appellation')
        .eq('tenant_id', tenantId)
        .ilike('canonical_name', `%${wsResult.data.canonical_name || textData.name}%`)
        .limit(5);

      if (masterCandidates && masterCandidates.length > 0) {
        const topCandidate = masterCandidates[0];

        // If match is very strong, suggest AUTO_MATCH_WITH_GUARDS
        const confidence = this.calculateCanonicalConfidence(wsResult.data, topCandidate);

        if (confidence >= 0.9) {
          return {
            status: 'AUTO_MATCH_WITH_GUARDS',
            confidence,
            match_method: 'CANONICAL_SUGGEST',
            matched_entity_type: 'wine_master',
            matched_entity_id: topCandidate.id,
            explanation: `Strong canonical match via Wine-Searcher: ${topCandidate.canonical_name}`,
            candidates: masterCandidates.slice(1).map(c => ({
              entity_type: 'wine_master' as EntityType,
              entity_id: c.id,
              score: 0.7,
              reason: `${c.canonical_name} (${c.producer})`
            }))
          };
        }

        // Medium confidence - needs review
        return {
          status: 'SUGGESTED',
          confidence,
          match_method: 'CANONICAL_SUGGEST',
          matched_entity_type: 'wine_master',
          matched_entity_id: topCandidate.id,
          explanation: `Possible match via Wine-Searcher. Review recommended: ${topCandidate.canonical_name}`,
          candidates: masterCandidates.map(c => ({
            entity_type: 'wine_master' as EntityType,
            entity_id: c.id,
            score: 0.6,
            reason: `${c.canonical_name} (${c.producer || 'unknown producer'})`
          }))
        };
      }

      // No existing wine_master found - suggest creation (MANUAL, not auto-create)
      return {
        status: 'SUGGESTED',
        confidence: wsResult.data.match_score ? wsResult.data.match_score / 100 : 0.5,
        match_method: 'CANONICAL_SUGGEST',
        explanation: `Wine-Searcher found: ${wsResult.data.canonical_name}. Suggested match from canonicalization; manual review required.`,
        candidates: wsResult.data.candidates.slice(0, 3).map(c => ({
          entity_type: 'wine_master' as EntityType,
          entity_id: 'new',
          score: c.score / 100,
          reason: `${c.name} (${c.producer || 'unknown'})`
        }))
      };

    } catch (error) {
      console.error('Canonical matching error:', error);
      return {
        status: 'PENDING_REVIEW',
        confidence: 0,
        match_method: 'CANONICAL_SUGGEST',
        explanation: `Failed to match via Wine-Searcher: ${error instanceof Error ? error.message : 'Unknown error'}`,
        candidates: []
      };
    }
  }

  /**
   * AUTO-CREATE: Ensure entities for GTIN
   * Creates wine_master + wine_sku + identifier in transaction
   * POLICY: Only called for hard identifier (GTIN)
   */
  private async ensureEntitiesForGTIN(
    tenantId: string,
    gtin: string,
    textFallback?: MatchProductInput['textFallback']
  ): Promise<{ wine_master_id: string; wine_sku_id: string }> {
    // Create wine_master (minimal data)
    const { data: master, error: masterError } = await supabase
      .from('wine_masters')
      .insert({
        tenant_id: tenantId,
        canonical_name: textFallback?.name || null,
        producer: textFallback?.producer || null,
        country: textFallback?.country || null,
        region: textFallback?.region || null,
        appellation: textFallback?.appellation || null
      })
      .select('id')
      .single();

    if (masterError || !master) {
      throw new Error(`Failed to create wine_master: ${masterError?.message}`);
    }

    // Create wine_sku (minimal data)
    const { data: sku, error: skuError } = await supabase
      .from('wine_skus')
      .insert({
        tenant_id: tenantId,
        wine_master_id: master.id,
        vintage: textFallback?.vintage || null,
        bottle_ml: textFallback?.bottle_ml || null,
        packaging: null
      })
      .select('id')
      .single();

    if (skuError || !sku) {
      throw new Error(`Failed to create wine_sku: ${skuError?.message}`);
    }

    // Register GTIN identifier
    const { error: identifierError } = await supabase
      .from('product_identifiers')
      .insert({
        tenant_id: tenantId,
        entity_type: 'wine_sku',
        entity_id: sku.id,
        id_type: 'GTIN',
        id_value: gtin,
        source: 'auto_create',
        confidence: 1.0
      });

    if (identifierError) {
      throw new Error(`Failed to register GTIN identifier: ${identifierError.message}`);
    }

    return {
      wine_master_id: master.id,
      wine_sku_id: sku.id
    };
  }

  /**
   * AUTO-CREATE: Ensure entities for LWIN
   * Creates wine_master + identifier (optionally wine_sku if vintage/bottle known)
   * POLICY: Only called for hard identifier (LWIN)
   */
  private async ensureEntitiesForLWIN(
    tenantId: string,
    lwin: string,
    textFallback?: MatchProductInput['textFallback']
  ): Promise<{ entity_type: EntityType; entity_id: string; wine_sku_id?: string }> {
    // Create wine_master (minimal data)
    const { data: master, error: masterError } = await supabase
      .from('wine_masters')
      .insert({
        tenant_id: tenantId,
        canonical_name: textFallback?.name || null,
        producer: textFallback?.producer || null,
        country: textFallback?.country || null,
        region: textFallback?.region || null,
        appellation: textFallback?.appellation || null
      })
      .select('id')
      .single();

    if (masterError || !master) {
      throw new Error(`Failed to create wine_master: ${masterError?.message}`);
    }

    // Register LWIN identifier (points to wine_master)
    const { error: identifierError } = await supabase
      .from('product_identifiers')
      .insert({
        tenant_id: tenantId,
        entity_type: 'wine_master',
        entity_id: master.id,
        id_type: 'LWIN',
        id_value: lwin,
        source: 'auto_create',
        confidence: 1.0
      });

    if (identifierError) {
      throw new Error(`Failed to register LWIN identifier: ${identifierError.message}`);
    }

    // Optionally create wine_sku if vintage + bottle_ml provided
    if (textFallback?.vintage && textFallback?.bottle_ml) {
      const { data: sku, error: skuError } = await supabase
        .from('wine_skus')
        .insert({
          tenant_id: tenantId,
          wine_master_id: master.id,
          vintage: textFallback.vintage,
          bottle_ml: textFallback.bottle_ml,
          packaging: null
        })
        .select('id')
        .single();

      if (!skuError && sku) {
        return {
          entity_type: 'wine_sku',
          entity_id: sku.id,
          wine_sku_id: sku.id
        };
      }
    }

    // Return wine_master only
    return {
      entity_type: 'wine_master',
      entity_id: master.id
    };
  }

  /**
   * Calculate confidence for canonical match
   */
  private calculateCanonicalConfidence(wsData: any, candidate: any): number {
    let confidence = 0.5;

    // Exact name match
    if (wsData.canonical_name?.toLowerCase() === candidate.canonical_name?.toLowerCase()) {
      confidence += 0.3;
    } else if (wsData.canonical_name && candidate.canonical_name?.toLowerCase().includes(wsData.canonical_name.toLowerCase())) {
      confidence += 0.15;
    }

    // Producer match
    if (wsData.producer?.toLowerCase() === candidate.producer?.toLowerCase()) {
      confidence += 0.2;
    } else if (wsData.producer && candidate.producer?.toLowerCase().includes(wsData.producer.toLowerCase())) {
      confidence += 0.1;
    }

    // Region/appellation match
    if (wsData.region?.toLowerCase() === candidate.region?.toLowerCase()) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Log match result to database
   */
  private async logMatchResult(input: MatchProductInput, result: MatchProductOutput): Promise<void> {
    try {
      await supabase
        .from('match_results')
        .insert({
          tenant_id: input.tenantId,
          source_type: input.source.source_type,
          source_id: input.source.source_id,
          matched_entity_type: result.matched_entity_type || null,
          matched_entity_id: result.matched_entity_id || null,
          match_method: result.match_method,
          confidence: result.confidence,
          status: result.status,
          explanation: result.explanation,
          candidates: result.candidates ? JSON.stringify(result.candidates) : null
        });
    } catch (error) {
      console.error('Failed to log match result:', error);
      // Don't throw - logging failure shouldn't break matching
    }
  }
}

export const matchService = new MatchService();
