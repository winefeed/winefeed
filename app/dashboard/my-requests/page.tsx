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
import { FileText, RefreshCw, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Inbox, Info } from 'lucide-react';
import { RequestStatusBadge, ExpectationText } from '@/components/dashboard/RequestTimeline';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000001'; // MVP: Simulated auth

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
  status: string;
  accepted_offer_id: string | null;
  offers_count: number;
  new_offers_count: number;
  latest_offer_at: string | null;
  created_at: string;
  tracking: RequestTracking | null;
}

// Status config removed - now using RequestStatusBadge component

export default function MyRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all requests (not just OPEN) for the restaurant
      const response = await fetch('/api/requests?status=', {
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-user-id': USER_ID
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      console.error('Failed to fetch requests:', err);
      setError(err.message || 'Kunde inte ladda förfrågningar');
    } finally {
      setLoading(false);
    }
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mina förfrågningar</h1>
          <p className="text-muted-foreground mt-1">
            {requests.length} förfråg{requests.length === 1 ? 'an' : 'ningar'}
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

      {/* Area A: Expectation setting info box (only show if there are open requests without responses) */}
      {requests.some(r => r.offers_count === 0 && r.status === 'OPEN') && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">Så fungerar det</p>
            <p className="text-sm text-blue-700 mt-1">
              Din förfrågan skickas till matchade leverantörer. De flesta svar kommer inom 24-48 timmar.
              Du ser statusen uppdateras när leverantörer öppnar och svarar på din förfrågan.
            </p>
          </div>
        </div>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Inga förfrågningar än</h3>
          <p className="text-muted-foreground mb-6">
            Skapa din första vinförfrågan för att få offerter från leverantörer.
          </p>
          <button
            onClick={() => router.push('/dashboard/new-request')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors font-medium"
          >
            <Plus className="h-5 w-5" />
            Skapa förfrågan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            // Navigate to offers if offers exist, otherwise to results
            const targetUrl = req.offers_count > 0
              ? `/dashboard/offers/${req.id}`
              : `/dashboard/results/${req.id}`;

            const isAccepted = req.status === 'ACCEPTED' || req.accepted_offer_id;

            return (
              <div
                key={req.id}
                className={`bg-card border-2 rounded-lg p-6 hover:shadow-md transition-all cursor-pointer group ${
                  req.new_offers_count > 0
                    ? 'border-blue-300 bg-blue-50/30 hover:border-blue-400'
                    : isAccepted
                    ? 'border-green-200 hover:border-green-300'
                    : 'border-border hover:border-primary/30'
                }`}
                onClick={() => router.push(targetUrl)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Status badge - Area A: Now shows tracking info */}
                    <div className="flex items-center gap-3 mb-3">
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
                    </div>

                    {/* Request description */}
                    <p className="text-foreground font-medium line-clamp-2 mb-3">
                      {req.freetext || 'Ingen beskrivning'}
                    </p>

                    {/* Request details */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {req.budget_sek && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-foreground">{req.budget_sek}</span> kr/flaska
                        </span>
                      )}
                      {req.quantity_bottles && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-foreground">{req.quantity_bottles}</span> flaskor
                        </span>
                      )}
                      {req.delivery_date_requested && (
                        <span>
                          Leverans: {new Date(req.delivery_date_requested).toLocaleDateString('sv-SE')}
                        </span>
                      )}
                      {req.specialkrav && req.specialkrav.length > 0 && (
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                          {req.specialkrav.join(', ')}
                        </span>
                      )}
                    </div>

                    {/* Area A: Expectation text for requests without responses */}
                    {req.offers_count === 0 && !isAccepted && (
                      <div className="mt-3">
                        <ExpectationText tracking={req.tracking} offersCount={req.offers_count} />
                      </div>
                    )}

                    {/* Created date and latest offer */}
                    <div className="flex items-center gap-4 mt-3">
                      <p className="text-xs text-muted-foreground">
                        Skapad {new Date(req.created_at).toLocaleDateString('sv-SE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      {req.latest_offer_at && (
                        <p className="text-xs text-blue-600 font-medium">
                          Senaste offert: {new Date(req.latest_offer_at).toLocaleDateString('sv-SE', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side: Offers count and action */}
                  <div className="flex flex-col items-end gap-3 ml-4">
                    {/* Offers count */}
                    {req.offers_count > 0 && (
                      <span className="text-lg font-bold text-primary">
                        {req.offers_count} offert{req.offers_count > 1 ? 'er' : ''}
                      </span>
                    )}

                    {/* Action text */}
                    <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                      {req.offers_count > 0 ? 'Granska offerter' : 'Visa status'}
                    </span>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
