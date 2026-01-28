'use client';

/**
 * SUPPLIER REQUEST DETAIL PAGE
 *
 * Shows full details of a quote request and allows creating an offer
 */

import { useEffect, useState, use } from 'react';
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

  if (diffMs < 0) {
    return { label: 'Utgangen', urgency: 'expired', hoursLeft: -1 };
  }

  if (diffHours < 4) {
    return { label: `${diffHours}h kvar`, urgency: 'critical', hoursLeft: diffHours };
  }

  if (diffHours < 24) {
    return { label: 'Utgar idag', urgency: 'critical', hoursLeft: diffHours };
  }

  if (diffDays === 1) {
    return { label: 'Utgar imorgon', urgency: 'urgent', hoursLeft: diffHours };
  }

  if (diffDays <= 3) {
    return { label: `${diffDays} dagar kvar`, urgency: 'urgent', hoursLeft: diffHours };
  }

  return { label: `${diffDays} dagar kvar`, urgency: 'normal', hoursLeft: diffHours };
}

function getUrgencyStyles(urgency: UrgencyLevel): { badge: string; bg: string } {
  switch (urgency) {
    case 'critical':
      return { badge: 'bg-red-100 text-red-800 border-red-200', bg: 'bg-red-50' };
    case 'urgent':
      return { badge: 'bg-amber-100 text-amber-800 border-amber-200', bg: 'bg-amber-50' };
    case 'expired':
      return { badge: 'bg-gray-100 text-gray-500 border-gray-200', bg: 'bg-gray-50' };
    default:
      return { badge: 'bg-green-100 text-green-800 border-green-200', bg: 'bg-green-50' };
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

  // Offer form state
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQuantity, setOfferQuantity] = useState('');
  const [offerLeadTime, setOfferLeadTime] = useState('14');
  const [offerNote, setOfferNote] = useState('');
  const [shippingType, setShippingType] = useState<'franco' | 'specified'>('specified');
  const [shippingCost, setShippingCost] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  async function fetchRequest() {
    try {
      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        router.push('/supplier/login');
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Fetch requests and find this one
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

      // Pre-fill form with request data
      if (foundRequest.budgetPerFlaska) {
        setOfferPrice(foundRequest.budgetPerFlaska.toString());
      }
      if (foundRequest.antalFlaskor) {
        setOfferQuantity(foundRequest.antalFlaskor.toString());
      }
    } catch (err) {
      setError('Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  }

  async function submitOffer() {
    if (!request || !supplierId) return;

    const price = parseInt(offerPrice);
    const quantity = parseInt(offerQuantity) || request.antalFlaskor || 24;

    if (!price || price <= 0) {
      setSubmitError('Ange ett giltigt pris');
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
          supplier_id: supplierId,
          price_sek: price,
          quantity: quantity,
          lead_time_days: parseInt(offerLeadTime),
          notes: offerNote || `Offert: ${request.fritext}`,
          is_franco: shippingType === 'franco',
          shipping_cost_sek: shippingType === 'specified' && shippingCost ? parseInt(shippingCost) : null,
          shipping_notes: shippingNotes || null,
        }),
      });

      if (response.ok) {
        // Redirect to offers page with success message
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
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-red-800">{error || 'Kunde inte ladda forfragning'}</h2>
          <button
            onClick={() => router.push('/supplier/requests')}
            className="mt-4 text-red-600 hover:underline"
          >
            Tillbaka till forfragningar
          </button>
        </div>
      </div>
    );
  }

  const deadlineInfo = getDeadlineInfo(request.assignment.expiresAt, request.assignment.isExpired);
  const urgencyStyles = getUrgencyStyles(deadlineInfo.urgency);
  const hasResponded = request.myOfferCount > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till forfragningar
      </button>

      {/* Urgency Banner */}
      {deadlineInfo.urgency === 'critical' && !hasResponded && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Bråttom! {deadlineInfo.label}</p>
            <p className="text-sm text-red-700">Skicka din offert innan tiden går ut</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <h1 className="text-xl font-bold text-gray-900">
                {request.restaurantName}
              </h1>
            </div>
            <p className="text-gray-600">{request.fritext}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {hasResponded ? (
              <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Offert skickad
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
              <Send className="h-4 w-4" />
              Skicka offert
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400" />
            Forfragan
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
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                    >
                      {krav}
                    </span>
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
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {reason}
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
              <Wine className="h-5 w-5 text-gray-400" />
              Efterfragade viner ({request.items.length})
            </h2>

            {/* Provorder banner */}
            {request.hasProvorder && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Provorder - kunden accepterar extra avgift på {request.provorderFeeTotal} kr
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border ${
                    item.provorder
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.wineName}</p>
                        {item.vintage && (
                          <span className="text-gray-500">{item.vintage}</span>
                        )}
                        {item.provorder && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            Provorder
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {item.producer}
                        {item.country && ` · ${item.country}`}
                        {item.region && ` · ${item.region}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{item.quantity} fl</p>
                      {item.priceSek && (
                        <p className="text-xs text-gray-500">{item.priceSek} kr/fl</p>
                      )}
                      {item.provorder && item.provorderFee && (
                        <p className="text-xs text-green-600 font-medium">
                          +{item.provorderFee} kr avgift
                        </p>
                      )}
                    </div>
                  </div>
                  {item.moq > 0 && item.quantity < item.moq && !item.provorder && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                      <AlertCircle className="h-3 w-3" />
                      Under MOQ (min. {item.moq} fl)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline & Stats */}
        <div className="space-y-6">
          {/* Competition Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wine className="h-5 w-5 text-gray-400" />
              Konkurrens
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Totalt antal offerter</span>
                <span className="font-medium text-gray-900">{request.totalOfferCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Dina offerter</span>
                <span className={`font-medium ${hasResponded ? 'text-green-600' : 'text-gray-400'}`}>
                  {request.myOfferCount}
                </span>
              </div>
              {request.assignment.matchScore > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Matchningspoang</span>
                  <span className="font-medium text-blue-600">{request.assignment.matchScore}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Tidslinje
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">
                  Forfragan skickad{' '}
                  {new Date(request.assignment.sentAt).toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {request.assignment.viewedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-gray-600">
                    Visad{' '}
                    {new Date(request.assignment.viewedAt).toLocaleDateString('sv-SE', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {request.assignment.respondedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-700 font-medium">
                    Offert skickad{' '}
                    {new Date(request.assignment.respondedAt).toLocaleDateString('sv-SE', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  request.assignment.isExpired ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className={request.assignment.isExpired ? 'text-red-700' : 'text-gray-600'}>
                  {request.assignment.isExpired ? 'Utgick' : 'Utgar'}{' '}
                  {new Date(request.assignment.expiresAt).toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Offer Form Modal */}
      {showOfferForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Skicka offert</h2>
                <button
                  onClick={() => setShowOfferForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Request summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-900">{request.restaurantName}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{request.fritext}</p>
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pris per flaska (SEK) *
                </label>
                <input
                  type="number"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder={request.budgetPerFlaska?.toString() || 'Ange pris'}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                {request.budgetPerFlaska && (
                  <p className="text-xs text-gray-500 mt-1">
                    Restaurangens budget: {request.budgetPerFlaska} kr/fl
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Antal flaskor
                </label>
                <input
                  type="number"
                  value={offerQuantity}
                  onChange={(e) => setOfferQuantity(e.target.value)}
                  placeholder={request.antalFlaskor?.toString() || '24'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Lead time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leveranstid
                </label>
                <select
                  value={offerLeadTime}
                  onChange={(e) => setOfferLeadTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="7">7 dagar</option>
                  <option value="14">14 dagar</option>
                  <option value="21">21 dagar</option>
                  <option value="30">30 dagar</option>
                  <option value="45">45 dagar</option>
                  <option value="60">60 dagar</option>
                </select>
              </div>

              {/* Shipping */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">Frakt</label>
                </div>

                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      checked={shippingType === 'specified'}
                      onChange={() => setShippingType('specified')}
                      className="text-green-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Ange fraktkostnad</span>
                      <p className="text-xs text-gray-500">Separat frakt tillkommer</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      checked={shippingType === 'franco'}
                      onChange={() => setShippingType('franco')}
                      className="text-green-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Fritt levererat (franco)</span>
                      <p className="text-xs text-gray-500">Frakt ingar i priset</p>
                    </div>
                  </label>
                </div>

                {shippingType === 'specified' && (
                  <div className="mb-3">
                    <input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="Fraktkostnad (SEK)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                )}

                <input
                  type="text"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  placeholder="Fraktnotering (valfritt)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kommentar (valfritt)
                </label>
                <textarea
                  value={offerNote}
                  onChange={(e) => setOfferNote(e.target.value)}
                  placeholder="Extra information till restaurangen"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowOfferForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={submitOffer}
                disabled={submitting || !offerPrice}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Skickar...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Skicka offert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
