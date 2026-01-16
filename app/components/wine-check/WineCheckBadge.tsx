/**
 * WINE CHECK BADGE
 *
 * Small badge components for Wine Check UI
 * - Mock/Live indicator
 * - Match status badge
 */

'use client';

import { MatchStatus } from './types';

/**
 * Mock Mode Badge
 * Shows when Wine-Searcher API is in mock mode (no API key configured)
 */
interface MockModeBadgeProps {
  mock: boolean;
}

export function MockModeBadge({ mock }: MockModeBadgeProps) {
  if (!mock) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full">
      Mock Mode
    </span>
  );
}

/**
 * Match Status Badge
 * Shows the quality/type of match found
 */
interface MatchStatusBadgeProps {
  status: MatchStatus;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

const MATCH_STATUS_CONFIG: Record<MatchStatus, {
  label: string;
  color: string;
  icon: string;
}> = {
  EXACT: {
    label: 'Exakt matchning',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: '✓'
  },
  FUZZY: {
    label: 'Nära matchning',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: '≈'
  },
  MULTIPLE: {
    label: 'Flera kandidater',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: '?'
  },
  NOT_FOUND: {
    label: 'Ej funnen',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: '×'
  },
  ERROR: {
    label: 'Fel',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: '!'
  },
  TEMP_UNAVAILABLE: {
    label: 'Tillfälligt otillgänglig',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: '⚠'
  }
};

export function MatchStatusBadge({ status, score, size = 'md' }: MatchStatusBadgeProps) {
  const config = MATCH_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center font-medium rounded-full border ${config.color} ${sizeClasses[size]}`}>
        <span className="mr-2">{config.icon}</span>
        {config.label}
      </span>
      {score !== null && score !== undefined && (
        <span className="text-sm text-muted-foreground">
          Matchning: {score}/100
        </span>
      )}
    </div>
  );
}
