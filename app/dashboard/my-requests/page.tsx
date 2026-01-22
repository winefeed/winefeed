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
import { FileText, RefreshCw, Plus, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

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
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  OPEN: { label: 'Väntar på svar', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  ACCEPTED: { label: 'Offert accepterad', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
  CLOSED: { label: 'Avslutad', color: 'bg-gray-100 text-gray-600 border-gray-300', icon: CheckCircle2 },
};

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
          'x-tenant-id': TENANT_ID
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
            const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.OPEN;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={req.id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => router.push(`/dashboard/results/${req.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
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

                    {/* Created date */}
                    <p className="text-xs text-muted-foreground mt-3">
                      Skapad {new Date(req.created_at).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Right side: Status and offers */}
                  <div className="flex flex-col items-end gap-3 ml-4">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {statusConfig.label}
                    </span>

                    {/* Offers count */}
                    {req.offers_count > 0 && (
                      <span className="text-sm font-medium text-primary">
                        {req.offers_count} offert{req.offers_count > 1 ? 'er' : ''}
                      </span>
                    )}

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
