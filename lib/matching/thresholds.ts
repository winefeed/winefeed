/**
 * MATCHING THRESHOLDS (Config-Driven)
 *
 * Centralized thresholds for matching decisions
 * Can be overridden via environment variables for testing/tuning
 */

export const MATCH_THRESHOLDS = {
  /**
   * AUTO_MATCH: Confidence ≥90, exact vintage, all guardrails pass
   * → Create mapping immediately
   */
  AUTO_MATCH: parseInt(process.env.MATCH_THRESHOLD_AUTO_MATCH || '90', 10),

  /**
   * SAMPLING_REVIEW: Confidence 80-89, exact vintage, guardrails pass
   * → Auto-match but flag for periodic batch audit
   */
  SAMPLING_REVIEW_MIN: parseInt(process.env.MATCH_THRESHOLD_SAMPLING || '80', 10),

  /**
   * REVIEW_QUEUE: Confidence 60-79
   * → Send to human review queue
   */
  REVIEW_QUEUE_MIN: parseInt(process.env.MATCH_THRESHOLD_REVIEW || '60', 10),

  /**
   * NO_MATCH: Confidence <60 or guardrail failure
   * → Send to review queue with "create new product" suggestion
   */
  NO_MATCH_THRESHOLD: parseInt(process.env.MATCH_THRESHOLD_NO_MATCH || '60', 10),
} as const;

/**
 * Guardrail tolerances
 */
export const GUARDRAIL_TOLERANCES = {
  /**
   * ABV tolerance: ±0.5%
   */
  ABV_TOLERANCE_PERCENT: parseFloat(process.env.GUARDRAIL_ABV_TOLERANCE || '0.5'),

  /**
   * Vintage tolerance: 0 years (exact match required for auto-match)
   */
  VINTAGE_TOLERANCE_YEARS: 0,
} as const;

/**
 * Validate thresholds on startup
 */
export function validateThresholds(): void {
  if (MATCH_THRESHOLDS.AUTO_MATCH <= MATCH_THRESHOLDS.SAMPLING_REVIEW_MIN) {
    throw new Error('AUTO_MATCH threshold must be > SAMPLING_REVIEW_MIN');
  }

  if (MATCH_THRESHOLDS.SAMPLING_REVIEW_MIN <= MATCH_THRESHOLDS.REVIEW_QUEUE_MIN) {
    throw new Error('SAMPLING_REVIEW_MIN must be > REVIEW_QUEUE_MIN');
  }

  if (MATCH_THRESHOLDS.REVIEW_QUEUE_MIN < 0 || MATCH_THRESHOLDS.AUTO_MATCH > 100) {
    throw new Error('Thresholds must be between 0 and 100');
  }

  console.log('✅ Matching thresholds validated:', MATCH_THRESHOLDS);
}

// Validate on module load
validateThresholds();
