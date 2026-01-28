'use client';

/**
 * SUPPLIER OFFER DETAIL PAGE
 *
 * Shows full details of a single offer sent to a restaurant
 */

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Wine,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  FileText,
  AlertCircle,
  Calendar,
  MapPin,
  CreditCard,
} from 'lucide-react';

interface OfferDetail {
  id: string;
  status: string;
  offered_price: number;
  quantity: number;
  notes: string | null;
  lead_time_days: number | null;
  created_at: string;
  expires_at: string | null;
  is_franco: boolean;
  shipping_cost_sek: number | null;
  shipping_notes: string | null;
  total_wine_price: number;
  total_with_shipping: number;
  restaurant_name: string;
  restaurant_address: string | null;
  restaurant_city: string | null;
  wine_name: string | null;
  quote_request: {
    id: string;
    fritext: string;
    budget_per_flaska: number | null;
    antal_flaskor: number | null;
    leverans_senast: string | null;
    leverans_ort: string | null;
    specialkrav: string[];
    created_at: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Väntar på svar', color: 'bg-blue-100 text-blue-800', icon: Clock },
  accepted: { label: 'Accepterad', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Avböjd', color: 'bg-red-100 text-red-800', icon: XCircle },
  expired: { label: 'Utgången', color: 'bg-gray-100 text-gray-600', icon: AlertCircle },
  DRAFT: { label: 'Utkast', color: 'bg-gray-100 text-gray-600', icon: FileText },
  SENT: { label: 'Skickad', color: 'bg-blue-100 text-blue-800', icon: Clock },
  ACCEPTED: { label: 'Accepterad', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REJECTED: { label: 'Avböjd', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function SupplierOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: offerId } = use(params);
  const router = useRouter();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOffer() {
      try {
        // First get supplier context
        const supplierRes = await fetch('/api/me/supplier');
        if (!supplierRes.ok) {
          router.push('/supplier/login');
          return;
        }
        const supplierData = await supplierRes.json();

        // Then fetch offer
        const res = await fetch(`/api/offers/${offerId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Offerten hittades inte');
          } else if (res.status === 403) {
            setError('Du har inte behörighet att visa denna offert');
          } else {
            setError('Kunde inte hämta offert');
          }
          return;
        }

        const data = await res.json();

        // Transform to expected format
        const offerData = data.offer || data;
        const lines = data.lines || [];

        // Build restaurant info from various sources
        let restaurantName = 'Okänd restaurang';
        let restaurantAddress = null;
        let restaurantCity = null;
        let wineName = null;
        let quoteRequest = null;

        // Check for different data structures
        if (offerData.restaurant) {
          restaurantName = offerData.restaurant.name || restaurantName;
          restaurantAddress = offerData.restaurant.address;
          restaurantCity = offerData.restaurant.city;
        }

        if (offerData.wine) {
          wineName = offerData.wine.name;
        }

        if (offerData.quote_request) {
          quoteRequest = offerData.quote_request;
        }

        // If we have lines, use the first line's name as wine name
        if (!wineName && lines.length > 0) {
          wineName = lines[0].name;
        }

        setOffer({
          id: offerData.id,
          status: offerData.status,
          offered_price: offerData.offered_price || (offerData.offered_unit_price_ore ? offerData.offered_unit_price_ore / 100 : 0),
          quantity: offerData.quantity || lines.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0),
          notes: offerData.notes,
          lead_time_days: offerData.lead_time_days,
          created_at: offerData.created_at,
          expires_at: offerData.expires_at,
          is_franco: offerData.is_franco || false,
          shipping_cost_sek: offerData.shipping_cost_sek,
          shipping_notes: offerData.shipping_notes,
          total_wine_price: offerData.total_wine_price || (offerData.offered_price * offerData.quantity),
          total_with_shipping: offerData.total_with_shipping || (offerData.offered_price * offerData.quantity + (offerData.is_franco ? 0 : (offerData.shipping_cost_sek || 0))),
          restaurant_name: restaurantName,
          restaurant_address: restaurantAddress,
          restaurant_city: restaurantCity,
          wine_name: wineName,
          quote_request: quoteRequest,
        });
      } catch (err) {
        setError('Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [offerId, router]);

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

  if (error || !offer) {
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
          <h2 className="text-lg font-medium text-red-800">{error || 'Kunde inte ladda offert'}</h2>
          <button
            onClick={() => router.push('/supplier/offers')}
            className="mt-4 text-red-600 hover:underline"
          >
            Tillbaka till offerter
          </button>
        </div>
      </div>
    );
  }

  const config = statusConfig[offer.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till offerter
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <h1 className="text-xl font-bold text-gray-900">
                {offer.restaurant_name}
              </h1>
            </div>
            {offer.wine_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <Wine className="h-4 w-4" />
                <span>{offer.wine_name}</span>
              </div>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
            <StatusIcon className="h-4 w-4" />
            {config.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Offer Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            Offertdetaljer
          </h2>

          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="text-gray-500">Pris per flaska</dt>
              <dd className="font-medium text-gray-900">
                {offer.offered_price.toLocaleString('sv-SE')} kr
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-gray-500">Antal flaskor</dt>
              <dd className="font-medium text-gray-900">{offer.quantity} st</dd>
            </div>

            <div className="flex justify-between border-t border-gray-100 pt-4">
              <dt className="text-gray-500">Vinpris totalt</dt>
              <dd className="font-medium text-gray-900">
                {offer.total_wine_price.toLocaleString('sv-SE')} kr
              </dd>
            </div>

            {/* Shipping */}
            <div className="flex justify-between">
              <dt className="text-gray-500 flex items-center gap-1">
                <Truck className="h-4 w-4" />
                Frakt
              </dt>
              <dd className="font-medium text-gray-900">
                {offer.is_franco ? (
                  <span className="text-green-600">Fritt levererat</span>
                ) : offer.shipping_cost_sek ? (
                  `${offer.shipping_cost_sek.toLocaleString('sv-SE')} kr`
                ) : (
                  <span className="text-gray-400">Ej angiven</span>
                )}
              </dd>
            </div>

            {offer.shipping_notes && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Fraktnotering:</p>
                {offer.shipping_notes}
              </div>
            )}

            <div className="flex justify-between border-t border-gray-200 pt-4">
              <dt className="text-gray-900 font-medium">Totalt inkl. frakt</dt>
              <dd className="font-bold text-lg text-gray-900">
                {offer.total_with_shipping.toLocaleString('sv-SE')} kr
              </dd>
            </div>

            {offer.lead_time_days && (
              <div className="flex justify-between">
                <dt className="text-gray-500 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Leveranstid
                </dt>
                <dd className="font-medium text-gray-900">
                  {offer.lead_time_days} dagar
                </dd>
              </div>
            )}
          </dl>

          {offer.notes && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Kommentar</h3>
              <p className="text-gray-600 text-sm bg-gray-50 rounded-lg p-3">
                {offer.notes}
              </p>
            </div>
          )}
        </div>

        {/* Request Info */}
        <div className="space-y-6">
          {/* Restaurant Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              Restaurang
            </h2>

            <div className="space-y-3">
              <p className="font-medium text-gray-900">{offer.restaurant_name}</p>
              {(offer.restaurant_address || offer.restaurant_city) && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <div>
                    {offer.restaurant_address && <p>{offer.restaurant_address}</p>}
                    {offer.restaurant_city && <p>{offer.restaurant_city}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Original Request */}
          {offer.quote_request && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-400" />
                Ursprunglig förfrågan
              </h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Beskrivning</p>
                  <p className="text-gray-900">{offer.quote_request.fritext}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {offer.quote_request.antal_flaskor && (
                    <div>
                      <p className="text-sm text-gray-500">Önskat antal</p>
                      <p className="font-medium text-gray-900">
                        {offer.quote_request.antal_flaskor} flaskor
                      </p>
                    </div>
                  )}
                  {offer.quote_request.budget_per_flaska && (
                    <div>
                      <p className="text-sm text-gray-500">Budget</p>
                      <p className="font-medium text-gray-900">
                        {offer.quote_request.budget_per_flaska} kr/flaska
                      </p>
                    </div>
                  )}
                </div>

                {offer.quote_request.leverans_ort && (
                  <div>
                    <p className="text-sm text-gray-500">Leveransort</p>
                    <p className="font-medium text-gray-900">
                      {offer.quote_request.leverans_ort}
                    </p>
                  </div>
                )}

                {offer.quote_request.leverans_senast && (
                  <div>
                    <p className="text-sm text-gray-500">Önskat leveransdatum</p>
                    <p className="font-medium text-gray-900">
                      {new Date(offer.quote_request.leverans_senast).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                )}

                {offer.quote_request.specialkrav && offer.quote_request.specialkrav.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Specialkrav</p>
                    <div className="flex flex-wrap gap-2">
                      {offer.quote_request.specialkrav.map((krav, i) => (
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
              </div>
            </div>
          )}

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
                  Offert skickad{' '}
                  {new Date(offer.created_at).toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {offer.expires_at && (
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    new Date(offer.expires_at) < new Date() ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="text-gray-600">
                    {new Date(offer.expires_at) < new Date() ? 'Utgick' : 'Utgår'}{' '}
                    {new Date(offer.expires_at).toLocaleDateString('sv-SE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {offer.status === 'accepted' || offer.status === 'ACCEPTED' ? (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-700 font-medium">Accepterad av restaurangen</span>
                </div>
              ) : offer.status === 'rejected' || offer.status === 'REJECTED' ? (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-red-700 font-medium">Avböjd av restaurangen</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
