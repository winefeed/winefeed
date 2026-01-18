/**
 * MATCH STATUS BADGE COMPONENT
 *
 * Displays match status for a product line (offer_line, supplier_import_row, etc.)
 *
 * Shows:
 * - Status badge (AUTO_MATCH, SUGGESTED, PENDING_REVIEW, etc.)
 * - Confidence indicator
 * - Match method (GTIN_EXACT, CANONICAL_SUGGEST, etc.)
 * - Tooltip with explanation
 *
 * Uses unified design system colors from lib/design-system/status-colors.ts
 */

'use client';

import { useState } from 'react';
import { getStatusColor, getConfidenceColor } from '@/lib/design-system/status-colors';

interface MatchStatusBadgeProps {
  latest_match: {
    status: string;
    confidence: number;
    match_method: string;
    matched_entity_type?: string;
    matched_entity_id?: string;
    explanation?: string;
    created_at?: string;
  } | null;
  size?: 'sm' | 'md' | 'lg';
}

export function MatchStatusBadge({ latest_match, size = 'sm' }: MatchStatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!latest_match) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 border border-gray-300`}>
        <span>⚪</span>
        <span>No match</span>
      </div>
    );
  }

  const { status, confidence, match_method, explanation, matched_entity_type } = latest_match;

  // Status styling from design system
  const { badgeClass } = getStatusColor(status);

  // Status icons
  const statusIcons: Record<string, string> = {
    AUTO_MATCH: '✅',
    AUTO_MATCH_WITH_GUARDS: '🔵',
    SUGGESTED: '💡',
    CONFIRMED: '✓',
    REJECTED: '✗',
    PENDING_REVIEW: '⏳',
    NO_MATCH: '⚪',
  };
  const icon = statusIcons[status] || '⏳';

  // Confidence display
  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor = getConfidenceColor(confidence);

  // Method display name
  const methodLabels: Record<string, string> = {
    GTIN_EXACT: 'GTIN',
    LWIN_EXACT: 'LWIN',
    SKU_EXACT: 'SKU',
    CANONICAL_SUGGEST: 'Text',
    MANUAL: 'Manual',
    NO_MATCH: 'None'
  };
  const methodLabel = methodLabels[match_method] || match_method;

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-xs ${badgeClass} cursor-help`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-sm">{icon}</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{status.replace('_', ' ')}</span>
            {matched_entity_type && (
              <span className="text-xs opacity-75">({matched_entity_type})</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs opacity-90">
            <span>{methodLabel}</span>
            <span>•</span>
            <span className={confidenceColor}>{confidencePercent}%</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && explanation && (
        <div className="absolute z-10 top-full left-0 mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
          <p className="font-medium mb-1">Match Explanation:</p>
          <p className="opacity-90">{explanation}</p>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <p className="opacity-75">Method: {match_method}</p>
            <p className="opacity-75">Confidence: {confidencePercent}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
