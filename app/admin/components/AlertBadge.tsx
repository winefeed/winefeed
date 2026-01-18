/**
 * ALERT BADGE COMPONENT
 *
 * Reusable badge for admin alerts with consistent design system colors.
 * Used in pilot admin console for alert counts and severity indicators.
 *
 * Features:
 * - Shows count with severity-based colors
 * - Supports optional icon
 * - Uses unified alert color system
 */

'use client';

import { AlertSeverity, getAlertColor } from '@/lib/design-system/alert-colors';

interface AlertBadgeProps {
  count: number;
  severity?: AlertSeverity | 'EMAIL_FAILURE';
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AlertBadge({ count, severity, icon, size = 'md' }: AlertBadgeProps) {
  // Determine severity based on count if not provided
  const effectiveSeverity = severity || (count > 0 ? 'ERROR' : 'OK');

  const { badgeClass } = getAlertColor(effectiveSeverity);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-3 py-1 text-lg',
    lg: 'px-4 py-2 text-xl',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${badgeClass} ${sizeClasses[size]}`}>
      {icon && <span>{icon}</span>}
      {count}
    </span>
  );
}
