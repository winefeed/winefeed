/**
 * IMPORT STATUS BADGE
 *
 * Unified status badge for import case statuses using design system colors.
 * Used when displaying import status on orders, compliance checks, etc.
 */

'use client';

import { getStatusColor } from '@/lib/design-system/status-colors';

interface ImportStatusBadgeProps {
  status: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dot';
}

const IMPORT_STATUS_LABELS: Record<string, string> = {
  NOT_REGISTERED: 'Ej registrerad',
  SUBMITTED: 'Inskickad',
  APPROVED: 'Godkänd',
  REJECTED: 'Nekad',
  EXPIRED: 'Utgången',
};

export function ImportStatusBadge({ status, size = 'sm', variant = 'default' }: ImportStatusBadgeProps) {
  // Handle null/undefined status
  if (!status) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  const label = IMPORT_STATUS_LABELS[status] || status;
  const { badgeClass, dotClass } = getStatusColor(status, label);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  if (variant === 'dot') {
    // Dot variant for timeline/status indicators
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${dotClass}`}></div>
        <span className="text-sm font-medium">{label}</span>
      </div>
    );
  }

  // Default badge variant
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${badgeClass} ${sizeClasses[size]}`}
    >
      {label}
    </span>
  );
}
