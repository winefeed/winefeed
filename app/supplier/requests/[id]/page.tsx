'use client';

/**
 * SUPPLIER REQUEST DETAIL PAGE — Multi-Wine Offer Form
 *
 * Shows full details of a quote request and allows creating a
 * multi-line offer with all wines from this supplier.
 */

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Wine,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  MapPin,
  Calendar,
  Send,
  Loader2,
  AlertTriangle,
  X,
  Package,
} from 'lucide-react';

interface RequestItem {
  id: string;
  wineId: string;
  wineName: string;
  producer: string;
  country: string;
  region?: string;
  vintage?: number;
  color?: string;
  quantity: number;
  priceSek: number | null;
  moq: number;
  provorder: boolean;
  provorderFee?: number;
}

interface QuoteRequest {
  id: string;
  restaurantId: string;
  restaurantName: string;
  fritext: string;
  budgetPerFlaska: number | null;
  antalFlaskor: number | null;
  leveransSenast: string | null;
  leveransOrt: string | null;
  specialkrav: string[];
  createdAt: string;
  assignment: {
    id: string;
    status: string;
    matchScore: number;
    matchReasons: string[];
    sentAt: string;
    viewedAt?: string;
    respondedAt?: string;
    expiresAt: string;
    isExpired: boolean;
  };
  myOfferCount: number;
  totalOfferCount: number;
  items?: RequestItem[];
  hasProvorder?: boolean;
  provorderFeeTotal?: number;
}

interface OfferLine {
  supplierWineId: string;
  wineName: string;
  producer: string;
  requestedQuantity: number;
  offeredPriceExVatSek: string;
  quantity: string;
  included: boolean;
}

type UrgencyLevel = 'critical' | 'urgent' | 'normal' | 'expired';

function getDeadlineInfo(expiresAt: string | null, isExpired: boolean): { label: string; urgency: UrgencyLevel; hoursLeft: number } {
  if (isExpired || !expiresAt) {
    return { label: 'Utgangen', urgency: 'expired', hoursLeft: -1 };
  }
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return { label: 'Utgangen', urgency: 'expired', hoursLeft: -1 };
  if (diffHours < 4) return { label: `${diffHours}h kvar`, urgency: 'critical', hoursLeft: diffHours };
  if (diffHours < 24) return { label: 'Utgar idag', urgency: 'critical', hoursLeft: diffHours };
  if (diffDays === 1) return { label: 'Utgar imorgon', urgency: 'urgent', hoursLeft: diffHours };
  if (diffDays <= 3) return { label: `${diffDays} dagar kvar`, urgency: 'urgent', hoursLeft: diffHours };
  return { label: `${diffDays} dagar kvar`, urgency: 'normal', hoursLeft: diffHours };
}

function getUrgencyStyles(urgency: UrgencyLevel): { badge: string; bg: string } {
  switch (urgency) {
    case 'critical': return { badge: 'bg-red-100 text-red-800 border-red-200', bg: 'bg-red-50' };
    case 'urgent': return { badge: 'bg-amber-100 text-amber-800 border-amber-200', bg: 'bg-amber-50' };
    case 'expired': return { badge: 'bg-gray-100 text-gray-500 border-gray-200', bg: 'bg-gray-50' };
    default: return { badge: 'bg-green-100 text-green-800 border-green-200', bg: 'bg-green-50' };
  }
}

export default function SupplierRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: requestId } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  // Multi-line offer form state
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerLines, setOfferLines] = useState<OfferLine[]>([]);
  const [offerLeadTime, setOfferLeadTime] = useState('14');
  const [offerDeliveryDate, setOfferDeliveryDate] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [shippingType, setShippingType] = useState<'franco' | 'specified'>('specified');
  const [shippingCost, setShippingCost] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [minTotalQuantity, setMinTotalQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    try {
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        router.push('/supplier/login');
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      const requestsRes = await fetch(`/api/suppliers/${supplierData.supplierId}/quote-requests?filter=all`);
      if (!requestsRes.ok) {
        setError('Kunde inte hamta forfragningar');
        return;
      }

      const requestsData = await requestsRes.json();
      const foundRequest = requestsData.requests?.find((r: QuoteRequest) => r.id === requestId);

      if (!foundRequest) {
        setError('Forfragningen hittades inte');
        return;
      }

      setRequest(foundRequest);

      // Initialize offer lines from request items
      if (foundRequest.items && foundRequest.items.length > 0) {
        setOfferLines(
          foundRequest.items.map((item: RequestItem) => ({
            supplierWineId: item.wineId,
            wineName: item.wineName,
            producer: item.producer,
            requestedQuantity: item.quantity,
            offeredPriceExVatSek: item.priceSek ? item.priceSek.toString() : '',
            quantity: item.quantity.toString(),
            included: true,
          }))
        );
      }

      // Default delivery date: 14 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      setOfferDeliveryDate(defaultDate.toISOString().split('T')[0]);
    } catch (err) {
      setError('Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  function updateLine(index: number, field: keyof OfferLine, value: string | boolean) {
    setOfferLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function getIncludedLines() {
    return offerLines.filter(l => l.included);
  }

  function calculateTotals() {
    const included = getIncludedLines();
    const totalBottles = included.reduce((sum, l) => sum + (parseInt(l.quantity) || 0), 0);
    const totalWinePrice = included.reduce((sum, l) => {
      const price = parseFloat(l.offeredPriceExVatSek) || 0;
      const qty = parseInt(l.quantity) || 0;
      return sum + price * qty;
    }, 0);
    const shipping = shippingType === 'franco' ? 0 : (parseInt(shippingCost) || 0);
    return { totalBottles, totalWinePrice, shipping, total: totalWinePrice + shipping };
  }

  async function submitOffer() {
    if (!request || !supplierId) return;

    const included = getIncludedLines();
    if (included.length === 0) {
      setSubmitError('Valj minst ett vin att offerera');
      return;
    }

    // Validate all included lines have price and quantity
    for (const line of included) {
      const price = parseFloat(line.offeredPriceExVatSek);
      const qty = parseInt(line.quantity);
      if (!price || price <= 0) {
        setSubmitError(`Ange ett pris for ${line.wineName}`);
        return;
      }
      if (!qty || qty <= 0) {
        setSubmitError(`Ange antal for ${line.wineName}`);
        return;
      }
    }

    if (!offerDeliveryDate) {
      setSubmitError('Ange leveransdatum');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/quote-requests/${requestId}/offers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          deliveryDate: offerDeliveryDate,
          leadTimeDays: parseInt(offerLeadTime),
          notes: offerNote || null,
          is_franco: shippingType === 'franco',
          shipping_cost_sek: shippingType === 'specified' && shippingCost ? parseInt(shippingCost) : null,
          shipping_notes: shippingNotes || null,
          minTotalQuantity: minTotalQuantity ? parseInt(minTotalQuantity) : null,
          lines: included.map(line => ({
            supplierWineId: line.supplierWineId,
            offeredPriceExVatSek: parseFloat(line.offeredPriceExVatSek),
            quantity: parseInt(line.quantity),
          })),
        }),
      });

      if (response.ok) {
        router.push('/supplier/offers?success=true');
      } else {
        const errorData = await response.json();
        setSubmitError(errorData.error || 'Kunde inte skicka offert');
      }
    } catch (err) {
      setSubmitError('Ett fel uppstod - kontrollera natverket');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-red-800">{error || 'Kunde inte ladda forfragning'}</h2>
          <button onClick={() => router.push('/supplier/requests')} className="mt-4 text-red-600 hover:underline">
            Tillbaka till forfragningar
          </button>
        </div>
      </div>
    );
  }

  const deadlineInfo = getDeadlineInfo(request.assignment.expiresAt, request.assignment.isExpired);
  const urgencyStyles = getUrgencyStyles(deadlineInfo.urgency);
  const hasResponded = request.myOfferCount > 0;
  const totals = calculateTotals();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Tillbaka till forfragningar
      </button>

      {/* Urgency Banner */}
      {deadlineInfo.urgency === 'critical' && !hasResponded && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Brattom! {deadlineInfo.label}</p>
            <p className="text-sm text-red-700">Skicka din offert innan tiden gar ut</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <h1 className="text-xl font-bold text-gray-900">{request.restaurantName}</h1>
            </div>
            <p className="text-gray-600">{request.fritext}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {hasResponded ? (
              <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Offert skickad
              </span>
            ) : (
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${urgencyStyles.badge}`}>
                {deadlineInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {request.antalFlaskor && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Antal</p>
              <p className="font-semibold text-gray-900">{request.antalFlaskor} flaskor</p>
            </div>
          )}
          {request.budgetPerFlaska && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Budget</p>
              <p className="font-semibold text-green-600">{request.budgetPerFlaska} kr/fl</p>
            </div>
          )}
          {request.leveransOrt && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Leveransort</p>
              <p className="font-semibold text-gray-900">{request.leveransOrt}</p>
            </div>
          )}
          {request.leveransSenast && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Onskat datum</p>
              <p className="font-semibold text-gray-900">
                {new Date(request.leveransSenast).toLocaleDateString('sv-SE')}
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        {!hasResponded && !request.assignment.isExpired && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowOfferForm(true)}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" /> Skicka offert
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400" /> Forfragan
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Beskrivning</p>
              <p className="text-gray-900">{request.fritext}</p>
            </div>
            {request.specialkrav && request.specialkrav.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Specialkrav</p>
                <div className="flex flex-wrap gap-2">
                  {request.specialkrav.map((krav, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">{krav}</span>
                  ))}
                </div>
              </div>
            )}
            {request.assignment.matchReasons && request.assignment.matchReasons.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Varfor du matchade</p>
                <div className="space-y-1">
                  {request.assignment.matchReasons.map((reason, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500" /> {reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Wine Items */}
        {request.items && request.items.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wine className="h-5 w-5 text-gray-400" /> Efterfragade viner ({request.items.length})
            </h2>
            {request.hasProvorder && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Provorder - kunden accepterar extra avgift pa {request.provorderFeeTotal} kr
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border ${item.provorder ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.wineName}</p>
                        {item.vintage && <span className="text-gray-500">{item.vintage}</span>}
                        {item.provorder && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Provorder</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {item.producer}{item.country && ` · ${item.country}`}{item.region && ` · ${item.region}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{item.quantity} fl</p>
                      {item.priceSek && <p className="text-xs text-gray-500">{item.priceSek} kr/fl</p>}
                      {item.provorder && item.provorderFee && (
                        <p className="text-xs text-green-600 font-medium">+{item.provorderFee} kr avgift</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competition & Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wine className="h-5 w-5 text-gray-400" /> Konkurrens
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Totalt antal offerter</span>
                <span className="font-medium text-gray-900">{request.totalOfferCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Dina offerter</span>
                <span className={`font-medium ${hasResponded ? 'text-green-600' : 'text-gray-400'}`}>{request.myOfferCount}</span>
              </div>
              {request.assignment.matchScore > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Matchningspoang</span>
                  <span className="font-medium text-blue-600">{request.assignment.matchScore}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" /> Tidslinje
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">
                  Forfragan skickad{' '}
                  {new Date(request.assignment.sentAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {request.assignment.viewedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-gray-600">
                    Visad {new Date(request.assignment.viewedAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {request.assignment.respondedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-700 font-medium">
                    Offert skickad {new Date(request.assignment.respondedAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${request.assignment.isExpired ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                <span className={request.assignment.isExpired ? 'text-red-700' : 'text-gray-600'}>
                  {request.assignment.isExpired ? 'Utgick' : 'Utgar'}{' '}
                  {new Date(request.assignment.expiresAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Wine Offer Form Modal */}
      {showOfferForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Skicka offert</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {request.restaurantName} — {getIncludedLines().length} viner
                  </p>
                </div>
                <button onClick={() => setShowOfferForm(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              {/* Wine Lines Table */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Viner</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-8"></th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Vin</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-20">Onskat</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-28">Pris (kr/fl)</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Antal</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Summa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offerLines.map((line, index) => {
                        const price = parseFloat(line.offeredPriceExVatSek) || 0;
                        const qty = parseInt(line.quantity) || 0;
                        const lineTotal = price * qty;
                        return (
                          <tr key={index} className={line.included ? '' : 'opacity-40 bg-gray-50'}>
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={line.included}
                                onChange={(e) => updateLine(index, 'included', e.target.checked)}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-gray-900">{line.wineName}</p>
                              <p className="text-xs text-gray-500">{line.producer}</p>
                            </td>
                            <td className="px-3 py-3 text-gray-600">
                              {line.requestedQuantity} fl
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={line.offeredPriceExVatSek}
                                onChange={(e) => updateLine(index, 'offeredPriceExVatSek', e.target.value)}
                                disabled={!line.included}
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={line.quantity}
                                onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                disabled={!line.included}
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                              />
                            </td>
                            <td className="px-3 py-3 text-right font-medium text-gray-900">
                              {line.included && lineTotal > 0 ? `${lineTotal.toLocaleString('sv-SE')} kr` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leveransdatum</label>
                  <input
                    type="date"
                    value={offerDeliveryDate}
                    onChange={(e) => setOfferDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leveranstid</label>
                  <select
                    value={offerLeadTime}
                    onChange={(e) => setOfferLeadTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="7">7 dagar</option>
                    <option value="14">14 dagar</option>
                    <option value="21">21 dagar</option>
                    <option value="30">30 dagar</option>
                    <option value="45">45 dagar</option>
                    <option value="60">60 dagar</option>
                  </select>
                </div>
              </div>

              {/* Shipping */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">Frakt</label>
                </div>
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" checked={shippingType === 'specified'} onChange={() => setShippingType('specified')} className="text-green-600" />
                    <div>
                      <span className="font-medium text-gray-900">Ange fraktkostnad</span>
                      <p className="text-xs text-gray-500">Separat frakt tillkommer</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" checked={shippingType === 'franco'} onChange={() => setShippingType('franco')} className="text-green-600" />
                    <div>
                      <span className="font-medium text-gray-900">Fritt levererat (franco)</span>
                      <p className="text-xs text-gray-500">Frakt ingar i priset</p>
                    </div>
                  </label>
                </div>
                {shippingType === 'specified' && (
                  <div className="mb-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="Fraktkostnad (SEK)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  placeholder="Fraktnotering (valfritt)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* MOQ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minsta totala antal flaskor (valfritt)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minTotalQuantity}
                  onChange={(e) => setMinTotalQuantity(e.target.value)}
                  placeholder="T.ex. 12"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Restaurangen kan inte acceptera under detta antal (t.ex. for franco-villkor)
                </p>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar (valfritt)</label>
                <textarea
                  value={offerNote}
                  onChange={(e) => setOfferNote(e.target.value)}
                  placeholder="Extra information till restaurangen"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Totals Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{getIncludedLines().length} viner, {totals.totalBottles} flaskor</span>
                    <span className="font-medium">{totals.totalWinePrice.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frakt</span>
                    <span className="font-medium">
                      {shippingType === 'franco' ? 'Franco' : totals.shipping > 0 ? `${totals.shipping} kr` : 'Ej angiven'}
                    </span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between text-base">
                    <span className="font-bold text-gray-900">Totalt ex moms</span>
                    <span className="font-bold text-green-700">{totals.total.toLocaleString('sv-SE')} kr</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowOfferForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={submitOffer}
                disabled={submitting || getIncludedLines().length === 0}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Skickar...</>
                ) : (
                  <><Send className="h-4 w-4" /> Skicka offert ({getIncludedLines().length} viner)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
