/**
 * CARD COMPONENT
 *
 * Standardized card wrapper with consistent styling and variants.
 *
 * Usage:
 * ```tsx
 * <Card size="md">
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 * ```
 */

import React from 'react';
import { cardPadding } from '@/lib/design-system/spacing';

export interface CardProps {
  /**
   * Card padding size
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes to merge
   */
  className?: string;

  /**
   * Card content
   */
  children: React.ReactNode;

  /**
   * Click handler (makes card interactive)
   */
  onClick?: () => void;
}

/**
 * Card component with standardized styling
 */
export function Card({ size = 'md', className = '', children, onClick }: CardProps) {
  const baseClasses = 'bg-card border border-border rounded-lg shadow-sm';
  const paddingClass = cardPadding[size];

  // Interactive styling if onClick is provided
  const interactiveClasses = onClick
    ? 'hover:shadow-md transition-shadow cursor-pointer'
    : '';

  const classes = `${baseClasses} ${paddingClass} ${interactiveClasses} ${className}`.trim();

  if (onClick) {
    return (
      <div className={classes} onClick={onClick} role="button" tabIndex={0}>
        {children}
      </div>
    );
  }

  return <div className={classes}>{children}</div>;
}

/**
 * Card Header component (optional subcomponent)
 */
export function CardHeader({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mb-4 ${className}`.trim()}>{children}</div>;
}

/**
 * Card Content component (optional subcomponent)
 */
export function CardContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

/**
 * Card Footer component (optional subcomponent)
 */
export function CardFooter({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mt-4 pt-4 border-t border-border ${className}`.trim()}>{children}</div>;
}
