/**
 * WINE CHECK CANDIDATES
 *
 * Displays alternative wine matches (max 3)
 * Allows user to select a candidate
 *
 * Used when match_status is MULTIPLE or FUZZY
 */

'use client';

import { Button } from '@/components/ui/button';
import { WineCheckCandidate } from './types';

interface WineCheckCandidatesProps {
  candidates: WineCheckCandidate[];
  onSelect?: (candidate: WineCheckCandidate) => void;
  showSelectButton?: boolean;
  isPersisting?: boolean;
}

export function WineCheckCandidates({
  candidates,
  onSelect,
  showSelectButton = false,
  isPersisting = false
}: WineCheckCandidatesProps) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Limit to top 3 candidates
  const topCandidates = candidates.slice(0, 3);

  return (
    <div className="pt-3 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Alternativa kandidater ({topCandidates.length})
      </p>
      <div className="space-y-2">
        {topCandidates.map((candidate, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded bg-muted/30 text-sm space-y-1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium text-sm">{candidate.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {candidate.producer}
                  {(candidate.region || candidate.appellation) && (
                    <> • {candidate.region || candidate.appellation}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {candidate.score}/100
                </span>
                {showSelectButton && onSelect && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelect(candidate)}
                    disabled={isPersisting}
                    className="text-xs h-7 px-2"
                  >
                    {isPersisting ? (
                      <>
                        <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sparar...
                      </>
                    ) : (
                      'Välj'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
