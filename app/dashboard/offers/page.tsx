/**
 * RESTAURANT OFFERS INBOX
 *
 * /dashboard/offers
 *
 * Shows all incoming offers for the restaurant grouped by request
 * - See offer count per request
 * - See new/pending/accepted status
 * - Navigate to compare offers for each request
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, ChevronRight, Clock, CheckCircle2, AlertCircle, Inbox, FileText, ArrowRight } from 'lucide-react';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000001'; // MVP: Simulated auth

interface RequestWithOffers {
  id: string;
  freetext: string | null;
  budget_sek: number | null;
  quantity_bottles: number | null;
  status: string;
  created_at: string;
  offers_count: number;
  new_offers_count: number;
  latest_offer_at: string | null;
  accepted_offer_id: string | null;
}

interface OffersSummary {
  total_offers: number;
  new_offers: number;
  pending_requests: number;
  accepted_requests: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  has_new: { label: 'Nya offerter', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: AlertCircle },
  waiting: { label: 'Väntar på offerter', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  accepted: { label: 'Offert accepterad', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
  pending: { label: 'Offerter att granska', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: FileText },
};

export default function RestaurantOffersPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestWithOffers[]>([]);
  const [summary, setSummary] = useState<OffersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'pending' | 'accepted'>('all');

  useEffect(() => {
    fetchRequestsWithOffers();
  }, []);

  const fetchRequestsWithOffers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all requests with offer counts
      const response = await fetch('/api/requests?include_offers=true', {
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-user-id': USER_ID
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      const requestsData: RequestWithOffers[] = data.requests || [];

      // Calculate summary
      const summaryData: OffersSummary = {
        total_offers: requestsData.reduce((sum, r) => sum + (r.offers_count || 0), 0),
        new_offers: requestsData.reduce((sum, r) => sum + (r.new_offers_count || 0), 0),
        pending_requests: requestsData.filter(r => r.offers_count > 0 && !r.accepted_offer_id).length,
        accepted_requests: requestsData.filter(r => r.accepted_offer_id).length,
      };

      setRequests(requestsData);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to fetch requests:', err);
      setError(err.message || 'Kunde inte ladda offerter');
    } finally {
      setLoading(false);
    }
  };

  const getRequestStatus = (req: RequestWithOffers) => {
    if (req.accepted_offer_id) return 'accepted';
    if (req.new_offers_count > 0) return 'has_new';
    if (req.offers_count > 0) return 'pending';
    return 'waiting';
  };

  const filteredRequests = requests.filter(req => {
    const status = getRequestStatus(req);
    if (filter === 'all') return true;
    if (filter === 'new') return status === 'has_new';
    if (filter === 'pending') return status === 'pending' || status === 'has_new';
    if (filter === 'accepted') return status === 'accepted';
    return true;
  });

  // Sort: new offers first, then by latest offer date
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const statusA = getRequestStatus(a);
    const statusB = getRequestStatus(b);

    // New offers first
    if (statusA === 'has_new' && statusB !== 'has_new') return -1;
    if (statusB === 'has_new' && statusA !== 'has_new') return 1;

    // Then by latest offer date
    if (a.latest_offer_at && b.latest_offer_at) {
      return new Date(b.latest_offer_at).getTime() - new Date(a.latest_offer_at).getTime();
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
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
            onClick={fetchRequestsWithOffers}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inkommande offerter</h1>
          <p className="text-muted-foreground mt-1">
            Granska och acceptera offerter från leverantörer
          </p>
        </div>
        <button
          onClick={fetchRequestsWithOffers}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Uppdatera
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.total_offers}</p>
                <p className="text-sm text-muted-foreground">Totalt offerter</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{summary.new_offers}</p>
                <p className="text-sm text-muted-foreground">Nya offerter</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{summary.pending_requests}</p>
                <p className="text-sm text-muted-foreground">Att granska</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{summary.accepted_requests}</p>
                <p className="text-sm text-muted-foreground">Accepterade</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {[
          { key: 'all', label: 'Alla' },
          { key: 'new', label: 'Nya' },
          { key: 'pending', label: 'Att granska' },
          { key: 'accepted', label: 'Accepterade' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {sortedRequests.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <Inbox className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {filter === 'all' ? 'Inga offerter än' : `Inga ${filter === 'new' ? 'nya' : filter === 'accepted' ? 'accepterade' : 'offerter att granska'}`}
          </h3>
          <p className="text-muted-foreground mb-6">
            {filter === 'all'
              ? 'När leverantörer svarar på dina förfrågningar visas de här.'
              : 'Prova att ändra filter eller skapa en ny förfrågan.'}
          </p>
          <button
            onClick={() => router.push('/dashboard/new-request')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors font-medium"
          >
            Skapa ny förfrågan
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRequests.map((req) => {
            const status = getRequestStatus(req);
            const statusConfig = STATUS_CONFIG[status];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={req.id}
                className={`bg-card border-2 rounded-xl p-6 hover:shadow-md transition-all cursor-pointer group ${
                  status === 'has_new' ? 'border-blue-300 bg-blue-50/30' : 'border-border hover:border-primary/30'
                }`}
                onClick={() => router.push(`/dashboard/offers/${req.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Status badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusConfig.label}
                      </span>
                      {req.offers_count > 0 && (
                        <span className="text-sm font-semibold text-primary">
                          {req.offers_count} offert{req.offers_count > 1 ? 'er' : ''}
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
                      <span>
                        Skapad {new Date(req.created_at).toLocaleDateString('sv-SE', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      {req.latest_offer_at && (
                        <span className="text-blue-600 font-medium">
                          Senaste offert: {new Date(req.latest_offer_at).toLocaleDateString('sv-SE', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action arrow */}
                  <div className="ml-4 flex items-center gap-2">
                    {status !== 'waiting' && (
                      <span className="text-sm font-medium text-primary group-hover:underline">
                        {status === 'accepted' ? 'Visa offert' : 'Granska offerter'}
                      </span>
                    )}
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
