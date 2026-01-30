'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { ButtonSpinner, Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { Wine } from 'lucide-react';

// Types matching API response
interface Wine {
  id: string;
  name: string;
  producer: string;
  country: string;
  region?: string;
  vintage?: number;
}

interface Offer {
  id: string;
  requestId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  wine: Wine;

  // Pricing (all in SEK, B2B = ex moms primary)
  offeredPriceExVatSek: number;
  vatRate: number;
  priceIncVatSek: number;
  quantity: number;
  totalExVatSek: number;
  totalIncVatSek: number;

  // Shipping
  isFranco: boolean; // true = frakt ingår i priset
  shippingCostSek: number | null;
  shippingNotes: string | null;
  totalWithShippingExVat: number;
  totalWithShippingIncVat: number;

  // Delivery
  deliveryDate: string;
  estimatedDeliveryDate: string;
  leadTimeDays: number;

  // Assignment & Matching
  matchScore: number;
  matchReasons: string[];
  assignmentStatus: 'SENT' | 'VIEWED' | 'RESPONDED' | 'EXPIRED';
  isExpired: boolean;

  // Sponsored info
  isSponsored: boolean;
  sponsoredCategories: string[];

  // Metadata
  notes?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface OfferSummary {
  total: number;
  active: number;
  expired: number;
}

interface OffersResponse {
  offers: Offer[];
  summary: OfferSummary;
}

interface AcceptResponse {
  commercialIntent: {
    id: string;
    quoteRequestId: string;
    acceptedOfferId: string;
    status: string;
    acceptedAt: string;
  };
  order: {
    wine: {
      name: string;
      producer: string;
    };
    supplier: {
      id: string;
    };
    pricing: {
      priceExVatSek: number;
      quantity: number;
      totalGoodsSek: number;
      vatRate: number;
      vatAmountSek: number;
      shippingSek: number;
      serviceFeeSek: number;
      totalPayableSek: number;
    };
    delivery: {
      estimatedDate: string;
      leadTimeDays: number;
    };
  };
  message: string;
}

interface ErrorResponse {
  errorCode?: string;
  error: string;
  details?: string;
  expiresAt?: string;
}

export default function OffersPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const toast = useToast();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [summary, setSummary] = useState<OfferSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeExpired, setIncludeExpired] = useState(false);

  // Accept state
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptedOffer, setAcceptedOffer] = useState<AcceptResponse | null>(null);
  const [acceptError, setAcceptError] = useState<ErrorResponse | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `/api/quote-requests/${requestId}/offers${includeExpired ? '?includeExpired=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch offers');
      }

      const data: OffersResponse = await response.json();
      setOffers(data.offers);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [requestId, includeExpired]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleAcceptOffer = async (offerId: string) => {
    try {
      setAccepting(offerId);
      setAcceptError(null);

      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        setAcceptError(data as ErrorResponse);
        return;
      }

      // Success!
      setAcceptedOffer(data as AcceptResponse);
      toast.success('Offert accepterad!', 'Din beställning har skapats');

      // Refresh offers to show updated state
      fetchOffers();

    } catch (err) {
      setAcceptError({
        error: err instanceof Error ? err.message : 'Unknown error',
        details: 'Ett oväntat fel uppstod vid acceptans av offert.'
      });
    } finally {
      setAccepting(null);
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getMatchScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-200';
    if (score >= 60) return 'bg-yellow-100 border-yellow-200';
    return 'bg-orange-100 border-orange-200';
  };

  const formatMatchReason = (reason: string) => {
    // Format: "region_match:25pts" → "Region match (25 pts)"
    const [type, points] = reason.split(':');
    const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `${typeLabel} (${points})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Wine className="h-12 w-12 text-wine" />
              <Spinner size="lg" className="absolute inset-0 text-wine/30" />
            </div>
          </div>
          <p className="text-xl font-medium text-foreground">Hämtar offerter...</p>
          <p className="text-sm text-muted-foreground mt-2">Laddar jämförelsedata</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-xl font-medium text-foreground mb-2">Kunde inte hämta offerter</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchOffers()}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  // Success modal
  if (acceptedOffer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-accent/10 flex items-center justify-center p-4">
        <div className="bg-card border-2 border-green-200 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 text-4xl mb-4">
              ✓
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Offert accepterad!</h1>
            <p className="text-muted-foreground">Din beställning har skapats</p>
          </div>

          <div className="space-y-4 mb-6">
            {/* Wine info */}
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Vin</p>
              <p className="text-lg font-semibold text-foreground">
                {acceptedOffer.order.wine.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {acceptedOffer.order.wine.producer}
              </p>
            </div>

            {/* Pricing breakdown - B2B ex moms */}
            <div className="p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Prissummering</p>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  B2B ex moms
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {acceptedOffer.order.pricing.quantity} flaskor × {formatPrice(acceptedOffer.order.pricing.priceExVatSek)}
                  </span>
                  <span className="font-medium">{formatPrice(acceptedOffer.order.pricing.totalGoodsSek)}</span>
                </div>
                {acceptedOffer.order.pricing.shippingSek > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🚚 Frakt</span>
                    <span className="font-medium">{formatPrice(acceptedOffer.order.pricing.shippingSek)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🚚 Frakt</span>
                    <span className="font-medium text-green-600">Fritt levererat</span>
                  </div>
                )}
                <div className="border-t-2 border-primary/30 pt-2 flex justify-between text-base">
                  <span className="font-bold text-foreground">Totalt ex moms</span>
                  <span className="font-bold text-primary text-lg">
                    {formatPrice(acceptedOffer.order.pricing.totalGoodsSek + (acceptedOffer.order.pricing.shippingSek || 0))}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span>Moms ({acceptedOffer.order.pricing.vatRate}%)</span>
                    <span>+{formatPrice(acceptedOffer.order.pricing.vatAmountSek)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Totalt inkl. moms</span>
                    <span>{formatPrice(acceptedOffer.order.pricing.totalPayableSek)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-green-600 pt-2">
                  <span>Serviceavgift (PILOT - gratis)</span>
                  <span>0 kr</span>
                </div>
              </div>
            </div>

            {/* Delivery info */}
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Beräknad leverans</p>
              <p className="text-lg font-semibold text-foreground">
                {new Date(acceptedOffer.order.delivery.estimatedDate).toLocaleDateString('sv-SE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                ({acceptedOffer.order.delivery.leadTimeDays} dagars leveranstid)
              </p>
            </div>

            {/* Order ID */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">Order-ID</p>
              <p className="font-mono text-sm text-foreground">
                {acceptedOffer.commercialIntent.id}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
            >
              Till Dashboard
            </button>
            <button
              onClick={() => router.push('/dashboard/new-request')}
              className="w-full px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-colors font-medium"
            >
              Ny offertförfrågan
            </button>
          </div>
        </div>
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
              <span className="text-4xl">🍷</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Winefeed</h1>
                <p className="text-sm text-primary-foreground/80">Mottagna offerter</p>
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
        {/* Summary Header */}
        {summary && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {summary.active} {summary.active === 1 ? 'offert' : 'offerter'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {summary.expired > 0 && `${summary.expired} utgångna`}
                </p>
              </div>

              {summary.expired > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExpired}
                    onChange={(e) => setIncludeExpired(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">Visa utgångna</span>
                </label>
              )}
            </div>

            {acceptError && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <p className="font-medium text-destructive mb-1">
                      {acceptError.errorCode === 'ALREADY_ACCEPTED' && 'Offert redan accepterad'}
                      {acceptError.errorCode === 'OFFER_EXPIRED' && 'Offert har gått ut'}
                      {!acceptError.errorCode && 'Kunde inte acceptera offert'}
                    </p>
                    <p className="text-sm text-destructive/80">{acceptError.details || acceptError.error}</p>
                    {acceptError.expiresAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Utgick: {new Date(acceptError.expiresAt).toLocaleString('sv-SE')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setAcceptError(null)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No offers */}
        {offers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl font-medium text-foreground mb-2">
              {includeExpired ? 'Inga offerter' : 'Inga aktiva offerter'}
            </p>
            <p className="text-sm text-muted-foreground">
              {includeExpired
                ? 'Det finns inga offerter för denna förfrågan ännu.'
                : 'Väntar på svar från leverantörer...'}
            </p>
          </div>
        )}

        {/* Offer Cards */}
        <div className="space-y-6">
          {offers.map((offer, index) => (
            <div
              key={offer.id}
              className={`bg-card border-2 rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden ${
                offer.isExpired
                  ? 'border-muted opacity-60'
                  : 'border-border'
              }`}
            >
              {/* Expired badge */}
              {offer.isExpired && (
                <div className="bg-muted text-muted-foreground text-center py-2 text-sm font-medium">
                  ⏱️ Offert utgången
                </div>
              )}

              {/* Card Header */}
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 border-b border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </span>
                      <h3 className="text-2xl font-bold text-foreground">
                        {offer.wine.name}
                      </h3>
                    </div>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span className="font-medium">{offer.wine.producer}</span>
                      <span>•</span>
                      <span>{offer.wine.country}</span>
                      {offer.wine.region && (
                        <>
                          <span>•</span>
                          <span>{offer.wine.region}</span>
                        </>
                      )}
                      {offer.wine.vintage && (
                        <>
                          <span>•</span>
                          <span>{offer.wine.vintage}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Match score badge */}
                  <div className={`px-3 py-2 rounded-xl border-2 ${getMatchScoreBg(offer.matchScore)}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Matchning</p>
                    <p className={`text-2xl font-bold ${getMatchScoreColor(offer.matchScore)}`}>
                      {offer.matchScore}%
                    </p>
                  </div>
                </div>

                {/* Match reasons */}
                {offer.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {offer.matchReasons.map((reason, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-accent/20 text-accent-foreground text-xs rounded-full"
                      >
                        {formatMatchReason(reason)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* Pricing - B2B: ex moms is primary */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <span>💰</span>
                      Prissättning
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-normal">
                        B2B ex moms
                      </span>
                    </h4>

                    <div className="space-y-2 text-sm">
                      {/* Wine price */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pris per flaska</span>
                        <span className="font-medium">{formatPrice(offer.offeredPriceExVatSek)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Antal</span>
                        <span className="font-medium">{offer.quantity} flaskor</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-foreground">Delsumma vin</span>
                        <span>{formatPrice(offer.totalExVatSek)}</span>
                      </div>

                      {/* Shipping */}
                      <div className="border-t border-border pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            🚚 Frakt
                            {offer.isFranco && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                Fritt
                              </span>
                            )}
                          </span>
                          <span className="font-medium">
                            {offer.isFranco ? (
                              <span className="text-green-600">Ingår i priset</span>
                            ) : offer.shippingCostSek ? (
                              formatPrice(offer.shippingCostSek)
                            ) : (
                              <span className="text-muted-foreground">Ej angiven</span>
                            )}
                          </span>
                        </div>
                        {offer.shippingNotes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {offer.shippingNotes}
                          </p>
                        )}
                      </div>

                      {/* Total ex moms - PRIMARY */}
                      <div className="border-t-2 border-primary/30 pt-3 mt-2">
                        <div className="flex justify-between text-lg">
                          <span className="font-bold text-foreground">Totalt ex moms</span>
                          <span className="font-bold text-primary text-xl">
                            {formatPrice(offer.totalWithShippingExVat || offer.totalExVatSek)}
                          </span>
                        </div>
                      </div>

                      {/* VAT info (secondary) */}
                      <div className="text-xs text-muted-foreground space-y-1 pt-1">
                        <div className="flex justify-between">
                          <span>Moms ({offer.vatRate}%)</span>
                          <span>
                            +{formatPrice((offer.totalWithShippingIncVat || offer.totalIncVatSek) - (offer.totalWithShippingExVat || offer.totalExVatSek))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Totalt inkl. moms</span>
                          <span>{formatPrice(offer.totalWithShippingIncVat || offer.totalIncVatSek)}</span>
                        </div>
                      </div>

                      <div className="pt-2 text-xs text-green-600 flex justify-between">
                        <span>Serviceavgift (PILOT)</span>
                        <span className="font-medium">0 kr - Gratis under pilotfas</span>
                      </div>
                    </div>
                  </div>

                  {/* Supplier & Delivery */}
                  <div className="space-y-4">
                    {/* Supplier */}
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-2">
                        <span>🏢</span>
                        Leverantör
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">{offer.supplierName}</p>
                        {offer.isSponsored && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            <span>✨</span>
                            Sponsrad
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{offer.supplierEmail}</p>
                    </div>

                    {/* Delivery */}
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-2">
                        <span>📦</span>
                        Leverans
                      </h4>
                      <p className="text-sm text-muted-foreground mb-1">Beräknad leverans</p>
                      <p className="font-medium text-foreground">
                        {new Date(offer.estimatedDeliveryDate).toLocaleDateString('sv-SE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leveranstid: {offer.leadTimeDays} dagar
                      </p>
                    </div>

                    {/* Assignment status */}
                    <div className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/20 rounded-full">
                        Status: {offer.assignmentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {offer.notes && (
                  <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-xl">
                    <p className="text-sm font-medium text-foreground mb-1">
                      💬 Meddelande från leverantör
                    </p>
                    <p className="text-sm text-foreground/80">{offer.notes}</p>
                  </div>
                )}

                {/* Action button */}
                <div className="flex items-center justify-end">
                  {offer.isExpired ? (
                    <div className="px-6 py-3 bg-muted text-muted-foreground rounded-xl text-sm font-medium">
                      ⏱️ Offert utgången
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAcceptOffer(offer.id)}
                      disabled={accepting !== null}
                      className={`px-8 py-3 rounded-xl font-medium shadow-lg transition-all ${
                        accepting === offer.id
                          ? 'bg-primary/50 text-primary-foreground cursor-wait'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl'
                      }`}
                    >
                      {accepting === offer.id ? (
                        <span className="flex items-center gap-2">
                          <ButtonSpinner className="text-white" />
                          Accepterar...
                        </span>
                      ) : (
                        <span>✓ Acceptera offert</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
