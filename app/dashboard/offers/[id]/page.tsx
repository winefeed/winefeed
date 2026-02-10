'use client';

/**
 * RESTAURANT OFFER COMPARISON PAGE — Multi-Line Offers
 *
 * Shows supplier-grouped offer cards with nested wine lines.
 * Restaurant can accept whole offer or select individual lines (partial acceptance).
 * Multiple offers (from different suppliers) can be accepted per request.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { ButtonSpinner, Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { Wine, Check, Building2, Loader2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface OfferLine {
  id: string | null;
  supplierWineId: string | null;
  wineName: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  vintage: number | null;
  offeredPriceExVatSek: number;
  quantity: number;
  totalExVatSek: number;
  accepted: boolean | null;
}

interface Offer {
  id: string;
  requestId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  lines: OfferLine[];
  totalExVatSek: number;
  totalIncVatSek: number;
  vatRate: number;
  isFranco: boolean;
  shippingCostSek: number | null;
  shippingNotes: string | null;
  totalWithShippingExVat: number;
  totalWithShippingIncVat: number;
  deliveryDate: string;
  estimatedDeliveryDate: string;
  leadTimeDays: number;
  matchScore: number;
  matchReasons: string[];
  assignmentStatus: string;
  isExpired: boolean;
  minTotalQuantity: number | null;
  isSponsored: boolean;
  sponsoredCategories: string[];
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

  // Accept state per offer
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptedOffers, setAcceptedOffers] = useState<Set<string>>(new Set());
  const [acceptError, setAcceptError] = useState<{ offerId: string; message: string } | null>(null);

  // Line selection state: offerId → Set of selected lineIds
  const [selectedLines, setSelectedLines] = useState<Map<string, Set<string>>>(new Map());

  // Expanded offer cards
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());

  // Org number modal
  const [showOrgNumberModal, setShowOrgNumberModal] = useState(false);
  const [orgNumber, setOrgNumber] = useState('');
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [savingOrgNumber, setSavingOrgNumber] = useState(false);

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/quote-requests/${requestId}/offers${includeExpired ? '?includeExpired=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch offers');
      const data = await response.json();
      setOffers(data.offers);
      setSummary(data.summary);

      // Initialize line selections: all lines selected by default
      const lineMap = new Map<string, Set<string>>();
      for (const offer of data.offers) {
        const lineIds = new Set<string>();
        for (const line of offer.lines) {
          if (line.id) lineIds.add(line.id);
        }
        lineMap.set(offer.id, lineIds);
      }
      setSelectedLines(lineMap);

      // Auto-expand first offer
      if (data.offers.length > 0) {
        setExpandedOffers(new Set([data.offers[0].id]));
      }

      // Mark already accepted offers
      const accepted = new Set<string>();
      for (const offer of data.offers) {
        if (offer.status === 'ACCEPTED' || offer.status === 'PARTIALLY_ACCEPTED' || offer.status === 'accepted') {
          accepted.add(offer.id);
        }
      }
      setAcceptedOffers(accepted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [requestId, includeExpired]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  function toggleLineSelection(offerId: string, lineId: string) {
    setSelectedLines(prev => {
      const newMap = new Map(prev);
      const current = new Set(newMap.get(offerId) || []);
      if (current.has(lineId)) {
        current.delete(lineId);
      } else {
        current.add(lineId);
      }
      newMap.set(offerId, current);
      return newMap;
    });
  }

  function toggleAllLines(offerId: string, offer: Offer) {
    setSelectedLines(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(offerId) || new Set();
      const allLineIds = offer.lines.filter(l => l.id).map(l => l.id!);
      if (current.size === allLineIds.length) {
        newMap.set(offerId, new Set());
      } else {
        newMap.set(offerId, new Set(allLineIds));
      }
      return newMap;
    });
  }

  function getSelectedTotal(offer: Offer): { bottles: number; price: number } {
    const selected = selectedLines.get(offer.id) || new Set();
    let bottles = 0;
    let price = 0;
    for (const line of offer.lines) {
      if (line.id && selected.has(line.id)) {
        bottles += line.quantity;
        price += line.totalExVatSek;
      }
    }
    const shipping = offer.isFranco ? 0 : (offer.shippingCostSek || 0);
    return { bottles, price: price + shipping };
  }

  function toggleExpanded(offerId: string) {
    setExpandedOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(offerId)) {
        newSet.delete(offerId);
      } else {
        newSet.add(offerId);
      }
      return newSet;
    });
  }

  const handleAcceptOffer = async (offerId: string) => {
    try {
      setAccepting(offerId);
      setAcceptError(null);

      const selected = selectedLines.get(offerId) || new Set();
      const offer = offers.find(o => o.id === offerId);
      const allLineIds = offer?.lines.filter(l => l.id).map(l => l.id!) || [];
      const isPartial = selected.size > 0 && selected.size < allLineIds.length;

      // Validate MOQ
      if (offer?.minTotalQuantity && isPartial) {
        const selectedBottles = offer.lines
          .filter(l => l.id && selected.has(l.id))
          .reduce((sum, l) => sum + l.quantity, 0);
        if (selectedBottles < offer.minTotalQuantity) {
          setAcceptError({
            offerId,
            message: `Minst ${offer.minTotalQuantity} flaskor kravs (du har valt ${selectedBottles})`
          });
          setAccepting(null);
          return;
        }
      }

      const body: Record<string, any> = {};
      if (isPartial) {
        body.acceptedLineIds = [...selected];
      }

      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errorCode === 'ORG_NUMBER_REQUIRED') {
          setPendingOfferId(offerId);
          setShowOrgNumberModal(true);
        } else {
          setAcceptError({ offerId, message: data.error || data.details || 'Kunde inte acceptera offert' });
        }
        return;
      }

      setAcceptedOffers(prev => new Set([...prev, offerId]));
      toast.success('Offert accepterad!', isPartial ? 'Valda viner har bestellts' : 'Alla viner har bestellts');
      fetchOffers();
    } catch (err) {
      setAcceptError({ offerId, message: 'Ett ovantat fel uppstod' });
    } finally {
      setAccepting(null);
    }
  };

  const formatOrgNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 6) return digits;
    return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
  };

  const handleSaveOrgNumber = async () => {
    if (orgNumber.length !== 11) {
      toast.error('Ogiltigt format', 'XXXXXX-XXXX');
      return;
    }
    setSavingOrgNumber(true);
    try {
      const response = await fetch('/api/me/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_number: orgNumber })
      });
      if (!response.ok) throw new Error('Kunde inte spara');
      toast.success('Sparat!', 'Organisationsnummer har lagts till');
      setShowOrgNumberModal(false);
      setAcceptError(null);
      if (pendingOfferId) handleAcceptOffer(pendingOfferId);
    } catch {
      toast.error('Fel', 'Kunde inte spara organisationsnummer');
    } finally {
      setSavingOrgNumber(false);
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
          <p className="text-xl font-medium text-foreground">Hamtar offerter...</p>
          <p className="text-sm text-muted-foreground mt-2">Laddar jamforelsedata</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-xl font-medium text-foreground mb-2">Kunde inte hamta offerter</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button onClick={fetchOffers} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            Forsok igen
          </button>
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
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mottagna offerter</h1>
              <p className="text-sm text-primary-foreground/80">
                Valj viner och acceptera — du kan acceptera fran flera leverantorer
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors text-sm font-medium"
            >
              Tillbaka
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Summary */}
        {summary && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {summary.active} {summary.active === 1 ? 'offert' : 'offerter'}
              </h2>
              {acceptedOffers.size > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  {acceptedOffers.size} accepterade
                </p>
              )}
            </div>
            {summary.expired > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">Visa utgangna</span>
              </label>
            )}
          </div>
        )}

        {offers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl font-medium text-foreground mb-2">Inga aktiva offerter</p>
            <p className="text-sm text-muted-foreground">Vantar pa svar fran leverantorer...</p>
          </div>
        )}

        {/* Supplier-grouped Offer Cards */}
        <div className="space-y-6">
          {offers.map((offer) => {
            const isExpanded = expandedOffers.has(offer.id);
            const isAccepted = acceptedOffers.has(offer.id);
            const selected = selectedLines.get(offer.id) || new Set();
            const allLineIds = offer.lines.filter(l => l.id).map(l => l.id!);
            const allSelected = selected.size === allLineIds.length;
            const selectedTotals = getSelectedTotal(offer);
            const offerError = acceptError?.offerId === offer.id ? acceptError.message : null;

            return (
              <div
                key={offer.id}
                className={`bg-card border-2 rounded-2xl shadow-lg overflow-hidden transition-all ${
                  isAccepted ? 'border-green-300 bg-green-50/30' :
                  offer.isExpired ? 'border-muted opacity-60' : 'border-border'
                }`}
              >
                {/* Card Header — always visible */}
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(offer.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-xl font-bold text-foreground">{offer.supplierName}</h3>
                        {isAccepted && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                            <Check className="h-3 w-3" /> Accepterad
                          </span>
                        )}
                        {offer.isSponsored && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Sponsrad</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {offer.lines.length} viner · {offer.lines.reduce((s, l) => s + l.quantity, 0)} flaskor · {formatPrice(offer.totalWithShippingExVat)} ex moms
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leverans: {new Date(offer.deliveryDate).toLocaleDateString('sv-SE')} · {offer.leadTimeDays} dagar
                        {offer.isFranco && ' · Franco'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Match score */}
                      <div className={`px-3 py-2 rounded-xl border ${getMatchScoreBg(offer.matchScore)}`}>
                        <p className="text-xs text-muted-foreground">Match</p>
                        <p className={`text-xl font-bold ${getMatchScoreColor(offer.matchScore)}`}>{offer.matchScore}%</p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Match reasons */}
                  {offer.matchReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {offer.matchReasons.map((reason, i) => (
                        <span key={i} className="px-2 py-0.5 bg-accent/20 text-accent-foreground text-xs rounded-full">
                          {formatMatchReason(reason)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Wine Lines with checkboxes */}
                    <div className="px-6 py-4">
                      {/* Select all */}
                      {!isAccepted && offer.lines.length > 1 && (
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleAllLines(offer.id, offer)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-muted-foreground font-medium">Valj alla</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {offer.lines.map((line, i) => {
                          const isLineSelected = line.id ? selected.has(line.id) : true;
                          const lineAccepted = line.accepted;

                          return (
                            <div
                              key={line.id || i}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                lineAccepted === true ? 'bg-green-50 border border-green-200' :
                                lineAccepted === false ? 'bg-gray-50 border border-gray-200 opacity-50' :
                                isLineSelected ? 'bg-muted/30 border border-transparent' : 'bg-muted/10 border border-transparent opacity-60'
                              }`}
                            >
                              {/* Checkbox (only if not already accepted) */}
                              {!isAccepted && line.id && (
                                <input
                                  type="checkbox"
                                  checked={isLineSelected}
                                  onChange={() => toggleLineSelection(offer.id, line.id!)}
                                  className="rounded border-border text-primary focus:ring-primary flex-shrink-0"
                                />
                              )}

                              {/* Wine info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">
                                  {line.wineName}
                                  {line.vintage && <span className="text-muted-foreground ml-1">{line.vintage}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {line.producer}
                                  {line.country && ` · ${line.country}`}
                                  {line.region && ` · ${line.region}`}
                                </p>
                              </div>

                              {/* Price × Qty */}
                              <div className="text-right flex-shrink-0">
                                <p className="font-medium text-foreground">
                                  {line.quantity} fl × {formatPrice(line.offeredPriceExVatSek)}
                                </p>
                                <p className="text-sm font-bold text-primary">
                                  {formatPrice(line.totalExVatSek)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Shipping + Totals */}
                    <div className="px-6 py-4 bg-muted/20 border-t border-border">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frakt</span>
                          <span className="font-medium">
                            {offer.isFranco ? (
                              <span className="text-green-600">Fritt levererat</span>
                            ) : offer.shippingCostSek ? (
                              formatPrice(offer.shippingCostSek)
                            ) : (
                              'Ej angiven'
                            )}
                          </span>
                        </div>
                        {offer.shippingNotes && (
                          <p className="text-xs text-muted-foreground italic">{offer.shippingNotes}</p>
                        )}

                        {!isAccepted && selected.size < allLineIds.length && selected.size > 0 && (
                          <div className="flex justify-between font-medium text-foreground pt-2 border-t border-border">
                            <span>Valda ({selected.size} av {allLineIds.length} viner, {selectedTotals.bottles} fl)</span>
                            <span className="text-primary">{formatPrice(selectedTotals.price)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                          <span>Totalt ex moms</span>
                          <span className="text-primary text-lg">{formatPrice(offer.totalWithShippingExVat)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {offer.notes && (
                      <div className="px-6 py-3 bg-accent/10 border-t border-border">
                        <p className="text-sm text-foreground/80">
                          <span className="font-medium">Meddelande: </span>{offer.notes}
                        </p>
                      </div>
                    )}

                    {/* MOQ Warning */}
                    {offer.minTotalQuantity && !isAccepted && selected.size < allLineIds.length && selected.size > 0 && (
                      <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
                        <div className="flex items-center gap-2 text-sm text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            Minst {offer.minTotalQuantity} flaskor totalt kravs for denna leverantor
                            {selectedTotals.bottles < offer.minTotalQuantity && (
                              <span className="font-medium"> (du har valt {selectedTotals.bottles})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {offerError && (
                      <div className="px-6 py-3 bg-red-50 border-t border-red-200">
                        <p className="text-sm text-red-700">{offerError}</p>
                      </div>
                    )}

                    {/* Action */}
                    {!isAccepted && !offer.isExpired && (
                      <div className="px-6 py-4 border-t border-border">
                        <button
                          onClick={() => handleAcceptOffer(offer.id)}
                          disabled={accepting !== null || selected.size === 0}
                          className={`w-full px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
                            accepting === offer.id
                              ? 'bg-primary/50 text-primary-foreground cursor-wait'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {accepting === offer.id ? (
                            <span className="flex items-center justify-center gap-2">
                              <ButtonSpinner className="text-white" /> Accepterar...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Check className="h-4 w-4" />
                              {selected.size < allLineIds.length && selected.size > 0
                                ? `Acceptera ${selected.size} av ${allLineIds.length} viner`
                                : 'Acceptera offert'
                              }
                            </span>
                          )}
                        </button>
                      </div>
                    )}

                    {offer.isExpired && !isAccepted && (
                      <div className="px-6 py-4 border-t border-border text-center">
                        <p className="text-sm text-muted-foreground font-medium">Offert utgangen</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom nav */}
        {acceptedOffers.size > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg hover:bg-primary/90"
            >
              Till Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Org number modal */}
      {showOrgNumberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Building2 className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lagg till organisationsnummer</h3>
                <p className="text-sm text-gray-500">Kravs for fakturering</p>
              </div>
            </div>
            <div className="mb-6">
              <input
                type="text"
                value={orgNumber}
                onChange={(e) => setOrgNumber(formatOrgNumber(e.target.value))}
                maxLength={11}
                placeholder="XXXXXX-XXXX"
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowOrgNumberModal(false); setOrgNumber(''); }}
                disabled={savingOrgNumber}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveOrgNumber}
                disabled={savingOrgNumber || orgNumber.length !== 11}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingOrgNumber ? <><Loader2 className="h-4 w-4 animate-spin" /> Sparar...</> : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
