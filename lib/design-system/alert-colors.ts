/**
 * DESIGN SYSTEM: ALERT COLORS
 *
 * Unified color mappings for admin alerts and severity indicators.
 *
 * Conventions:
 * - Use light backgrounds (100) with dark text (700) for badges
 * - Provide matching border colors (300-500) for cards/borders
 * - Semantic categories: ERROR → WARNING → INFO → OK → NEUTRAL
 *
 * Alert Semantics:
 * - ERROR (red):    Critical issues requiring immediate attention
 * - WARNING (orange): Important warnings that should be addressed
 * - INFO (yellow):   Informational alerts or pending items
 * - OK (green):      Success state or healthy status
 * - NEUTRAL (gray):  Neutral/default state
 * - SPECIAL (purple/pink): Special cases or unique states
 */

export type AlertSeverity = 'ERROR' | 'WARNING' | 'INFO' | 'OK' | 'NEUTRAL' | 'SPECIAL';

export type AlertVariant = 'badge' | 'card' | 'border';

/**
 * Alert severity color mappings
 */
export const alertColors = {
  ERROR: {
    badge: 'bg-red-100 text-red-700',
    card: 'bg-red-50 border-red-200',
    border: 'border-l-4 border-red-500',
  },
  WARNING: {
    badge: 'bg-orange-100 text-orange-700',
    card: 'bg-orange-50 border-orange-200',
    border: 'border-l-4 border-orange-500',
  },
  INFO: {
    badge: 'bg-yellow-100 text-yellow-700',
    card: 'bg-yellow-50 border-yellow-200',
    border: 'border-l-4 border-yellow-500',
  },
  OK: {
    badge: 'bg-green-100 text-green-700',
    card: 'bg-green-50 border-green-200',
    border: 'border-l-4 border-green-500',
  },
  NEUTRAL: {
    badge: 'bg-gray-100 text-gray-700',
    card: 'bg-gray-50 border-gray-200',
    border: 'border-l-4 border-gray-500',
  },
  SPECIAL: {
    badge: 'bg-purple-100 text-purple-700',
    card: 'bg-purple-50 border-purple-200',
    border: 'border-l-4 border-purple-500',
  },
} as const;

/**
 * Special alert colors for unique cases (pink for email failures, etc.)
 */
export const specialAlertColors = {
  EMAIL_FAILURE: {
    badge: 'bg-pink-100 text-pink-700',
    card: 'bg-pink-50 border-pink-200',
    border: 'border-l-4 border-pink-500',
  },
} as const;

export interface AlertColorResult {
  badgeClass: string;
  cardClass?: string;
  borderClass?: string;
}

/**
 * Get alert colors by severity level
 *
 * @param severity - Alert severity level
 * @param variant - Which variant to return (defaults to all)
 * @returns AlertColorResult with badge/card/border classes
 *
 * @example
 * ```ts
 * const { badgeClass } = getAlertColor('ERROR');
 * // => { badgeClass: 'bg-red-100 text-red-700', ... }
 * ```
 */
export function getAlertColor(
  severity: AlertSeverity | 'EMAIL_FAILURE',
  variant?: AlertVariant
): AlertColorResult {
  // Handle special cases
  if (severity === 'EMAIL_FAILURE') {
    const colors = specialAlertColors.EMAIL_FAILURE;
    return {
      badgeClass: colors.badge,
      cardClass: colors.card,
      borderClass: colors.border,
    };
  }

  const colors = alertColors[severity];

  if (variant === 'badge') {
    return { badgeClass: colors.badge };
  }

  if (variant === 'card') {
    return { badgeClass: colors.badge, cardClass: colors.card };
  }

  if (variant === 'border') {
    return { badgeClass: colors.badge, borderClass: colors.border };
  }

  // Return all variants
  return {
    badgeClass: colors.badge,
    cardClass: colors.card,
    borderClass: colors.border,
  };
}

/**
 * Get alert severity based on count
 * Helper for alert cards that show count-based severity
 *
 * @param count - Number of items in alert
 * @returns AlertSeverity (OK if 0, ERROR if > 0)
 */
export function getCountSeverity(count: number): AlertSeverity {
  return count > 0 ? 'ERROR' : 'OK';
}
