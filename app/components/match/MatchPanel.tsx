/**
 * MATCH PANEL
 *
 * Detailed view of match result with explanation and candidates
 * Shows why a match was made and alternative options
 */

'use client';

import type { MatchProductOutput, MatchCandidate } from '@/lib/match-service';
import { MatchStatusBadge } from './MatchStatusBadge';

interface MatchPanelProps {
  result: MatchProductOutput;
  onConfirm?: (candidateId: string) => void;
  onReject?: () => void;
  showActions?: boolean;
}

export function MatchPanel({
  result,
  onConfirm,
  onReject,
  showActions = false
}: MatchPanelProps) {
  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-4">
      {/* Header: Status Badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Matchningsresultat</h4>
        <MatchStatusBadge status={result.status} confidence={result.confidence} />
      </div>

      {/* Explanation */}
      <div className="p-3 rounded-lg bg-muted/30 text-sm text-foreground">
        <p className="font-medium text-muted-foreground mb-1">Förklaring:</p>
        <p>{result.explanation}</p>
      </div>

      {/* Match Details */}
      {result.matched_entity_id && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Metod:</p>
            <p className="font-medium text-foreground">{result.match_method}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Entitet:</p>
            <p className="font-medium text-foreground">{result.matched_entity_type}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground mb-0.5">ID:</p>
            <p className="font-mono text-xs text-foreground break-all">{result.matched_entity_id}</p>
          </div>
        </div>
      )}

      {/* Candidates */}
      {result.candidates && result.candidates.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Alternativa kandidater ({result.candidates.length})
          </p>
          <div className="space-y-2">
            {result.candidates.map((candidate, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-muted/20 border border-border text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{candidate.reason}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {candidate.entity_type} • {Math.round(candidate.score * 100)}% match
                    </p>
                  </div>
                  {showActions && onConfirm && (
                    <button
                      onClick={() => onConfirm(candidate.entity_id)}
                      className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Välj
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions (optional) */}
      {showActions && (result.status === 'SUGGESTED' || result.status === 'PENDING_REVIEW') && (
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          {onConfirm && result.matched_entity_id && (
            <button
              onClick={() => onConfirm(result.matched_entity_id!)}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              ✓ Bekräfta match
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="px-4 py-2 text-sm font-medium border border-destructive text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
            >
              ✕ Avvisa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
