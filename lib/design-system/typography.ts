/**
 * DESIGN SYSTEM: TYPOGRAPHY
 *
 * Unified typography scale for consistent text hierarchy.
 *
 * Conventions:
 * - Use h1 for page titles (30px)
 * - Use h2 for main section titles (24px)
 * - Use h3 for subsection titles (20px)
 * - Use h4 for card section titles (18px)
 * - Body text sizes: large (18px), default (16px), small (14px)
 * - Keep line-height proportional for readability
 */

/**
 * Heading styles (h1-h4)
 */
export const typography = {
  // Page headings
  h1: 'text-3xl font-bold tracking-tight text-foreground',       // 30px
  h2: 'text-2xl font-bold text-foreground',                      // 24px
  h3: 'text-xl font-semibold text-foreground',                   // 20px
  h4: 'text-lg font-semibold text-foreground',                   // 18px

  // Body text
  body: {
    large: 'text-lg text-foreground',                            // 18px - Summaries, leads
    default: 'text-base text-foreground',                        // 16px - Primary content
    small: 'text-sm text-muted-foreground',                      // 14px - Helper text
  },

  // Meta/labels
  label: 'text-sm font-medium text-foreground',                  // 14px - Form labels
  caption: 'text-xs text-muted-foreground',                      // 12px - Timestamps, meta

  // Monospace (for codes, IDs)
  mono: 'font-mono text-sm',                                     // 14px monospace
} as const;

/**
 * Text color variants
 */
export const textColors = {
  primary: 'text-foreground',
  secondary: 'text-muted-foreground',
  link: 'text-primary hover:underline',
  success: 'text-green-700',
  warning: 'text-yellow-700',
  error: 'text-destructive',
} as const;
