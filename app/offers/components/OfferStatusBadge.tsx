/**
 * OFFER STATUS BADGE
 *
 * Unified status badge for offer statuses using design system colors.
 */

'use client';

import { getStatusColor } from '@/lib/design-system/status-colors';

interface OfferStatusBadgeProps {
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  size?: 'sm' | 'md' | 'lg';
}

const OFFER_STATUS_ICONS: Record<string, string> = {
  DRAFT: '📝',
  SENT: '📤',
  ACCEPTED: '✅',
  REJECTED: '❌',
};

const OFFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Utkast',
  SENT: 'Skickad',
  ACCEPTED: 'Accepterad',
  REJECTED: 'Avslagen',
};

export function OfferStatusBadge({ status, size = 'md' }: OfferStatusBadgeProps) {
  const icon = OFFER_STATUS_ICONS[status] || '';
  const label = OFFER_STATUS_LABELS[status] || status;
  const { badgeClass } = getStatusColor(status, label);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg border ${badgeClass} ${sizeClasses[size]}`}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </span>
  );
}
