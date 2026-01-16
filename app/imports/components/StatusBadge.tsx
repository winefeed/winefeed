'use client';

import { Tooltip } from './Tooltip';

interface StatusBadgeProps {
  status: string;
  type: 'case' | 'delivery_place';
  size?: 'sm' | 'md' | 'lg';
}

const CASE_STATUS_CONFIG = {
  NOT_REGISTERED: {
    label: 'Ej registrerad',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    tooltip: 'Ärendet är skapat men har inte skickats in till Skatteverket ännu. Generera dokument och skicka in för att fortsätta.',
  },
  SUBMITTED: {
    label: 'Inskickad',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    tooltip: 'Ärendet är inskickat och väntar på godkännande från Skatteverket. Kan ta 5-10 arbetsdagar.',
  },
  APPROVED: {
    label: 'Godkänd',
    color: 'bg-green-100 text-green-800 border-green-300',
    tooltip: 'Ärendet är godkänt av Skatteverket. Leverans under uppskov kan nu genomföras till denna adress.',
  },
  REJECTED: {
    label: 'Avslagen',
    color: 'bg-red-100 text-red-800 border-red-300',
    tooltip: 'Ärendet har nekats av Skatteverket. Läs avslagsbrev, åtgärda brister och skicka in igen.',
  },
};

const DELIVERY_PLACE_STATUS_CONFIG = {
  APPROVED: {
    label: 'Godkänd',
    color: 'bg-green-100 text-green-800 border-green-300',
    tooltip: 'Denna adress är registrerad och godkänd som direkt leveransplats hos Skatteverket.',
  },
  NOT_REGISTERED: {
    label: 'Inte godkänd',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    tooltip: 'Denna adress är inte godkänd som direkt leveransplats än.',
  },
  SUBMITTED: {
    label: 'Väntar på godkännande',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    tooltip: 'Ansökan är inskickad och väntar på godkännande.',
  },
  REJECTED: {
    label: 'Nekad',
    color: 'bg-red-100 text-red-800 border-red-300',
    tooltip: 'Ansökan har nekats av Skatteverket.',
  },
  EXPIRED: {
    label: 'Utgången',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    tooltip: 'Godkännandet har gått ut och måste förnyas.',
  },
};

export function StatusBadge({ status, type, size = 'md' }: StatusBadgeProps) {
  const config = type === 'case' ? CASE_STATUS_CONFIG : DELIVERY_PLACE_STATUS_CONFIG;
  const statusInfo = config[status as keyof typeof config] || {
    label: status,
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    tooltip: 'Status okänd',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <Tooltip content={statusInfo.tooltip}>
      <span
        className={`inline-flex items-center font-medium rounded-full border ${statusInfo.color} ${sizeClasses[size]}`}
      >
        {statusInfo.label}
      </span>
    </Tooltip>
  );
}
