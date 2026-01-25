/**
 * COMPLIANCE STATUS BADGE
 *
 * Visual indicator for compliance status:
 * - OK (complete) - green
 * - Action needed (missing fields) - amber
 * - Blocked (cannot proceed) - red
 */

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type ComplianceStatus = 'OK' | 'ACTION_NEEDED' | 'BLOCKED';

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG = {
  OK: {
    label: 'Komplett',
    icon: CheckCircle,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
  },
  ACTION_NEEDED: {
    label: 'Åtgärd krävs',
    icon: AlertTriangle,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
  },
  BLOCKED: {
    label: 'Blockerad',
    icon: XCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
  },
};

const SIZE_CONFIG = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    icon: 'h-5 w-5',
    gap: 'gap-2',
  },
};

export function ComplianceStatusBadge({
  status,
  label,
  showIcon = true,
  size = 'md',
}: ComplianceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding} rounded-full font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeConfig.text}`}
    >
      {showIcon && <Icon className={`${sizeConfig.icon} ${config.iconColor}`} />}
      {label || config.label}
    </span>
  );
}

/**
 * Compute compliance status from data
 */
export interface ComplianceCheckResult {
  status: ComplianceStatus;
  missingFields: MissingField[];
  blockReason?: string;
}

export interface MissingField {
  field: string;
  label: string;
  severity: 'required' | 'recommended';
  fixLocation?: string;
  fixUrl?: string;
}

/**
 * Check compliance status for an order line
 */
export function checkOrderLineCompliance(line: {
  gtin?: string | null;
  lwin?: string | null;
  abv?: number | null;
  volume_ml?: number | null;
  country?: string | null;
  packaging_type?: string | null;
}): ComplianceCheckResult {
  const missingFields: MissingField[] = [];

  // Required for import declaration
  if (!line.gtin && !line.lwin) {
    missingFields.push({
      field: 'product_identifier',
      label: 'Produktidentifierare (GTIN eller LWIN)',
      severity: 'required',
      fixLocation: 'Vinkatalog',
      fixUrl: '/supplier/wines',
    });
  }

  if (!line.abv) {
    missingFields.push({
      field: 'abv',
      label: 'Alkoholhalt (%)',
      severity: 'required',
      fixLocation: 'Vinkatalog',
      fixUrl: '/supplier/wines',
    });
  }

  if (!line.volume_ml) {
    missingFields.push({
      field: 'volume_ml',
      label: 'Volym (ml)',
      severity: 'required',
      fixLocation: 'Vinkatalog',
      fixUrl: '/supplier/wines',
    });
  }

  if (!line.country) {
    missingFields.push({
      field: 'country',
      label: 'Ursprungsland',
      severity: 'required',
      fixLocation: 'Vinkatalog',
      fixUrl: '/supplier/wines',
    });
  }

  // Recommended
  if (!line.packaging_type) {
    missingFields.push({
      field: 'packaging_type',
      label: 'Förpackningstyp',
      severity: 'recommended',
      fixLocation: 'Vinkatalog',
      fixUrl: '/supplier/wines',
    });
  }

  // Determine status
  const requiredMissing = missingFields.filter(f => f.severity === 'required');

  if (requiredMissing.length > 0) {
    return {
      status: 'ACTION_NEEDED',
      missingFields,
    };
  }

  if (missingFields.length > 0) {
    return {
      status: 'OK', // Only recommended fields missing
      missingFields,
    };
  }

  return {
    status: 'OK',
    missingFields: [],
  };
}

/**
 * Check compliance status for an import case
 */
export function checkImportCaseCompliance(importCase: {
  status: string;
  ddl_status?: string | null;
  has_document?: boolean;
  has_shipment?: boolean;
  lines?: Array<{
    gtin?: string | null;
    lwin?: string | null;
    abv?: number | null;
    volume_ml?: number | null;
    country?: string | null;
  }>;
}): ComplianceCheckResult {
  const missingFields: MissingField[] = [];
  let blockReason: string | undefined;

  // Check DDL status
  if (importCase.ddl_status === 'REJECTED') {
    return {
      status: 'BLOCKED',
      missingFields: [],
      blockReason: 'DDL-ansökan avvisad. Kontakta Systembolaget.',
    };
  }

  if (importCase.ddl_status === 'EXPIRED') {
    return {
      status: 'BLOCKED',
      missingFields: [],
      blockReason: 'DDL har gått ut. Förnya ansökan.',
    };
  }

  // Check document
  if (!importCase.has_document && importCase.status !== 'NOT_REGISTERED') {
    missingFields.push({
      field: 'document',
      label: '5369-dokument',
      severity: 'required',
      fixLocation: 'Generera dokument',
    });
  }

  // Check line compliance
  if (importCase.lines) {
    const incompleteLines = importCase.lines.filter(line => {
      return !line.gtin && !line.lwin || !line.abv || !line.volume_ml || !line.country;
    });

    if (incompleteLines.length > 0) {
      missingFields.push({
        field: 'line_data',
        label: `${incompleteLines.length} orderrad(er) saknar obligatoriska fält`,
        severity: 'required',
        fixLocation: 'Vinkatalog',
        fixUrl: '/supplier/wines',
      });
    }
  }

  // Determine status
  const requiredMissing = missingFields.filter(f => f.severity === 'required');

  if (requiredMissing.length > 0) {
    return {
      status: 'ACTION_NEEDED',
      missingFields,
    };
  }

  return {
    status: 'OK',
    missingFields,
  };
}
