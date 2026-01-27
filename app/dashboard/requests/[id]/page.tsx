/**
 * SUPPLIER VIEW: REQUEST DETAILS
 *
 * Shows request details + list of offers for this request
 * Allows supplier to create new offer
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActor } from '@/lib/hooks/useActor';
import { StepIndicator } from '@/components/ui/StepIndicator';

interface Request {
  id: string;
  restaurant_id: string;
  title: string | null;
  freetext: string | null;
  budget_sek: number | null;
  quantity_bottles: number | null;
  delivery_date_requested: string | null;
  status: string;
  accepted_offer_id: string | null;
  created_at: string;
}

interface Offer {
  id: string;
  status: string;
  supplier_id: string | null;
  title: string | null;
  currency: string;
  lines_count: number;
  total_ore: number;
  created_at: string;
  accepted_at: string | null;
}

export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<Request | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/requests/${requestId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch request');
      }

      const data = await response.json();
      setRequest(data.request);
      setOffers(data.offers || []);
    } catch (err: any) {
      console.error('Failed to fetch request:', err);
      setError(err.message || 'Kunde inte ladda request');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-xl">Laddar request...</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-xl text-destructive">{error || 'Request hittades inte'}</p>
      </div>
    );
  }

  const isAccepted = request.status === 'ACCEPTED';

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📋</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Request Details</h1>
                <p className="text-sm text-primary-foreground/80">{request.title || request.id.slice(0, 8)}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/requests')}
              className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors text-sm font-medium"
            >
              ← Tillbaka
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Step Indicator */}
        <div className="mb-6">
          <StepIndicator currentStep={2} />
        </div>

        {/* Status Badge */}
        {isAccepted && (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 text-green-800 border border-green-300 font-medium">
            <span className="text-lg">✅</span>
            <span>Request Accepted</span>
          </div>
        )}

        {/* Request Details */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Request Information</h2>
          {request.freetext && (
            <p className="text-sm text-muted-foreground mb-4">{request.freetext}</p>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {request.budget_sek && (
              <div>
                <p className="font-medium text-muted-foreground">Budget:</p>
                <p className="text-foreground">{request.budget_sek.toLocaleString('sv-SE')} SEK</p>
              </div>
            )}
            {request.quantity_bottles && (
              <div>
                <p className="font-medium text-muted-foreground">Quantity:</p>
                <p className="text-foreground">{request.quantity_bottles} flaskor</p>
              </div>
            )}
            {request.delivery_date_requested && (
              <div>
                <p className="font-medium text-muted-foreground">Requested Delivery:</p>
                <p className="text-foreground">{new Date(request.delivery_date_requested).toLocaleDateString('sv-SE')}</p>
              </div>
            )}
            <div>
              <p className="font-medium text-muted-foreground">Created:</p>
              <p className="text-foreground">{new Date(request.created_at).toLocaleDateString('sv-SE')}</p>
            </div>
          </div>
        </div>

        {/* Offers List */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Offers ({offers.length})</h2>
            {!isAccepted && (
              <button
                onClick={() => router.push(`/dashboard/requests/${requestId}/new-offer`)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                + Create Offer
              </button>
            )}
          </div>

          {offers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Inga offers ännu</p>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/offers/${offer.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{offer.title || 'Offer ' + offer.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {offer.lines_count} lines • {(offer.total_ore / 100).toFixed(2)} {offer.currency}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        offer.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                        offer.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {offer.status}
                      </div>
                      {offer.id === request.accepted_offer_id && (
                        <span className="text-lg">✅</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
