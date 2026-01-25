/**
 * COMPLIANCE CARD
 *
 * Combined component showing:
 * - Status badge (OK / Action needed / Blocked)
 * - Missing fields list (when applicable)
 * - Progress indicator (for import cases)
 * - Block reason (when blocked)
 */

import { AlertTriangle, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import {
  ComplianceStatusBadge,
  ComplianceStatus,
  MissingField,
} from './ComplianceStatusBadge';
import { MissingFieldsList } from './MissingFieldsList';
import {
  ComplianceProgressIndicator,
  ComplianceStep,
  getCompletionPercentage,
} from './ComplianceProgressIndicator';

interface ComplianceCardProps {
  title?: string;
  status: ComplianceStatus;
  missingFields?: MissingField[];
  blockReason?: string;
  steps?: ComplianceStep[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onActionClick?: () => void;
  actionLabel?: string;
}

export function ComplianceCard({
  title = 'Compliance-status',
  status,
  missingFields = [],
  blockReason,
  steps,
  collapsible = true,
  defaultExpanded = true,
  onActionClick,
  actionLabel,
}: ComplianceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Calculate completion if steps provided
  const completionPct = steps ? getCompletionPercentage(steps) : null;

  // Determine card styling based on status
  const cardStyles = {
    OK: 'border-green-200 bg-green-50/50',
    ACTION_NEEDED: 'border-amber-200 bg-amber-50/50',
    BLOCKED: 'border-red-200 bg-red-50/50',
  };

  const iconBg = {
    OK: 'bg-green-100',
    ACTION_NEEDED: 'bg-amber-100',
    BLOCKED: 'bg-red-100',
  };

  const iconColor = {
    OK: 'text-green-600',
    ACTION_NEEDED: 'text-amber-600',
    BLOCKED: 'text-red-600',
  };

  return (
    <div className={`rounded-lg border ${cardStyles[status]} overflow-hidden`}>
      {/* Header */}
      <div
        className={`p-4 flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={() => collapsible && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg[status]}`}>
            <Shield className={`h-5 w-5 ${iconColor[status]}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            {completionPct !== null && (
              <p className="text-sm text-gray-500">{completionPct}% komplett</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ComplianceStatusBadge status={status} />
          {collapsible && (
            <button className="p-1 text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Block reason */}
          {status === 'BLOCKED' && blockReason && (
            <div className="p-3 bg-red-100 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800">Blockerad</p>
                <p className="text-sm text-red-700 mt-1">{blockReason}</p>
              </div>
            </div>
          )}

          {/* Progress indicator */}
          {steps && steps.length > 0 && (
            <div className="py-2">
              <ComplianceProgressIndicator steps={steps} />
            </div>
          )}

          {/* Missing fields */}
          {status === 'ACTION_NEEDED' && missingFields.length > 0 && (
            <MissingFieldsList fields={missingFields} />
          )}

          {/* Action button */}
          {onActionClick && actionLabel && status !== 'OK' && (
            <button
              onClick={onActionClick}
              className={`w-full py-2 px-4 rounded-lg font-medium text-sm ${
                status === 'BLOCKED'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {actionLabel}
            </button>
          )}

          {/* Success message */}
          {status === 'OK' && (
            <p className="text-sm text-green-700 text-center py-2">
              Alla compliance-krav är uppfyllda
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline version for table rows
 */
interface ComplianceInlineProps {
  status: ComplianceStatus;
  missingCount?: number;
  blockReason?: string;
}

export function ComplianceInline({
  status,
  missingCount,
  blockReason,
}: ComplianceInlineProps) {
  return (
    <div className="flex items-center gap-2">
      <ComplianceStatusBadge status={status} size="sm" />
      {status === 'ACTION_NEEDED' && missingCount && missingCount > 0 && (
        <span className="text-xs text-amber-600">
          {missingCount} fält saknas
        </span>
      )}
      {status === 'BLOCKED' && blockReason && (
        <span className="text-xs text-red-600" title={blockReason}>
          {blockReason.substring(0, 30)}...
        </span>
      )}
    </div>
  );
}
