/**
 * PRODUCT MATCHING ENGINE v2 (Aligned with MATCHING_RULES.md)
 *
 * Purpose: Match supplier product data to master_products with confidence scoring
 *
 * Key Principles:
 * - GTIN is preferred but optional
 * - Auto-match only when identity is highly certain (confidence ≥90)
 * - Hard guardrails prevent wrong bottle/year/format errors
 * - Vintage must be exact for auto-match
 *
 * Decision Thresholds:
 * - ≥90: AUTO_MATCH
 * - 80-89: AUTO_MATCH_WITH_SAMPLING_REVIEW
 * - 60-79: REVIEW_QUEUE
 * - <60 or guardrail fail: NO_MATCH
 */

import { createClient } from '@supabase/supabase-js';
import { gs1Service } from '../gs1/verification-service';

// ============================================================================
// Types
// ============================================================================

export interface SupplierProductInput {
  supplierSku: string;
  gtinEach?: string;
  gtinCase?: string;

  // Product identity
  producerName: string;
  productName: string;
  vintage?: number;  // Optional - if missing, cannot auto-match to vintage-specific product
  volumeMl: number;
  abvPercent?: number;

  // Packaging
  packType: 'bottle' | 'case' | 'magnum' | 'other';
  unitsPerCase?: number;

  // Origin
  countryOfOrigin?: string;
  region?: string;

  // Optional
  grapeVariety?: string;
}

export type MatchDecision =
  | 'AUTO_MATCH'
  | 'AUTO_MATCH_WITH_SAMPLING_REVIEW'
  | 'REVIEW_QUEUE'
  | 'NO_MATCH';

export type ReasonCode =
  | 'GTIN_EXACT'
  | 'SKU_MAPPING_FOUND'
  | 'PRODUCER_EXACT'
  | 'PRODUCER_FUZZY'
  | 'PRODUCT_NAME_EXACT'
  | 'PRODUCT_NAME_FUZZY'
  | 'VINTAGE_EXACT'
  | 'VINTAGE_MISMATCH'
  | 'VINTAGE_MISSING'
  | 'VOLUME_MATCH'
  | 'VOLUME_MISMATCH'
  | 'PACK_MATCH'
  | 'PACK_MISMATCH'
  | 'UNITS_PER_CASE_MATCH'
  | 'UNITS_PER_CASE_MISMATCH'
  | 'ABV_WITHIN_TOLERANCE'
  | 'ABV_OUT_OF_TOLERANCE'
  | 'REGION_MATCH'
  | 'COUNTRY_MATCH'
  | 'GRAPE_MATCH';

export interface MatchCandidate {
  masterProductId?: string;  // For vintage-specific products
  productFamilyId?: string;  // For vintage-agnostic matches
  wfProductId?: string;
  wfFamilyId?: string;
  confidenceScore: number;  // 0-100
  reasons: ReasonCode[];
  reasonSummary: string;

  // Product details (for review UI)
  productData: {
    producer: string;
    wineName: string;
    vintage?: number;
    volumeMl: number;
    packType: string;
    unitsPerCase: number;
    abvPercent?: number;
  };
}

export interface MatchResult {
  supplierSku: string;
  decision: MatchDecision;
  confidenceScore: number;
  reasons: ReasonCode[];
  guardrailFailures: string[];

  // If auto-matched
  masterProductId?: string;
  productFamilyId?: string;
  samplingReview?: boolean;

  // Top 3 candidates (for review queue)
  candidates?: MatchCandidate[];

  // Metadata
  gtinVerified?: boolean;
  processingTimeMs?: number;
}

// ============================================================================
// Product Matching Engine v2
// ============================================================================

export class ProductMatcherV2 {
  private supabase;

  // Decision thresholds (aligned with MATCHING_RULES.md)
  private readonly AUTO_MATCH_THRESHOLD = 90;
  private readonly SAMPLING_REVIEW_THRESHOLD = 80;
  private readonly REVIEW_QUEUE_THRESHOLD = 60;

  // Guardrail tolerances
  private readonly ABV_TOLERANCE = 0.5;  // ±0.5%

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Match a single supplier product to master_products
   *
   * Returns:
   * - AUTO_MATCH: confidence ≥90, exact vintage (if provided), all guardrails passed
   * - AUTO_MATCH_WITH_SAMPLING_REVIEW: confidence 80-89, exact vintage, guardrails passed
   * - REVIEW_QUEUE: confidence 60-79, OR vintage mismatch
   * - NO_MATCH: confidence <60, OR guardrail failure
   */
  async matchProduct(
    supplierId: string,
    input: SupplierProductInput
  ): Promise<MatchResult> {
    const startTime = Date.now();
    const reasons: ReasonCode[] = [];
    const guardrailFailures: string[] = [];

    // STEP 1: Check if SKU already mapped (existing mapping)
    const existingMapping = await this.getExistingMapping(supplierId, input.supplierSku);
    if (existingMapping) {
      return {
        supplierSku: input.supplierSku,
        decision: 'AUTO_MATCH',
        confidenceScore: 90,  // High confidence for existing mapping
        reasons: ['SKU_MAPPING_FOUND'],
        guardrailFailures: [],
        masterProductId: existingMapping.masterProductId,
        processingTimeMs: Date.now() - startTime
      };
    }

    // STEP 2: Try GTIN exact match (if GTIN provided)
    let gtinVerified = false;
    if (input.gtinEach || input.gtinCase) {
      const gtinMatch = await this.matchByGTIN(input);
      if (gtinMatch) {
        gtinVerified = true;

        // GUARDRAILS: Verify attributes match
        const guardrailCheck = this.checkGuardrails(input, gtinMatch.productData);
        if (guardrailCheck.length > 0) {
          return {
            supplierSku: input.supplierSku,
            decision: 'NO_MATCH',
            confidenceScore: gtinMatch.confidenceScore,
            reasons: gtinMatch.reasons,
            guardrailFailures: guardrailCheck,
            gtinVerified: true,
            candidates: [gtinMatch],
            processingTimeMs: Date.now() - startTime
          };
        }

        // GTIN match passed guardrails
        // Check vintage policy
        if (input.vintage && gtinMatch.productData.vintage) {
          if (input.vintage !== gtinMatch.productData.vintage) {
            // Vintage mismatch → REVIEW_QUEUE
            return {
              supplierSku: input.supplierSku,
              decision: 'REVIEW_QUEUE',
              confidenceScore: gtinMatch.confidenceScore,
              reasons: [...gtinMatch.reasons, 'VINTAGE_MISMATCH'],
              guardrailFailures: [],
              gtinVerified: true,
              candidates: [gtinMatch],
              processingTimeMs: Date.now() - startTime
            };
          } else {
            gtinMatch.reasons.push('VINTAGE_EXACT');
          }
        } else if (!input.vintage && gtinMatch.productData.vintage) {
          // Input missing vintage, candidate has vintage → cannot auto-match
          return {
            supplierSku: input.supplierSku,
            decision: 'REVIEW_QUEUE',
            confidenceScore: gtinMatch.confidenceScore,
            reasons: [...gtinMatch.reasons, 'VINTAGE_MISSING'],
            guardrailFailures: [],
            gtinVerified: true,
            candidates: [gtinMatch],
            processingTimeMs: Date.now() - startTime
          };
        }

        // GTIN match with exact vintage (or both NV) → AUTO_MATCH
        return {
          supplierSku: input.supplierSku,
          decision: 'AUTO_MATCH',
          confidenceScore: gtinMatch.confidenceScore,
          reasons: gtinMatch.reasons,
          guardrailFailures: [],
          masterProductId: gtinMatch.masterProductId,
          gtinVerified: true,
          processingTimeMs: Date.now() - startTime
        };
      }
    }

    // STEP 3: Fuzzy attribute matching
    const candidates = await this.fuzzyMatch(input);

    if (candidates.length === 0) {
      return {
        supplierSku: input.supplierSku,
        decision: 'NO_MATCH',
        confidenceScore: 0,
        reasons: [],
        guardrailFailures: ['No candidates found'],
        processingTimeMs: Date.now() - startTime
      };
    }

    // Filter by guardrails
    const validCandidates = candidates.filter(c => {
      const guardrail = this.checkGuardrails(input, c.productData);
      return guardrail.length === 0;
    });

    if (validCandidates.length === 0) {
      return {
        supplierSku: input.supplierSku,
        decision: 'NO_MATCH',
        confidenceScore: candidates[0]?.confidenceScore || 0,
        reasons: candidates[0]?.reasons || [],
        guardrailFailures: ['All candidates blocked by guardrails'],
        candidates: candidates.slice(0, 3),
        processingTimeMs: Date.now() - startTime
      };
    }

    // Get top candidate
    const topCandidate = validCandidates[0];

    // Check vintage policy for top candidate
    if (input.vintage && topCandidate.productData.vintage) {
      if (input.vintage !== topCandidate.productData.vintage) {
        // Vintage mismatch → REVIEW_QUEUE (regardless of score)
        return {
          supplierSku: input.supplierSku,
          decision: 'REVIEW_QUEUE',
          confidenceScore: topCandidate.confidenceScore,
          reasons: [...topCandidate.reasons, 'VINTAGE_MISMATCH'],
          guardrailFailures: [],
          candidates: validCandidates.slice(0, 3),
          processingTimeMs: Date.now() - startTime
        };
      } else {
        topCandidate.reasons.push('VINTAGE_EXACT');
      }
    } else if (!input.vintage && topCandidate.productData.vintage) {
      // Input missing vintage, candidate has vintage → REVIEW_QUEUE
      return {
        supplierSku: input.supplierSku,
        decision: 'REVIEW_QUEUE',
        confidenceScore: topCandidate.confidenceScore,
        reasons: [...topCandidate.reasons, 'VINTAGE_MISSING'],
        guardrailFailures: [],
        candidates: validCandidates.slice(0, 3),
        processingTimeMs: Date.now() - startTime
      };
    }

    // Apply decision thresholds
    if (topCandidate.confidenceScore >= this.AUTO_MATCH_THRESHOLD) {
      return {
        supplierSku: input.supplierSku,
        decision: 'AUTO_MATCH',
        confidenceScore: topCandidate.confidenceScore,
        reasons: topCandidate.reasons,
        guardrailFailures: [],
        masterProductId: topCandidate.masterProductId,
        productFamilyId: topCandidate.productFamilyId,
        processingTimeMs: Date.now() - startTime
      };
    }

    if (topCandidate.confidenceScore >= this.SAMPLING_REVIEW_THRESHOLD) {
      return {
        supplierSku: input.supplierSku,
        decision: 'AUTO_MATCH_WITH_SAMPLING_REVIEW',
        confidenceScore: topCandidate.confidenceScore,
        reasons: topCandidate.reasons,
        guardrailFailures: [],
        masterProductId: topCandidate.masterProductId,
        productFamilyId: topCandidate.productFamilyId,
        samplingReview: true,
        processingTimeMs: Date.now() - startTime
      };
    }

    if (topCandidate.confidenceScore >= this.REVIEW_QUEUE_THRESHOLD) {
      return {
        supplierSku: input.supplierSku,
        decision: 'REVIEW_QUEUE',
        confidenceScore: topCandidate.confidenceScore,
        reasons: topCandidate.reasons,
        guardrailFailures: [],
        candidates: validCandidates.slice(0, 3),
        processingTimeMs: Date.now() - startTime
      };
    }

    // Score < 60 → NO_MATCH
    return {
      supplierSku: input.supplierSku,
      decision: 'NO_MATCH',
      confidenceScore: topCandidate.confidenceScore,
      reasons: topCandidate.reasons,
      guardrailFailures: ['Confidence score below threshold'],
      candidates: validCandidates.slice(0, 3),
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Batch match multiple products (for CSV import)
   */
  async matchBatch(
    supplierId: string,
    inputs: SupplierProductInput[]
  ): Promise<Map<string, MatchResult>> {
    const results = new Map<string, MatchResult>();

    for (const input of inputs) {
      const result = await this.matchProduct(supplierId, input);
      results.set(input.supplierSku, result);
    }

    return results;
  }

  // ==========================================================================
  // Matching Strategies
  // ==========================================================================

  private async getExistingMapping(
    supplierId: string,
    supplierSku: string
  ): Promise<{ masterProductId: string } | null> {
    const { data, error } = await this.supabase
      .from('supplier_product_mappings')
      .select('master_product_id')
      .eq('supplier_id', supplierId)
      .eq('supplier_sku', supplierSku)
      .single();

    if (error || !data) return null;
    return { masterProductId: data.master_product_id };
  }

  private async matchByGTIN(input: SupplierProductInput): Promise<MatchCandidate | null> {
    const gtin = input.gtinEach || input.gtinCase;
    if (!gtin) return null;

    // Verify GTIN with GS1 (cache-first)
    const verification = await gs1Service.verifyGTIN(gtin);

    if (!verification.verified) {
      return null;
    }

    // Look up GTIN in product_gtin_registry
    const { data, error } = await this.supabase
      .from('product_gtin_registry')
      .select(`
        master_product_id,
        master_products!inner (
          id,
          wf_product_id,
          family_id,
          vintage,
          volume_ml,
          pack_type,
          units_per_case,
          product_families!inner (
            id,
            wf_family_id,
            producer,
            wine_name
          )
        )
      `)
      .eq('gtin', gtin)
      .eq('master_products.is_active', true)
      .single();

    if (error || !data) return null;

    const product = data.master_products;
    const family = product.product_families;

    // GTIN match scores 70 points
    const reasons: ReasonCode[] = ['GTIN_EXACT'];
    let score = 70;

    // Add attribute match points
    if (product.volume_ml === input.volumeMl) {
      reasons.push('VOLUME_MATCH');
      score += 10;
    }

    if (product.pack_type === input.packType) {
      reasons.push('PACK_MATCH');
      score += 10;
    }

    // Producer name match
    if (this.normalizeString(family.producer) === this.normalizeString(input.producerName)) {
      reasons.push('PRODUCER_EXACT');
      score += 15;
    }

    return {
      masterProductId: product.id,
      productFamilyId: family.id,
      wfProductId: product.wf_product_id,
      wfFamilyId: family.wf_family_id,
      confidenceScore: Math.min(score, 100),
      reasons,
      reasonSummary: reasons.join(', '),
      productData: {
        producer: family.producer,
        wineName: family.wine_name,
        vintage: product.vintage,
        volumeMl: product.volume_ml,
        packType: product.pack_type,
        unitsPerCase: product.units_per_case
      }
    };
  }

  private async fuzzyMatch(input: SupplierProductInput): Promise<MatchCandidate[]> {
    // Query master_products with fuzzy string matching
    const { data, error } = await this.supabase
      .from('master_products')
      .select(`
        id,
        wf_product_id,
        family_id,
        vintage,
        volume_ml,
        pack_type,
        units_per_case,
        product_families!inner (
          id,
          wf_family_id,
          producer,
          wine_name,
          country,
          region
        )
      `)
      .eq('is_active', true)
      .eq('volume_ml', input.volumeMl)  // Hard filter: volume must match
      .eq('pack_type', input.packType);  // Hard filter: pack type must match

    if (error || !data) return [];

    // Score each candidate
    const candidates: MatchCandidate[] = data
      .map(product => {
        const family = product.product_families;
        const scoreResult = this.calculateFuzzyScore(input, product, family);

        return {
          masterProductId: product.id,
          productFamilyId: family.id,
          wfProductId: product.wf_product_id,
          wfFamilyId: family.wf_family_id,
          confidenceScore: scoreResult.score,
          reasons: scoreResult.reasons,
          reasonSummary: scoreResult.reasons.join(', '),
          productData: {
            producer: family.producer,
            wineName: family.wine_name,
            vintage: product.vintage,
            volumeMl: product.volume_ml,
            packType: product.pack_type,
            unitsPerCase: product.units_per_case
          }
        };
      })
      .filter(c => c.confidenceScore >= this.REVIEW_QUEUE_THRESHOLD)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);

    return candidates;
  }

  // ==========================================================================
  // Fuzzy Scoring (Aligned with MATCHING_RULES.md)
  // ==========================================================================

  private calculateFuzzyScore(
    input: SupplierProductInput,
    product: any,
    family: any
  ): { score: number; reasons: ReasonCode[] } {
    let score = 0;
    const reasons: ReasonCode[] = [];

    // A) Identifier Signals (none - GTIN handled separately)

    // B) Identity Signals (names)

    // Producer match (max 15 points)
    const producerNormInput = this.normalizeString(input.producerName);
    const producerNormCandidate = this.normalizeString(family.producer);
    if (producerNormInput === producerNormCandidate) {
      score += 15;
      reasons.push('PRODUCER_EXACT');
    } else {
      const producerSim = this.stringSimilarity(producerNormInput, producerNormCandidate);
      if (producerSim >= 0.92) {
        score += 10;
        reasons.push('PRODUCER_FUZZY');
      }
    }

    // Product name match (max 15 points)
    const productNormInput = this.normalizeString(input.productName);
    const productNormCandidate = this.normalizeString(family.wine_name);
    if (productNormInput === productNormCandidate) {
      score += 15;
      reasons.push('PRODUCT_NAME_EXACT');
    } else {
      const productSim = this.stringSimilarity(productNormInput, productNormCandidate);
      if (productSim >= 0.90) {
        score += 10;
        reasons.push('PRODUCT_NAME_FUZZY');
      }
    }

    // C) Attribute Signals

    // Vintage match (10 points)
    if (input.vintage && product.vintage) {
      if (input.vintage === product.vintage) {
        score += 10;
        reasons.push('VINTAGE_EXACT');
      }
      // Note: Mismatch will be caught by vintage policy, not scored here
    } else if (!input.vintage && !product.vintage) {
      // Both NV
      score += 10;
      reasons.push('VINTAGE_EXACT');
    }

    // Volume match (10 points) - already filtered, so guaranteed match
    score += 10;
    reasons.push('VOLUME_MATCH');

    // ABV within tolerance (5 points)
    if (input.abvPercent && product.abv_percent) {
      const abvDiff = Math.abs(input.abvPercent - product.abv_percent);
      if (abvDiff <= this.ABV_TOLERANCE) {
        score += 5;
        reasons.push('ABV_WITHIN_TOLERANCE');
      }
    }

    // Country + region match (5 points)
    if (input.countryOfOrigin && family.country) {
      const countryMatch = this.normalizeString(input.countryOfOrigin) === this.normalizeString(family.country);
      if (countryMatch) {
        score += 3;
        reasons.push('COUNTRY_MATCH');

        if (input.region && family.region) {
          const regionMatch = this.normalizeString(input.region) === this.normalizeString(family.region);
          if (regionMatch) {
            score += 2;
            reasons.push('REGION_MATCH');
          }
        }
      }
    }

    // Grape match (3 points) - if available
    if (input.grapeVariety && product.grape_variety) {
      const grapeMatch = this.normalizeString(input.grapeVariety) === this.normalizeString(product.grape_variety);
      if (grapeMatch) {
        score += 3;
        reasons.push('GRAPE_MATCH');
      }
    }

    return {
      score: Math.min(score, 100),
      reasons
    };
  }

  // ==========================================================================
  // Guardrails (Hard Blockers)
  // ==========================================================================

  /**
   * Check guardrails to prevent catastrophic mismatches
   *
   * Returns: array of failure messages (empty if all pass)
   */
  private checkGuardrails(
    input: SupplierProductInput,
    productData: any
  ): string[] {
    const failures: string[] = [];

    // Guardrail 1: Volume must match exactly
    if (input.volumeMl !== productData.volumeMl) {
      failures.push(`VOLUME_MISMATCH: input=${input.volumeMl}ml, candidate=${productData.volumeMl}ml`);
    }

    // Guardrail 2: Pack type must match
    if (input.packType !== productData.packType) {
      failures.push(`PACK_MISMATCH: input=${input.packType}, candidate=${productData.packType}`);
    }

    // Guardrail 3: Units per case must match (if case)
    if (input.packType === 'case' && input.unitsPerCase && productData.unitsPerCase) {
      if (input.unitsPerCase !== productData.unitsPerCase) {
        failures.push(`UNITS_PER_CASE_MISMATCH: input=${input.unitsPerCase}, candidate=${productData.unitsPerCase}`);
      }
    }

    // Guardrail 4: ABV mismatch beyond tolerance
    if (input.abvPercent && productData.abvPercent) {
      const abvDiff = Math.abs(input.abvPercent - productData.abvPercent);
      if (abvDiff > this.ABV_TOLERANCE) {
        failures.push(`ABV_OUT_OF_TOLERANCE: input=${input.abvPercent}%, candidate=${productData.abvPercent}%, diff=${abvDiff.toFixed(1)}%`);
      }
    }

    // Guardrail 5: Vintage rules (checked separately in main logic)
    // Not enforced here as guardrail, but as part of decision logic

    return failures;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Normalize string for exact matching
   * - Lowercase
   * - Remove accents
   * - Remove special characters
   * - Trim whitespace
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove accents
      .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
      .replace(/\s+/g, ' ')  // Collapse whitespace
      .trim();
  }

  /**
   * Simple string similarity (Levenshtein-based)
   * Returns 0.0-1.0 (1.0 = identical)
   */
  private stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const productMatcherV2 = new ProductMatcherV2();
