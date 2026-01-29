/**
 * WINE CHECK PANEL
 *
 * Reusable container component for Wine Check functionality
 * Supports two modes:
 * - Standalone: Manual input by user
 * - Controlled: Pre-filled inputs with callback for selection
 *
 * NO PRICE DATA - Allowlist only
 */

'use client';

import { useEffect, useState } from 'react';
import { useWineCheck } from './useWineCheck';
import { WineCheckForm } from './WineCheckForm';
import { WineCheckResult } from './WineCheckResult';
import { WineCheckCandidates } from './WineCheckCandidates';
import { MockModeBadge } from './WineCheckBadge';
import { WineCheckCandidate } from './types';
import { getErrorMessage } from '@/lib/utils';

interface WineCheckPanelProps {
  // Mode
  mode?: 'standalone' | 'controlled';

  // Controlled mode props
  initialName?: string;
  initialVintage?: string;
  onSelectCandidate?: (candidate: WineCheckCandidate) => void;

  // Persistence (optional)
  persistSelection?: (candidate: WineCheckCandidate) => Promise<void>;
  persistLabel?: string;

  // UI customization
  title?: string;
  description?: string;
  compact?: boolean;
  hideVintage?: boolean;
}

export function WineCheckPanel({
  mode = 'standalone',
  initialName,
  initialVintage,
  onSelectCandidate,
  persistSelection,
  persistLabel = 'Spara val',
  title = 'Wine Check',
  description = 'Verifierar och normaliserar vinnamn med Wine-Searcher API. Visar ENDAST normaliserat namn, producent, region - INGEN prisdata.',
  compact = false,
  hideVintage = false
}: WineCheckPanelProps) {
  const {
    name,
    vintage,
    loading,
    error,
    result,
    mock,
    setName,
    setVintage,
    runCheck,
    reset
  } = useWineCheck();

  // Persist state
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistSuccess, setPersistSuccess] = useState<string | null>(null);

  // Initialize with props in controlled mode
  useEffect(() => {
    if (mode === 'controlled') {
      if (initialName) setName(initialName);
      if (initialVintage) setVintage(initialVintage);
    }
  }, [mode, initialName, initialVintage, setName, setVintage]);

  const handleSelectCandidate = async (candidate: WineCheckCandidate) => {
    // Clear previous persist messages
    setPersistError(null);
    setPersistSuccess(null);

    // 1. Call onSelectCandidate callback (always, if provided)
    if (onSelectCandidate) {
      onSelectCandidate(candidate);
    }

    // 2. Optionally persist selection
    if (persistSelection) {
      setIsPersisting(true);
      try {
        await persistSelection(candidate);
        setPersistSuccess('Val sparat');

        // Clear success message after 3 seconds
        setTimeout(() => setPersistSuccess(null), 3000);
      } catch (err) {
        setPersistError(getErrorMessage(err, 'Kunde inte spara val'));
      } finally {
        setIsPersisting(false);
      }
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <MockModeBadge mock={mock} />
        </div>
      </div>

      {/* Description (optional) */}
      {description && !compact && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Autosave Info */}
      {mode === 'controlled' && (
        <div className="p-2 rounded bg-muted/20 text-xs text-muted-foreground">
          {persistSelection ? (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Valet sparas automatiskt</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Valet uppdaterar bara raden lokalt (ingen autosparning)</span>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <WineCheckForm
        name={name}
        vintage={vintage}
        onChangeName={setName}
        onChangeVintage={setVintage}
        onSubmit={() => runCheck()}
        loading={loading}
        hideVintage={hideVintage}
        compact={compact}
      />

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium">Fel vid kontroll</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <WineCheckResult result={result} compact={compact} />
          <WineCheckCandidates
            candidates={result.candidates}
            onSelect={handleSelectCandidate}
            showSelectButton={mode === 'controlled' && !!onSelectCandidate}
            isPersisting={isPersisting}
          />

          {/* Persist Success Message */}
          {persistSuccess && (
            <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">{persistSuccess}</p>
              </div>
            </div>
          )}

          {/* Persist Error Message */}
          {persistError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">Kunde inte spara val</p>
                  <p className="text-xs mt-1">{persistError}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset button (standalone mode only) */}
      {mode === 'standalone' && result && (
        <button
          onClick={reset}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Rensa och sök igen
        </button>
      )}
    </div>
  );
}
