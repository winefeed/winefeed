/**
 * RESTAURANT VIEW: MY REQUESTS
 *
 * /dashboard/my-requests
 *
 * Shows all requests created by the restaurant
 * - See request status (OPEN, ACCEPTED)
 * - See offers count per request
 * - Navigate to request details
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RefreshCw, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Inbox, Info, X, Filter } from 'lucide-react';
import { RequestStatusBadge, ExpectationText } from '@/components/dashboard/RequestTimeline';
import { useActor } from '@/lib/hooks/useActor';
import { getErrorMessage } from '@/lib/utils';

interface RequestTracking {
  dispatched_to: number;
  viewed_by: number;
  responded_by: number;
  dispatched_at: string | null;
  expires_at: string | null;
}

interface Request {
  id: string;
  restaurant_id: string;
  freetext: string | null;
  budget_sek: number | null;
  quantity_bottles: number | null;
  delivery_date_requested: string | null;
  specialkrav: string[] | null;
  color?: string | null;
  status: string;
  accepted_offer_id: string | null;
  offers_count: number;
  new_offers_count: number;
  latest_offer_at: string | null;
  created_at: string;
  tracking: RequestTracking | null;
}

// Wine color config
const COLOR_CONFIG: Record<string, { label: string; emoji: string; border: string; bg: string }> = {
  red: { label: 'Rött', emoji: '🔴', border: 'border-l-red-500', bg: 'bg-red-50' },
  white: { label: 'Vitt', emoji: '⚪', border: 'border-l-amber-300', bg: 'bg-amber-50' },
  rose: { label: 'Rosé', emoji: '🩷', border: 'border-l-pink-400', bg: 'bg-pink-50' },
  sparkling: { label: 'Mousserande', emoji: '🟡', border: 'border-l-yellow-400', bg: 'bg-yellow-50' },
  orange: { label: 'Orange', emoji: '🟠', border: 'border-l-orange-400', bg: 'bg-orange-50' },
  fortified: { label: 'Starkvin', emoji: '🟤', border: 'border-l-amber-600', bg: 'bg-amber-100' },
};

type FilterOption = 'all' | 'waiting' | 'has_offers' | 'completed';
type SortOption = 'newest' | 'oldest';

export default function MyRequestsPage() {
  const router = useRouter();
  const { actor, loading: actorLoading } = useActor();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort, setSort] = useState<SortOption>('newest');

  useEffect(() => {
    if (!actorLoading && actor) {
      fetchRequests();
    }
  }, [actor, actorLoading]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all requests (not just OPEN) for the restaurant
      const response = await fetch('/api/requests?status=', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda förfrågningar'));
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort requests
  const filteredRequests = requests
    .filter(req => {
      if (filter === 'all') return true;
      if (filter === 'waiting') return req.offers_count === 0 && req.status === 'OPEN';
      if (filter === 'has_offers') return req.offers_count > 0 && req.status === 'OPEN';
      if (filter === 'completed') return req.status === 'ACCEPTED' || req.accepted_offer_id;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sort === 'newest' ? dateB - dateA : dateA - dateB;
    });

  // Extract wine type from freetext (simple heuristic)
  const getWineType = (req: Request): string | null => {
    if (req.color) return req.color;
    const text = (req.freetext || '').toLowerCase();
    if (text.includes('mousserande') || text.includes('champagne') || text.includes('cava') || text.includes('prosecco')) return 'sparkling';
    if (text.includes('rosé') || text.includes('rose')) return 'rose';
    if (text.includes('vitt') || text.includes('chardonnay') || text.includes('sauvignon')) return 'white';
    if (text.includes('rött') || text.includes('röd') || text.includes('cabernet') || text.includes('merlot') || text.includes('pinot noir')) return 'red';
    if (text.includes('orange')) return 'orange';
    if (text.includes('portvin') || text.includes('sherry') || text.includes('madeira')) return 'fortified';
    return null;
  };

  // Build structured title
  const getStructuredTitle = (req: Request): string => {
    const parts: string[] = [];
    const wineType = getWineType(req);
    if (wineType && COLOR_CONFIG[wineType]) {
      parts.push(COLOR_CONFIG[wineType].label);
    }
    if (req.quantity_bottles) {
      parts.push(`${req.quantity_bottles} flaskor`);
    }
    if (req.budget_sek) {
      parts.push(`max ${req.budget_sek} kr`);
    }
    return parts.length > 0 ? parts.join(' · ') : (req.freetext || 'Vinförfrågan');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Något gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchRequests}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mina förfrågningar</h1>
          <p className="text-muted-foreground mt-1">
            {filteredRequests.length} av {requests.length} förfråg{requests.length === 1 ? 'an' : 'ningar'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchRequests}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <button
            onClick={() => router.push('/dashboard/new-request')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny förfrågan
          </button>
        </div>
      </div>

      {/* Filter & Sort */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Alla' },
            { value: 'waiting', label: 'Väntar svar' },
            { value: 'has_offers', label: 'Har offerter' },
            { value: 'completed', label: 'Avslutade' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as FilterOption)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sortera:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg"
          >
            <option value="newest">Nyast först</option>
            <option value="oldest">Äldst först</option>
          </select>
        </div>
      </div>

      {/* Area A: Expectation setting info box (dismissible) */}
      {showInfoBox && requests.some(r => r.offers_count === 0 && r.status === 'OPEN') && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-800 font-medium">Så fungerar det</p>
            <p className="text-sm text-blue-700 mt-1">
              Din förfrågan skickas till matchade leverantörer. De flesta svar kommer inom 24-48 timmar.
              Du ser statusen uppdateras när leverantörer öppnar och svarar på din förfrågan.
            </p>
          </div>
          <button
            onClick={() => setShowInfoBox(false)}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
            title="Dölj"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {requests.length === 0 ? 'Inga förfrågningar än' : 'Inga förfrågningar matchar filtret'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {requests.length === 0
              ? 'Skapa din första vinförfrågan för att få offerter från leverantörer.'
              : 'Prova ett annat filter för att se fler förfrågningar.'}
          </p>
          {requests.length === 0 && (
            <button
              onClick={() => router.push('/dashboard/new-request')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors font-medium"
            >
              <Plus className="h-5 w-5" />
              Skapa förfrågan
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            // Navigate to offers if offers exist, otherwise to results
            const targetUrl = req.offers_count > 0
              ? `/dashboard/offers/${req.id}`
              : `/dashboard/results/${req.id}`;

            const isAccepted = req.status === 'ACCEPTED' || req.accepted_offer_id;
            const wineType = getWineType(req);
            const colorConfig = wineType ? COLOR_CONFIG[wineType] : null;
            const structuredTitle = getStructuredTitle(req);

            return (
              <div
                key={req.id}
                className={`bg-card border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer group ${
                  req.new_offers_count > 0
                    ? 'border-blue-300 bg-blue-50/30 hover:border-blue-400'
                    : isAccepted
                    ? 'border-green-200 hover:border-green-300'
                    : 'border-border hover:border-primary/30'
                }`}
                onClick={() => router.push(targetUrl)}
              >
                {/* Colored left border for wine type */}
                <div className={`flex ${colorConfig ? `border-l-4 ${colorConfig.border}` : ''}`}>
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Title with wine type emoji */}
                        <div className="flex items-center gap-2 mb-2">
                          {colorConfig && (
                            <span className="text-lg">{colorConfig.emoji}</span>
                          )}
                          <h3 className="text-lg font-semibold text-foreground">
                            {structuredTitle}
                          </h3>
                        </div>

                        {/* Status badges row */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <RequestStatusBadge
                            tracking={req.tracking}
                            offersCount={req.offers_count}
                            newOffersCount={req.new_offers_count}
                            status={req.status}
                          />
                          {req.new_offers_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full animate-pulse">
                              <AlertCircle className="h-3 w-3" />
                              {req.new_offers_count} nya
                            </span>
                          )}
                          {/* Tracking info */}
                          {req.tracking && req.tracking.dispatched_to > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Skickad till {req.tracking.dispatched_to} leverantörer
                              {req.tracking.responded_by > 0 && (
                                <> · {req.tracking.responded_by} har svarat</>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Freetext description (if different from structured title) */}
                        {req.freetext && req.freetext !== structuredTitle && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {req.freetext}
                          </p>
                        )}

                        {/* Additional details */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {req.delivery_date_requested && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Leverans: {new Date(req.delivery_date_requested).toLocaleDateString('sv-SE')}
                            </span>
                          )}
                          {req.specialkrav && req.specialkrav.length > 0 && (
                            <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                              {req.specialkrav.join(', ')}
                            </span>
                          )}
                          <span>
                            Skapad {new Date(req.created_at).toLocaleDateString('sv-SE', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        </div>

                        {/* Area A: Expectation text for requests without responses */}
                        {req.offers_count === 0 && !isAccepted && (
                          <div className="mt-2">
                            <ExpectationText tracking={req.tracking} offersCount={req.offers_count} />
                          </div>
                        )}
                      </div>

                      {/* Right side: Offers count and action */}
                      <div className="flex flex-col items-end gap-2 ml-4">
                        {/* Offers count */}
                        {req.offers_count > 0 && (
                          <span className="text-xl font-bold text-primary">
                            {req.offers_count} offert{req.offers_count > 1 ? 'er' : ''}
                          </span>
                        )}

                        {/* Action button */}
                        <span className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          req.offers_count > 0
                            ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                            : 'text-muted-foreground group-hover:text-primary'
                        }`}>
                          {req.offers_count > 0 ? 'Se offerter' : 'Se matchningar'}
                        </span>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
