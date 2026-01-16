/**
 * PRODUCT MATCHING ENGINE v0
 *
 * Purpose: Match supplier product data to master_products with confidence scoring
 *
 * Matching Strategy (3-tier):
 * 1. GTIN exact match → confidence 1.00 (auto-match)
 * 2. Existing SKU mapping → confidence 0.90 (auto-match)
 * 3. Fuzzy attribute match → confidence 0.50-0.80 (human review)
 *
 * Guardrails (blocking mismatches):
 * - volume_ml mismatch → NO MATCH
 * - pack_type mismatch → NO MATCH
 * - units_per_case mismatch (if case) → NO MATCH
 * - vintage mismatch >2 years → NO MATCH
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
  vintage?: number;
  volumeMl: number;
  abvPercent?: number;

  // Packaging
  packType: 'bottle' | 'case' | 'magnum' | 'other';
  unitsPerCase?: number;

  // Origin
  countryOfOrigin?: string;
  region?: string;
}

export interface MatchCandidate {
  masterProductId: string;
  wfProductId: string;
  confidence: number;  // 0.00-1.00
  matchMethod: 'gtin_exact' | 'sku_existing' | 'fuzzy_match';
  matchReasons: string[];

  // Product details (for review UI)
  productData: {
    familyId: string;
    producer: string;
    wineName: string;
    vintage?: number;
    volumeMl: number;
    packType: string;
    unitsPerCase: number;
  };
}

export interface MatchResult {
  supplierSku: string;
  status: 'auto_matched' | 'needs_review' | 'no_match';

  // If auto_matched
  masterProductId?: string;
  confidence?: number;
  matchMethod?: string;

  // If needs_review
  candidates?: MatchCandidate[];

  // Metadata
  guardrailBlocked?: string;  // Reason for blocking (volume mismatch, etc.)
  gtinVerified?: boolean;
}

// ============================================================================
// Product Matching Engine
// ============================================================================

export class ProductMatcher {
  private supabase;

  // Thresholds
  private readonly AUTO_MATCH_THRESHOLD = 0.85;
  private readonly MIN_CANDIDATE_THRESHOLD = 0.50;

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
   * - auto_matched: confidence >= 0.85 → create mapping immediately
   * - needs_review: confidence 0.50-0.84 → send to review queue
   * - no_match: confidence < 0.50 or guardrail blocked
   */
  async matchProduct(
    supplierId: string,
    input: SupplierProductInput
  ): Promise<MatchResult> {
    // STEP 1: Check if SKU already mapped (existing mapping)
    const existingMapping = await this.getExistingMapping(supplierId, input.supplierSku);
    if (existingMapping) {
      return {
        supplierSku: input.supplierSku,
        status: 'auto_matched',
        masterProductId: existingMapping.masterProductId,
        confidence: 0.90,
        matchMethod: 'sku_existing'
      };
    }

    // STEP 2: Try GTIN exact match (if GTIN provided)
    if (input.gtinEach || input.gtinCase) {
      const gtinMatch = await this.matchByGTIN(input);
      if (gtinMatch) {
        // GUARDRAIL: Verify volume/pack match
        const guardrail = this.checkGuardrails(input, gtinMatch.productData);
        if (guardrail) {
          return {
            supplierSku: input.supplierSku,
            status: 'no_match',
            guardrailBlocked: guardrail,
            gtinVerified: true
          };
        }

        return {
          supplierSku: input.supplierSku,
          status: 'auto_matched',
          masterProductId: gtinMatch.masterProductId,
          confidence: 1.00,
          matchMethod: 'gtin_exact',
          gtinVerified: true
        };
      }
    }

    // STEP 3: Fuzzy attribute matching
    const candidates = await this.fuzzyMatch(input);

    if (candidates.length === 0) {
      return {
        supplierSku: input.supplierSku,
        status: 'no_match'
      };
    }

    // Filter by guardrails
    const validCandidates = candidates.filter(c => {
      const guardrail = this.checkGuardrails(input, c.productData);
      return !guardrail;
    });

    if (validCandidates.length === 0) {
      return {
        supplierSku: input.supplierSku,
        status: 'no_match',
        guardrailBlocked: 'All candidates blocked by guardrails'
      };
    }

    // Check if top candidate is above auto-match threshold
    const topCandidate = validCandidates[0];
    if (topCandidate.confidence >= this.AUTO_MATCH_THRESHOLD) {
      return {
        supplierSku: input.supplierSku,
        status: 'auto_matched',
        masterProductId: topCandidate.masterProductId,
        confidence: topCandidate.confidence,
        matchMethod: topCandidate.matchMethod
      };
    }

    // Needs human review
    return {
      supplierSku: input.supplierSku,
      status: 'needs_review',
      candidates: validCandidates.slice(0, 3)  // Top 3 candidates
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
            producer,
            wine_name
          )
        )
      `)
      .eq('gtin', gtin)
      .single();

    if (error || !data) return null;

    const product = Array.isArray(data.master_products) ? data.master_products[0] : data.master_products;
    if (!product) return null;
    const family = Array.isArray(product.product_families) ? product.product_families[0] : product.product_families;
    if (!family) return null;

    return {
      masterProductId: product.id,
      wfProductId: product.wf_product_id,
      confidence: 1.00,
      matchMethod: 'gtin_exact',
      matchReasons: ['gtin_exact_match', 'gs1_verified'],
      productData: {
        familyId: product.family_id,
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
          producer,
          wine_name,
          country
        )
      `)
      .eq('is_active', true)
      .eq('volume_ml', input.volumeMl)  // Hard filter: volume must match
      .eq('pack_type', input.packType);  // Hard filter: pack type must match

    if (error || !data) return [];

    // Score each candidate
    const candidates: MatchCandidate[] = data
      .map(product => {
        const family = Array.isArray(product.product_families) ? product.product_families[0] : product.product_families;
        if (!family) return null;
        const score = this.calculateFuzzyScore(input, product, family);

        return {
          masterProductId: product.id,
          wfProductId: product.wf_product_id,
          confidence: score.confidence,
          matchMethod: 'fuzzy_match' as const,
          matchReasons: score.reasons,
          productData: {
            familyId: product.family_id,
            producer: family.producer,
            wineName: family.wine_name,
            vintage: product.vintage,
            volumeMl: product.volume_ml,
            packType: product.pack_type,
            unitsPerCase: product.units_per_case
          }
        };
      })
      .filter(c => c !== null && c.confidence >= this.MIN_CANDIDATE_THRESHOLD)
      .sort((a, b) => b!.confidence - a!.confidence) as MatchCandidate[];

    return candidates;
  }

  // ==========================================================================
  // Fuzzy Scoring
  // ==========================================================================

  private calculateFuzzyScore(
    input: SupplierProductInput,
    product: any,
    family: any
  ): { confidence: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Producer name match (0-30 points)
    const producerSim = this.stringSimilarity(
      input.producerName.toLowerCase(),
      family.producer.toLowerCase()
    );
    const producerScore = producerSim * 30;
    score += producerScore;
    if (producerSim > 0.8) reasons.push(`producer_match:${Math.round(producerScore)}pts`);

    // Product name match (0-30 points)
    const productSim = this.stringSimilarity(
      input.productName.toLowerCase(),
      family.wine_name.toLowerCase()
    );
    const productScore = productSim * 30;
    score += productScore;
    if (productSim > 0.8) reasons.push(`product_name_match:${Math.round(productScore)}pts`);

    // Vintage match (0-15 points)
    if (input.vintage && product.vintage) {
      const vintageDiff = Math.abs(input.vintage - product.vintage);
      if (vintageDiff === 0) {
        score += 15;
        reasons.push('vintage_exact:15pts');
      } else if (vintageDiff === 1) {
        score += 10;
        reasons.push('vintage_near:10pts');
      }
    } else if (!input.vintage && !product.vintage) {
      score += 10;
      reasons.push('both_nv:10pts');
    }

    // Volume match (already filtered, so +10 points)
    score += 10;
    reasons.push('volume_match:10pts');

    // Pack type match (already filtered, so +10 points)
    score += 10;
    reasons.push('pack_type_match:10pts');

    // Country match (0-5 points)
    if (input.countryOfOrigin && family.country) {
      if (input.countryOfOrigin.toLowerCase() === family.country.toLowerCase()) {
        score += 5;
        reasons.push('country_match:5pts');
      }
    }

    return {
      confidence: Math.min(score / 100, 1.00),
      reasons
    };
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

  // ==========================================================================
  // Guardrails
  // ==========================================================================

  /**
   * Check guardrails to prevent catastrophic mismatches
   *
   * Returns: error message if guardrail violated, null if OK
   */
  private checkGuardrails(
    input: SupplierProductInput,
    productData: any
  ): string | null {
    // Guardrail 1: Volume must match exactly
    if (input.volumeMl !== productData.volumeMl) {
      return `Volume mismatch: input=${input.volumeMl}ml, product=${productData.volumeMl}ml`;
    }

    // Guardrail 2: Pack type must match
    if (input.packType !== productData.packType) {
      return `Pack type mismatch: input=${input.packType}, product=${productData.packType}`;
    }

    // Guardrail 3: Units per case must match (if case)
    if (input.packType === 'case' && input.unitsPerCase && productData.unitsPerCase) {
      if (input.unitsPerCase !== productData.unitsPerCase) {
        return `Units per case mismatch: input=${input.unitsPerCase}, product=${productData.unitsPerCase}`;
      }
    }

    // Guardrail 4: Vintage must be within 2 years (if both specified)
    if (input.vintage && productData.vintage) {
      const vintageDiff = Math.abs(input.vintage - productData.vintage);
      if (vintageDiff > 2) {
        return `Vintage mismatch too large: input=${input.vintage}, product=${productData.vintage} (diff=${vintageDiff} years)`;
      }
    }

    return null;  // All guardrails passed
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const productMatcher = new ProductMatcher();
