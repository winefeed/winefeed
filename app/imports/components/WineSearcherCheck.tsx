'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from './Tooltip';

/**
 * WINE-SEARCHER CHECK COMPONENT
 *
 * Purpose: Display Wine-Searcher Wine Check results - NO PRICE DATA
 * Shows: canonical_name, producer, region, appellation, match_score, match_status, candidates
 *
 * CRITICAL: This component ONLY displays allowlist fields
 */

interface WineCandidate {
  name: string;
  producer: string;
  region?: string;
  appellation?: string;
  score: number;
}

interface WineCheckResult {
  canonical_name: string | null;
  producer: string | null;
  region: string | null;
  appellation: string | null;
  match_score: number | null;
  match_status: 'EXACT' | 'FUZZY' | 'MULTIPLE' | 'NOT_FOUND' | 'ERROR';
  candidates: WineCandidate[];
}

interface WineSearcherCheckProps {
  wineName: string;
  vintage?: string;
  onSelect?: (result: WineCheckResult) => void;
}

const MATCH_STATUS_CONFIG = {
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
  }
};

export function WineSearcherCheck({ wineName, vintage, onSelect }: WineSearcherCheckProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WineCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        name: wineName,
        ...(vintage && { vintage })
      });

      const response = await fetch(`/api/enrich/wine-searcher/check?${params.toString()}`, {
        headers: {
          'x-tenant-id': '00000000-0000-0000-0000-000000000001' // TODO: Get from context
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check wine');
      }

      const data = await response.json();

      // SECURITY CHECK: Validate no forbidden fields
      const serialized = JSON.stringify(data);
      if (/price|offer|currency|market|cost|value|\$|€|£/i.test(serialized)) {
        throw new Error('SECURITY VIOLATION: Forbidden data detected');
      }

      setResult(data);

      if (onSelect) {
        onSelect(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = result ? MATCH_STATUS_CONFIG[result.match_status] : null;

  return (
    <div className="space-y-4">
      {/* Check Button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleCheck}
          disabled={loading || !wineName}
          variant="outline"
          size="sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Kontrollerar...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Kontrollera med Wine-Searcher
            </>
          )}
        </Button>

        <Tooltip content="Verifierar och normaliserar vinnamn med Wine-Searcher API. Visar ENDAST normaliserat namn, producent, region - INGEN prisdata.">
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </span>
        </Tooltip>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Fel vid kontroll</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && statusInfo && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border ${statusInfo.color}`}>
              <span className="mr-2">{statusInfo.icon}</span>
              {statusInfo.label}
            </span>
            {result.match_score !== null && (
              <span className="text-sm text-muted-foreground">
                Matchning: {result.match_score}/100
              </span>
            )}
          </div>

          {/* Main Result */}
          {result.canonical_name && (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Normaliserat namn</p>
                <p className="font-semibold">{result.canonical_name}</p>
              </div>

              {result.producer && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Producent</p>
                  <p>{result.producer}</p>
                </div>
              )}

              {(result.region || result.appellation) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Region</p>
                  <p>
                    {result.region}
                    {result.appellation && ` • ${result.appellation}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Candidates (for MULTIPLE/FUZZY) */}
          {result.candidates && result.candidates.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Alternativa kandidater ({result.candidates.length})
              </p>
              <div className="space-y-2">
                {result.candidates.map((candidate, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-muted/30 text-sm space-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium">{candidate.name}</p>
                      <span className="text-xs text-muted-foreground ml-2">
                        {candidate.score}/100
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {candidate.producer}
                      {(candidate.region || candidate.appellation) && (
                        <> • {candidate.region || candidate.appellation}</>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
