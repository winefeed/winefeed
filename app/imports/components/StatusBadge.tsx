'use client';

import { Tooltip } from './Tooltip';
import { getStatusColor } from '@/lib/design-system/status-colors';

interface StatusBadgeProps {
  status: string;
  type: 'case' | 'delivery_place';
  size?: 'sm' | 'md' | 'lg';
}

const CASE_STATUS_CONFIG = {
  NOT_REGISTERED: {
    label: 'Ej registrerad',
    tooltip: 'Ärendet är skapat men har inte skickats in till Skatteverket ännu. Generera dokument och skicka in för att fortsätta.',
  },
  SUBMITTED: {
    label: 'Inskickad',
    tooltip: 'Ärendet är inskickat och väntar på godkännande från Skatteverket. Kan ta 5-10 arbetsdagar.',
  },
  APPROVED: {
    label: 'Godkänd',
    tooltip: 'Ärendet är godkänt av Skatteverket. Leverans under uppskov kan nu genomföras till denna adress.',
  },
  REJECTED: {
    label: 'Avslagen',
    tooltip: 'Ärendet har nekats av Skatteverket. Läs avslagsbrev, åtgärda brister och skicka in igen.',
  },
};

const DELIVERY_PLACE_STATUS_CONFIG = {
  APPROVED: {
    label: 'Godkänd',
    tooltip: 'Denna adress är registrerad och godkänd som direkt leveransplats hos Skatteverket.',
  },
  NOT_REGISTERED: {
    label: 'Inte godkänd',
    tooltip: 'Denna adress är inte godkänd som direkt leveransplats än.',
  },
  SUBMITTED: {
    label: 'Väntar på godkännande',
    tooltip: 'Ansökan är inskickad och väntar på godkännande.',
  },
  REJECTED: {
    label: 'Nekad',
    tooltip: 'Ansökan har nekats av Skatteverket.',
  },
  EXPIRED: {
    label: 'Utgången',
    tooltip: 'Godkännandet har gått ut och måste förnyas.',
  },
};

export function StatusBadge({ status, type, size = 'md' }: StatusBadgeProps) {
  const config = type === 'case' ? CASE_STATUS_CONFIG : DELIVERY_PLACE_STATUS_CONFIG;
  const statusInfo = config[status as keyof typeof config] || {
    label: status,
    tooltip: 'Status okänd',
  };

  // Get unified status colors from design system
  const { badgeClass } = getStatusColor(status);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <Tooltip content={statusInfo.tooltip}>
      <span
        className={`inline-flex items-center font-medium rounded-full border ${badgeClass} ${sizeClasses[size]}`}
      >
        {statusInfo.label}
      </span>
    </Tooltip>
  );
}
