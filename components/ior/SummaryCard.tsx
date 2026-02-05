/**
 * SUMMARY CARD
 *
 * Card for displaying summary statistics (catalog, pricing).
 * Used in the "Katalog & Priser" section of the dashboard.
 */

'use client';

import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  /** Card title */
  title: string;
  /** Main value to display */
  value: number | string;
  /** Optional secondary value/label */
  subtitle?: string;
  /** Icon component */
  icon: LucideIcon;
  /** Link destination */
  href: string;
  /** Color theme */
  variant?: 'default' | 'warning' | 'success' | 'wine';
  /** Optional badge */
  badge?: {
    value: number | string;
    label: string;
    variant?: 'warning' | 'danger' | 'success';
  };
}

const variantStyles = {
  default: {
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  success: {
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  wine: {
    iconBg: 'bg-wine/10',
    iconColor: 'text-wine',
  },
};

const badgeStyles = {
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-green-100 text-green-700',
};

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  variant = 'default',
  badge,
}: SummaryCardProps) {
  const style = variantStyles[variant];

  return (
    <Link
      href={href}
      className={cn(
        'block bg-white border border-gray-200 rounded-lg p-4 transition-all',
        'hover:shadow-md hover:border-wine/30',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-lg', style.iconBg)}>
          <Icon className={cn('h-5 w-5', style.iconColor)} />
        </div>

        {badge && (
          <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            badgeStyles[badge.variant || 'warning']
          )}>
            {badge.value} {badge.label}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}

/**
 * Summary Card Grid - for displaying multiple summary cards
 */
export function SummaryCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 lg:px-6">
      {children}
    </div>
  );
}
