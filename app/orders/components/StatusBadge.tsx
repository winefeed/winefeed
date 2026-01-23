/**
 * ORDER STATUS BADGE
 *
 * Unified status badge for order statuses using design system colors.
 */

'use client';

import { getStatusColor } from '@/lib/design-system/status-colors';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_SUPPLIER_CONFIRMATION: 'Väntar på leverantör',
  CONFIRMED: 'Bekräftad',
  IN_FULFILLMENT: 'I leverans',
  SHIPPED: 'Skickad',
  DELIVERED: 'Levererad',
  CANCELLED: 'Avbruten',
};

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const { badgeClass } = getStatusColor(status, label);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full text-white ${badgeClass} ${sizeClasses[size]}`}
    >
      {label}
    </span>
  );
}
