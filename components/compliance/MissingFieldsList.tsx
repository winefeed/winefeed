/**
 * MISSING FIELDS LIST
 *
 * Compact list showing which fields are missing and where to fix them.
 * Only shows when there are issues - no noise when everything is OK.
 */

import { AlertTriangle, ExternalLink, AlertCircle } from 'lucide-react';
import { MissingField } from './ComplianceStatusBadge';

interface MissingFieldsListProps {
  fields: MissingField[];
  compact?: boolean;
  showLinks?: boolean;
}

export function MissingFieldsList({
  fields,
  compact = false,
  showLinks = true,
}: MissingFieldsListProps) {
  if (fields.length === 0) return null;

  const requiredFields = fields.filter(f => f.severity === 'required');
  const recommendedFields = fields.filter(f => f.severity === 'recommended');

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {requiredFields.map((field, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded border border-red-200"
            title={`Obligatoriskt: ${field.label}`}
          >
            <AlertCircle className="h-3 w-3" />
            {field.label}
          </span>
        ))}
        {recommendedFields.map((field, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200"
            title={`Rekommenderat: ${field.label}`}
          >
            {field.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Required fields */}
      {requiredFields.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-800 text-sm">
              Obligatoriska fält saknas ({requiredFields.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {requiredFields.map((field, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm">
                <span className="text-red-700">{field.label}</span>
                {showLinks && field.fixUrl && (
                  <a
                    href={field.fixUrl}
                    className="text-red-600 hover:text-red-800 hover:underline flex items-center gap-1 text-xs"
                  >
                    Åtgärda i {field.fixLocation}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {showLinks && !field.fixUrl && field.fixLocation && (
                  <span className="text-red-600 text-xs">{field.fixLocation}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended fields */}
      {recommendedFields.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-amber-800 text-sm">
              Rekommenderade fält saknas ({recommendedFields.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {recommendedFields.map((field, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm">
                <span className="text-amber-700">{field.label}</span>
                {showLinks && field.fixUrl && (
                  <a
                    href={field.fixUrl}
                    className="text-amber-600 hover:text-amber-800 hover:underline flex items-center gap-1 text-xs"
                  >
                    {field.fixLocation}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Inline version for table rows
 */
interface InlineMissingFieldsProps {
  fields: MissingField[];
  maxShow?: number;
}

export function InlineMissingFields({ fields, maxShow = 3 }: InlineMissingFieldsProps) {
  if (fields.length === 0) return null;

  const required = fields.filter(f => f.severity === 'required');
  const toShow = required.slice(0, maxShow);
  const remaining = required.length - maxShow;

  return (
    <div className="text-xs text-red-600">
      <span>Saknas: </span>
      {toShow.map((f, i) => (
        <span key={i}>
          {f.label}
          {i < toShow.length - 1 && ', '}
        </span>
      ))}
      {remaining > 0 && <span className="text-red-500"> +{remaining} till</span>}
    </div>
  );
}
