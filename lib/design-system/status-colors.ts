/**
 * DESIGN SYSTEM: STATUS COLORS
 *
 * Unified color mappings for all status indicators across Winefeed.
 *
 * Conventions:
 * - Use light backgrounds (100) with dark text (800) for badges
 * - Provide matching border colors (200-300) for consistency
 * - Semantic categories follow lifecycle: draft → pending → progress → completed
 * - Always provide fallback to neutral gray for unknown statuses
 *
 * Color Semantics:
 * - gray:   draft, initial, not started, neutral
 * - blue:   pending, submitted, sent, in review
 * - yellow: in progress, partial, warning
 * - green:  completed, approved, delivered, success
 * - red:    rejected, failed, error
 * - orange: cancelled, expired, deprecated
 * - purple: locked, shipped, special state
 */

export type SemanticStatus =
  | 'draft'
  | 'pending'
  | 'progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'locked';

/**
 * Core semantic status colors
 */
export const semanticStatusColors = {
  draft: {
    badge: 'bg-gray-100 text-gray-800 border-gray-300',
    dot: 'bg-gray-500',
  },
  pending: {
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
    dot: 'bg-blue-500',
  },
  progress: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    dot: 'bg-yellow-500',
  },
  completed: {
    badge: 'bg-green-100 text-green-800 border-green-300',
    dot: 'bg-green-500',
  },
  rejected: {
    badge: 'bg-red-100 text-red-800 border-red-300',
    dot: 'bg-red-500',
  },
  cancelled: {
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    dot: 'bg-orange-500',
  },
  locked: {
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    dot: 'bg-purple-500',
  },
} as const;

/**
 * Business status to semantic category mapping
 */
export const businessStatusMapping: Record<string, SemanticStatus> = {
  // Import case statuses
  NOT_REGISTERED: 'draft',
  SUBMITTED: 'pending',
  APPROVED: 'completed',
  REJECTED: 'rejected',
  EXPIRED: 'cancelled',

  // Offer statuses
  DRAFT: 'draft',
  SENT: 'pending',
  ACCEPTED: 'completed',
  // REJECTED already mapped above

  // Order statuses
  PENDING_SUPPLIER_CONFIRMATION: 'draft',  // Waiting for supplier to confirm
  CONFIRMED: 'pending',
  IN_FULFILLMENT: 'progress',
  SHIPPED: 'locked',
  DELIVERED: 'completed',
  CANCELLED: 'cancelled',

  // Delivery location statuses
  // NOT_REGISTERED, SUBMITTED, APPROVED, REJECTED already mapped

  // Match statuses
  AUTO_MATCH: 'completed',
  AUTO_MATCH_WITH_GUARDS: 'pending',
  SUGGESTED: 'progress',
  PENDING_REVIEW: 'progress',
  NO_MATCH: 'draft',

  // Wine Check / Enrichment statuses
  EXACT: 'completed',
  FUZZY: 'pending',
  MULTIPLE: 'progress',
  NOT_FOUND: 'draft',
  ERROR: 'rejected',
} as const;

export interface StatusColorResult {
  badgeClass: string;
  dotClass?: string;
  label?: string;
}

/**
 * Get unified status colors for any business status
 *
 * @param status - Business status string (e.g. 'SUBMITTED', 'DRAFT', 'CONFIRMED')
 * @param label - Optional custom label (if not provided, status is returned as-is)
 * @returns StatusColorResult with badge classes and optional dot class
 *
 * @example
 * ```ts
 * const { badgeClass, label } = getStatusColor('SUBMITTED', 'Inskickad');
 * // => { badgeClass: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Inskickad' }
 * ```
 */
export function getStatusColor(status: string, label?: string): StatusColorResult {
  // Normalize status to uppercase
  const normalizedStatus = status.toUpperCase();

  // Map to semantic category (fallback to draft for unknown)
  const semanticCategory = businessStatusMapping[normalizedStatus] || 'draft';

  // Get colors from semantic mapping
  const colors = semanticStatusColors[semanticCategory];

  return {
    badgeClass: colors.badge,
    dotClass: colors.dot,
    label: label || status,
  };
}

/**
 * Get status colors by semantic category directly
 *
 * @param category - Semantic category (e.g. 'pending', 'completed')
 * @returns StatusColorResult with badge and dot classes
 */
export function getSemanticColor(category: SemanticStatus): StatusColorResult {
  const colors = semanticStatusColors[category];
  return {
    badgeClass: colors.badge,
    dotClass: colors.dot,
  };
}

/**
 * Get confidence color based on confidence score (0-1 or 0-100)
 *
 * @param confidence - Confidence score (0-1 or 0-100)
 * @returns Text color class
 *
 * @example
 * ```ts
 * getConfidenceColor(0.95) // => 'text-green-700'
 * getConfidenceColor(85) // => 'text-blue-700'
 * ```
 */
export function getConfidenceColor(confidence: number): string {
  // Normalize to 0-1 range
  const normalized = confidence > 1 ? confidence / 100 : confidence;

  if (normalized >= 0.9) return 'text-green-700';
  if (normalized >= 0.7) return 'text-blue-700';
  if (normalized >= 0.5) return 'text-yellow-700';
  return 'text-orange-700';
}
