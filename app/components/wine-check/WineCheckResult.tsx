/**
 * WINE CHECK RESULT
 *
 * Displays Wine Check result with allowlist fields only
 * - Canonical name
 * - Producer
 * - Region/Appellation
 * - Match status and score
 *
 * NO PRICE DATA
 */

'use client';

import { WineCheckResult as WineCheckResultType } from './types';
import { MatchStatusBadge } from './WineCheckBadge';

interface WineCheckResultProps {
  result: WineCheckResultType;
  compact?: boolean;
}

export function WineCheckResult({ result, compact = false }: WineCheckResultProps) {
  const hasData = result.canonical_name || result.producer || result.region || result.appellation;

  if (!hasData) {
    return (
      <div className="border border-border rounded-lg p-4 bg-muted/10">
        <MatchStatusBadge status={result.match_status} score={result.match_score} />
        <p className="text-sm text-muted-foreground mt-2">
          {result.match_status === 'NOT_FOUND' && 'Ingen matchning hittades i Wine-Searcher databasen.'}
          {result.match_status === 'ERROR' && 'Ett fel uppstod vid kontroll. Försök igen senare.'}
          {result.match_status === 'TEMP_UNAVAILABLE' && 'Wine-Searcher är tillfälligt otillgänglig. Försök igen senare.'}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
      {/* Status Badge */}
      <MatchStatusBadge status={result.match_status} score={result.match_score} />

      {/* Main Result */}
      <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
        {result.canonical_name && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              Normaliserat namn
            </p>
            <p className={compact ? 'font-semibold text-sm' : 'font-semibold text-base'}>
              {result.canonical_name}
            </p>
          </div>
        )}

        {result.producer && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              Producent
            </p>
            <p className="text-sm">{result.producer}</p>
          </div>
        )}

        {(result.region || result.appellation) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              Region
            </p>
            <p className="text-sm">
              {result.region}
              {result.appellation && result.region && ' • '}
              {result.appellation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
