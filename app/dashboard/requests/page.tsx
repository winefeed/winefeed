/**
 * SUPPLIER VIEW: REQUESTS LIST
 *
 * Shows all OPEN quote requests for supplier to review
 *
 * Marketplace view:
 * - Suppliers see all open requests in tenant
 * - Can create offers for any request
 * - Shows request details + offers count
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActor } from '@/lib/hooks/useActor';

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
  offers_count: number;
  created_at: string;
}

export default function RequestsListPage() {
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

      const response = await fetch('/api/requests?status=OPEN', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda requests'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-xl">Laddar requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-xl text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📋</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Quote Requests</h1>
                <p className="text-sm text-primary-foreground/80">Öppna förfrågningar från restauranger</p>
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
        {requests.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <p className="text-muted-foreground text-lg">Inga öppna requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/requests/${req.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {req.title || 'Request ' + req.id.slice(0, 8)}
                    </h3>
                    {req.freetext && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {req.freetext}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {req.budget_sek && (
                        <span>Budget: {req.budget_sek.toLocaleString('sv-SE')} SEK</span>
                      )}
                      {req.quantity_bottles && (
                        <span>Qty: {req.quantity_bottles} flaskor</span>
                      )}
                      {req.delivery_date_requested && (
                        <span>Leverans: {new Date(req.delivery_date_requested).toLocaleDateString('sv-SE')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('sv-SE')}
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-medium">
                      <span>📤</span>
                      <span>{req.offers_count} offers</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
