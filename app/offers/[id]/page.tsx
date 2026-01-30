/**
 * OFFER EDITOR PAGE - PILOT LOOP 1.0
 *
 * DB-driven: Fetch/update/accept offer via API
 *
 * Features:
 * - DRAFT mode: Editable with save button
 * - ACCEPTED mode: Read-only with snapshot display
 * - Wine Check per line (controlled mode, allowlist only)
 * - Accept flow with immutability
 * - Events timeline
 * - Status badges
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OfferLineItemRow } from '../components/OfferLineItemRow';
import { OfferStatusBadge } from '../components/OfferStatusBadge';
import { MatchStatusBadge } from '@/app/components/match/MatchStatusBadge';
import type { MatchStatus } from '@/app/components/wine-check/types';
import { getAlertColor } from '@/lib/design-system/alert-colors';
import { ButtonSpinner } from '@/components/ui/spinner';

interface Offer {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  request_id: string | null;
  supplier_id: string | null;
  title: string | null;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  accepted_at: string | null;
  locked_at: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface OfferLine {
  id: string;
  offer_id: string;
  line_no: number;
  name: string;
  vintage: number | null;
  quantity: number;
  offered_unit_price_ore: number | null;
  bottle_ml: number | null;
  packaging: string | null;
  canonical_name: string | null;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  ws_id: string | null;
  match_status: string | null;
  match_score: number | null;
  created_at: string;
  updated_at: string;
  latest_match?: {
    status: string;
    confidence: number;
    match_method: string;
    matched_entity_type?: string;
    matched_entity_id?: string;
    explanation?: string;
    created_at?: string;
  } | null;
}

interface OfferEvent {
  id: string;
  offer_id: string;
  event_type: string;
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface OfferData {
  offer: Offer;
  lines: OfferLine[];
  events: OfferEvent[];
}

export default function OfferEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const offerId = params.id;

  const [data, setData] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [matchingLineId, setMatchingLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch offer from API
  const fetchOffer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/offers/${offerId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load offer');
      }

      const offerData: OfferData = await response.json();
      setData(offerData);
    } catch (err) {
      console.error('Failed to load offer:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda offert'));
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  const handleUpdateLine = (index: number, updatedLine: Partial<OfferLine>) => {
    if (!data) return;

    const newLines = [...data.lines];
    newLines[index] = { ...newLines[index], ...updatedLine };

    setData({
      ...data,
      lines: newLines
    });
  };

  const handleRemoveLine = (index: number) => {
    if (!data) return;

    const newLines = data.lines.filter((_, i) => i !== index);

    setData({
      ...data,
      lines: newLines
    });
  };

  const handleAddLine = () => {
    if (!data) return;

    const maxLineNo = data.lines.reduce((max, line) => Math.max(max, line.line_no), 0);

    const newLine: OfferLine = {
      id: `temp-${Date.now()}`, // Temporary ID until saved
      offer_id: offerId,
      line_no: maxLineNo + 1,
      name: '',
      vintage: null,
      quantity: 1,
      offered_unit_price_ore: null,
      bottle_ml: 750,
      packaging: null,
      canonical_name: null,
      producer: null,
      country: null,
      region: null,
      appellation: null,
      ws_id: null,
      match_status: null,
      match_score: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setData({
      ...data,
      lines: [...data.lines, newLine]
    });
  };

  const handleUpdateTitle = (title: string) => {
    if (!data) return;

    setData({
      ...data,
      offer: { ...data.offer, title }
    });
  };

  const handleMatchLine = async (lineId: string) => {
    if (!data) return;

    try {
      setMatchingLineId(lineId);
      setError(null);

      const response = await fetch(`/api/offer-lines/${lineId}/match`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to match line');
      }

      const result = await response.json();

      // Refetch offer to get updated latest_match
      await fetchOffer();

      // Show success message
      const matchData = result.latest_match;
      if (matchData.status === 'AUTO_MATCH' || matchData.status === 'AUTO_MATCH_WITH_GUARDS') {
        alert(`Match successful! ${matchData.explanation}`);
      } else if (matchData.status === 'SUGGESTED') {
        alert(`Match suggested (needs review): ${matchData.explanation}`);
      } else {
        alert(`Match result: ${matchData.explanation}`);
      }
    } catch (err) {
      console.error('Failed to match line:', err);
      setError(getErrorMessage(err, 'Kunde inte matcha rad'));
      alert(`Kunde inte matcha rad: ${getErrorMessage(err)}`);
    } finally {
      setMatchingLineId(null);
    }
  };

  const handleSave = async () => {
    if (!data) return;

    try {
      setSaving(true);
      setError(null);

      // Prepare lines for API (map enrichment fields)
      const linesToUpdate = data.lines.map((line) => ({
        id: line.id.startsWith('temp-') ? undefined : line.id,
        line_no: line.line_no,
        name: line.name,
        vintage: line.vintage,
        quantity: line.quantity,
        offered_unit_price_ore: line.offered_unit_price_ore,
        bottle_ml: line.bottle_ml,
        packaging: line.packaging,
        enrichment: {
          canonical_name: line.canonical_name,
          producer: line.producer,
          country: line.country,
          region: line.region,
          appellation: line.appellation,
          ws_id: line.ws_id,
          match_status: line.match_status,
          match_score: line.match_score
        }
      }));

      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offer: {
            title: data.offer.title
          },
          lines: linesToUpdate
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save offer');
      }

      // Refetch to get updated data with real IDs
      await fetchOffer();

      alert('Offert sparad!');
    } catch (err) {
      console.error('Failed to save offer:', err);
      setError(getErrorMessage(err, 'Kunde inte spara offert'));
      alert(`Kunde inte spara offert: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    if (!data) return;

    if (!confirm('Är du säker på att du vill acceptera denna offert? Efter acceptans blir den låst och går inte att ändra.')) {
      return;
    }

    try {
      setAccepting(true);
      setError(null);

      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept offer');
      }

      // Refetch to show accepted state
      await fetchOffer();

      alert('Offert accepterad! Offerten är nu låst och går inte att ändra.');
    } catch (err) {
      console.error('Failed to accept offer:', err);
      setError(getErrorMessage(err, 'Kunde inte acceptera offert'));
      alert(`Kunde inte acceptera offert: ${getErrorMessage(err)}`);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-xl font-medium text-foreground">Laddar offert...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-xl font-medium text-foreground mb-2">{error || 'Offert hittades inte'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { offer, lines, events } = data;
  const isReadOnly = offer.status !== 'DRAFT';

  // Calculate total
  const total = lines.every((line) => line.offered_unit_price_ore !== null)
    ? lines.reduce((sum, line) => sum + (line.offered_unit_price_ore || 0) * line.quantity, 0) / 100
    : null;

  // Status badge styling moved to OfferStatusBadge component

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📝</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isReadOnly ? 'Offert (Låst)' : 'Offerteditor'}
                </h1>
                <p className="text-sm text-primary-foreground/80">
                  {isReadOnly ? 'Visa accepterad offert' : 'Skapa och redigera offert'}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors text-sm font-medium"
            >
              ← Tillbaka
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Badge */}
        <div className="mb-6 flex items-center gap-4">
          <div>
            <OfferStatusBadge status={offer.status} size="lg" />
          </div>

          {offer.locked_at && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium ${getAlertColor('NEUTRAL').badgeClass}`}>
              <span className="text-lg">🔒</span>
              <span>Låst snapshot finns</span>
            </div>
          )}
        </div>

        {/* Read-Only Warning */}
        {isReadOnly && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-1">Offert är låst</p>
                <p className="text-orange-700">
                  Denna offert har status <strong>{offer.status}</strong> och kan inte längre redigeras.
                  {offer.accepted_at && (
                    <> Accepterad: {new Date(offer.accepted_at).toLocaleString('sv-SE')}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Offer Header */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Offertrubrik
              </label>
              <input
                type="text"
                value={offer.title || ''}
                onChange={(e) => handleUpdateTitle(e.target.value)}
                placeholder="T.ex. Vinleverans Q1 2026"
                disabled={isReadOnly}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium">Valuta:</p>
                <p>{offer.currency}</p>
              </div>
              <div>
                <p className="font-medium">Skapad:</p>
                <p>{new Date(offer.created_at).toLocaleString('sv-SE')}</p>
              </div>
              {offer.accepted_at && (
                <div>
                  <p className="font-medium">Accepterad:</p>
                  <p className="text-green-700 font-semibold">{new Date(offer.accepted_at).toLocaleString('sv-SE')}</p>
                </div>
              )}
              {offer.locked_at && (
                <div>
                  <p className="font-medium">Låst:</p>
                  <p className="text-purple-700 font-semibold">{new Date(offer.locked_at).toLocaleString('sv-SE')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wine Check Info (only in DRAFT mode) */}
        {!isReadOnly && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Wine Check-integration aktiverad</p>
                <p className="text-blue-700">
                  Klicka på &quot;🔍 Wine Check&quot; vid varje rad för att verifiera och normalisera vinnamn med Wine-Searcher.
                  Endast allowlist-data (namn, producent, region) sparas. <strong>INGEN prisdata.</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Line Items */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Vinrader ({lines.length})
            </h2>
            {!isReadOnly && (
              <button
                onClick={handleAddLine}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                + Lägg till rad
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <p className="text-muted-foreground mb-4">Inga vinrader ännu</p>
              {!isReadOnly && (
                <button
                  onClick={handleAddLine}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  + Lägg till första raden
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={line.id} className="space-y-2">
                  {/* Match Status & Actions */}
                  <div className="flex items-center justify-between gap-4 px-4 py-2 bg-gray-50 rounded-t-lg border border-b-0 border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Rad {line.line_no}
                      </span>
                      <MatchStatusBadge latest_match={line.latest_match || null} />
                    </div>
                    <button
                      onClick={() => handleMatchLine(line.id)}
                      disabled={matchingLineId === line.id}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      {matchingLineId === line.id ? (
                        <>
                          <ButtonSpinner className="text-white" />
                          <span>Matching...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>Match</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Line Item Row */}
                  <OfferLineItemRow
                    lineItem={{
                      id: line.id,
                      name: line.name,
                      vintage: line.vintage,
                      quantity: line.quantity,
                      unit_price: line.offered_unit_price_ore !== null ? line.offered_unit_price_ore / 100 : null,
                      enrichment: line.canonical_name || line.producer ? {
                        canonical_name: line.canonical_name,
                        producer: line.producer,
                        country: line.country,
                        region: line.region,
                        appellation: line.appellation,
                        ws_id: line.ws_id,
                        match_status: line.match_status as MatchStatus | null,
                        match_score: line.match_score,
                        checked_at: line.updated_at
                      } : null,
                      created_at: line.created_at,
                      updated_at: line.updated_at
                    }}
                    onUpdate={(updated) => handleUpdateLine(index, {
                      name: updated.name,
                      vintage: updated.vintage,
                      quantity: updated.quantity,
                      offered_unit_price_ore: updated.unit_price !== null ? Math.round(updated.unit_price * 100) : null,
                      bottle_ml: line.bottle_ml,
                      packaging: line.packaging,
                      canonical_name: updated.enrichment?.canonical_name || null,
                      producer: updated.enrichment?.producer || null,
                      country: updated.enrichment?.country || null,
                      region: updated.enrichment?.region || null,
                      appellation: updated.enrichment?.appellation || null,
                      ws_id: updated.enrichment?.ws_id || null,
                      match_status: updated.enrichment?.match_status || null,
                      match_score: updated.enrichment?.match_score || null
                    })}
                    onRemove={() => { if (!isReadOnly) handleRemoveLine(index); }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total Summary */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Totalsumma</h3>
            <div className="text-right">
              {total !== null ? (
                <p className="text-2xl font-bold text-primary">{total.toFixed(2)} kr</p>
              ) : (
                <p className="text-muted-foreground text-sm">Fyll i alla priser för att se total</p>
              )}
            </div>
          </div>
        </div>

        {/* Events Timeline */}
        {events && events.length > 0 && (
          <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Händelser</h3>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 text-sm border-l-2 border-blue-500 pl-4 py-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {event.event_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString('sv-SE')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {!isReadOnly && offer.status === 'DRAFT' && (
              <button
                onClick={handleAccept}
                disabled={accepting || lines.length === 0}
                className="px-8 py-3 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {accepting ? 'Accepterar...' : '✓ Acceptera offert (låser)'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Sparar...' : '💾 Spara ändringar'}
              </button>
            )}
          </div>
        </div>

        {/* Pilot Loop Status */}
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <p className="font-medium mb-1">✅ Pilot Loop 1.0 Aktiv</p>
          <p>
            Denna offert är DB-driven och använder API för alla operationer.
            Immutabilitet enforced efter acceptans via locked_at + snapshot.
          </p>
        </div>
      </div>
    </div>
  );
}
