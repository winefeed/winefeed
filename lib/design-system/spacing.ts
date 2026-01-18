/**
 * DESIGN SYSTEM: SPACING
 *
 * Unified spacing constants for consistent layouts.
 *
 * Conventions:
 * - Use sm (16px) for compact list items, small cards
 * - Use md (24px) for standard cards, default padding
 * - Use lg (32px) for hero sections, feature cards
 */

/**
 * Card padding variants
 */
export const cardPadding = {
  sm: 'p-4',  // 16px - Compact list items, small cards
  md: 'p-6',  // 24px - Standard cards (default)
  lg: 'p-8',  // 32px - Hero sections, feature cards
} as const;

/**
 * Gap spacing for flex/grid layouts
 */
export const gapSpacing = {
  xs: 'gap-1',      // 4px - Minimal spacing (badges, icons)
  sm: 'gap-2',      // 8px - Tight spacing (button groups)
  default: 'gap-4', // 16px - Standard spacing (forms, cards)
  lg: 'gap-6',      // 24px - Loose spacing (sections)
  xl: 'gap-8',      // 32px - Major sections
} as const;

/**
 * Vertical stack spacing (space-y-*)
 */
export const stackSpacing = {
  tight: 'space-y-2',    // 8px - Form fields, tight lists
  default: 'space-y-4',  // 16px - Standard sections
  loose: 'space-y-6',    // 24px - Major sections
} as const;
