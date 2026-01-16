/**
 * GS1 VERIFICATION SERVICE
 *
 * Purpose: Verify GTINs via GS1 Sweden API with caching, rate limiting, and circuit breaker
 * Pattern: verify + cache (soft TTL + hard cache fallback)
 *
 * Architecture:
 * 1. Check cache first (30-day TTL)
 * 2. If miss → call GS1 API (with rate limit + circuit breaker)
 * 3. Cache result (verified = 30d TTL, not found = 7d TTL)
 * 4. If GS1 down → return cached stale data + log warning
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface GS1VerificationResult {
  gtin: string;
  verified: boolean;
  source: 'cache' | 'gs1_api' | 'cache_stale';

  // GS1 product data (if verified)
  productData?: {
    brandName?: string;
    productName?: string;
    gpcCategoryCode?: string;
    netContent?: string;
    countryOfOrigin?: string;
  };

  // Metadata
  cachedAt?: Date;
  expiresAt?: Date;
  gs1Response?: any;  // Full GS1 API response
}

export interface VerificationOptions {
  forceFresh?: boolean;  // Skip cache, force GS1 API call
  allowStale?: boolean;  // Return stale cache if GS1 is down (default: true)
}

// ============================================================================
// GS1 Verification Service
// ============================================================================

export class GS1VerificationService {
  private supabase;
  private gs1ApiKey: string;
  private gs1BaseUrl: string;

  // Rate limiting
  private requestCount = 0;
  private requestWindow = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 60;

  // Circuit breaker
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.gs1ApiKey = process.env.GS1_API_KEY || '';
    this.gs1BaseUrl = process.env.GS1_API_URL || 'https://api.gs1.se/v1';

    if (!this.gs1ApiKey) {
      console.warn('⚠️  GS1_API_KEY not configured - verification will work in cache-only mode');
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Verify a GTIN via GS1 API (with caching)
   *
   * Flow:
   * 1. Normalize GTIN to 14 digits (zero-pad)
   * 2. Check cache (if not forceFresh)
   * 3. If cache miss → call GS1 API
   * 4. Store result in cache
   * 5. Return verification result
   */
  async verifyGTIN(
    gtin: string,
    options: VerificationOptions = {}
  ): Promise<GS1VerificationResult> {
    const normalizedGtin = this.normalizeGTIN(gtin);

    // STEP 1: Check cache (unless forceFresh)
    if (!options.forceFresh) {
      const cached = await this.getCachedVerification(normalizedGtin);

      if (cached) {
        const isExpired = cached.expiresAt && new Date(cached.expiresAt) < new Date();

        if (!isExpired) {
          // Cache hit (fresh)
          return {
            ...cached,
            source: 'cache'
          };
        } else if (options.allowStale !== false) {
          // Cache expired but GS1 might be down → try API, fallback to stale
          try {
            return await this.fetchFromGS1(normalizedGtin);
          } catch (error) {
            console.warn(`⚠️  GS1 API failed, returning stale cache for GTIN ${normalizedGtin}`);
            return {
              ...cached,
              source: 'cache_stale'
            };
          }
        }
      }
    }

    // STEP 2: Fetch from GS1 API
    return await this.fetchFromGS1(normalizedGtin);
  }

  /**
   * Batch verify multiple GTINs (with concurrency limit)
   */
  async verifyBatch(
    gtins: string[],
    options: VerificationOptions = {}
  ): Promise<Map<string, GS1VerificationResult>> {
    const results = new Map<string, GS1VerificationResult>();

    // Process in chunks to avoid overwhelming GS1 API
    const CHUNK_SIZE = 10;
    for (let i = 0; i < gtins.length; i += CHUNK_SIZE) {
      const chunk = gtins.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(gtin => this.verifyGTIN(gtin, options))
      );

      chunk.forEach((gtin, idx) => {
        results.set(this.normalizeGTIN(gtin), chunkResults[idx]);
      });

      // Rate limiting: wait 1 second between chunks
      if (i + CHUNK_SIZE < gtins.length) {
        await this.sleep(1000);
      }
    }

    return results;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private async getCachedVerification(gtin: string): Promise<GS1VerificationResult | null> {
    const { data, error } = await this.supabase
      .from('gtin_verification_cache')
      .select('*')
      .eq('gtin', gtin)
      .single();

    if (error || !data) return null;

    // Increment hit count (fire and forget)
    this.supabase
      .from('gtin_verification_cache')
      .update({ hit_count: data.hit_count + 1 })
      .eq('gtin', gtin)
      .then();

    return {
      gtin: data.gtin,
      verified: data.verified,
      source: 'cache',
      productData: data.gs1_response?.product,
      cachedAt: new Date(data.cached_at),
      expiresAt: new Date(data.expires_at),
      gs1Response: data.gs1_response
    };
  }

  private async cacheVerification(
    gtin: string,
    verified: boolean,
    gs1Response: any
  ): Promise<void> {
    const now = new Date();
    const ttlDays = verified ? 30 : 7;  // 30 days for verified, 7 days for not found
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    await this.supabase
      .from('gtin_verification_cache')
      .upsert({
        gtin,
        verified,
        gs1_response: gs1Response,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        hit_count: 0
      });
  }

  // ==========================================================================
  // GS1 API Integration
  // ==========================================================================

  private async fetchFromGS1(gtin: string): Promise<GS1VerificationResult> {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('GS1 API circuit breaker is OPEN - too many recent failures');
    }

    // Check rate limit
    this.checkRateLimit();

    // Call GS1 API
    try {
      if (!this.gs1ApiKey) {
        throw new Error('GS1_API_KEY not configured');
      }

      const response = await fetch(`${this.gs1BaseUrl}/products/${gtin}`, {
        headers: {
          'Authorization': `Bearer ${this.gs1ApiKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)  // 5 second timeout
      });

      if (response.status === 404) {
        // GTIN not found in GS1 registry
        await this.cacheVerification(gtin, false, { notFound: true });
        this.resetCircuitBreaker();

        return {
          gtin,
          verified: false,
          source: 'gs1_api'
        };
      }

      if (!response.ok) {
        throw new Error(`GS1 API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // GTIN found and verified
      await this.cacheVerification(gtin, true, data);
      this.resetCircuitBreaker();

      return {
        gtin,
        verified: true,
        source: 'gs1_api',
        productData: {
          brandName: data.brandName,
          productName: data.productDescription,
          gpcCategoryCode: data.gpcCategoryCode,
          netContent: data.netContent,
          countryOfOrigin: data.countryOfSale?.[0]
        },
        gs1Response: data
      };

    } catch (error) {
      this.recordFailure();
      console.error(`❌ GS1 API call failed for GTIN ${gtin}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  private checkRateLimit(): void {
    const now = Date.now();

    // Reset window if 1 minute has passed
    if (now - this.requestWindow > 60000) {
      this.requestCount = 0;
      this.requestWindow = now;
    }

    // Check limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded: max 60 requests/minute to GS1 API');
    }

    this.requestCount++;
  }

  // ==========================================================================
  // Circuit Breaker
  // ==========================================================================

  private isCircuitOpen(): boolean {
    if (this.failureCount < this.CIRCUIT_BREAKER_THRESHOLD) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT) {
      // Circuit breaker timeout expired → reset
      this.resetCircuitBreaker();
      return false;
    }

    return true;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      console.error(`🚨 GS1 API circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  private resetCircuitBreaker(): void {
    if (this.failureCount > 0) {
      console.log(`✅ GS1 API circuit breaker CLOSED (was ${this.failureCount} failures)`);
    }
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Normalize GTIN to 14 digits (zero-pad shorter formats)
   *
   * Examples:
   * - GTIN-8:  12345678 → 00000012345678
   * - GTIN-12: 123456789012 → 00123456789012
   * - GTIN-13: 1234567890123 → 01234567890123
   * - GTIN-14: 12345678901234 → 12345678901234
   */
  private normalizeGTIN(gtin: string): string {
    const cleaned = gtin.replace(/[^0-9]/g, '');

    if (![8, 12, 13, 14].includes(cleaned.length)) {
      throw new Error(`Invalid GTIN length: ${cleaned.length} (must be 8, 12, 13, or 14 digits)`);
    }

    return cleaned.padStart(14, '0');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const gs1Service = new GS1VerificationService();
