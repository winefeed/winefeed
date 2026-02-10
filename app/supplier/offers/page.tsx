'use client';

/**
 * SUPPLIER OFFERS PAGE — Multi-line grouped view
 *
 * Shows offers grouped per restaurant with expandable wine lines.
 * Supports both multi-line offers and legacy single-wine offers.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText, Clock, Building2, CheckCircle, XCircle, AlertCircle,
  ChevronDown, ChevronRight, Wine, Package, Truck, X
} from 'lucide-react';

interface OfferLine {
  id: string | null;
  wineName: string;
  producer: string;
  vintage: number | null;
  priceSek: number;
  quantity: number;
  totalSek: number;
  accepted: boolean | null;
}

interface Offer {
  id: string;
  request_id: string;
  restaurant_name: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  is_franco: boolean;
  shipping_cost_sek: number | null;
  lines: OfferLine[];
  wineCount: number;
  totalBottles: number;
  totalSek: number;
  totalWithShipping: number;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Väntar', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: Clock },
  SENT: { label: 'Skickad', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: Clock },
  accepted: { label: 'Accepterad', color: 'text-green-800', bgColor: 'bg-green-100', icon: CheckCircle },
  ACCEPTED: { label: 'Accepterad', color: 'text-green-800', bgColor: 'bg-green-100', icon: CheckCircle },
  PARTIALLY_ACCEPTED: { label: 'Delvis accepterad', color: 'text-amber-800', bgColor: 'bg-amber-100', icon: AlertCircle },
  rejected: { label: 'Avböjd', color: 'text-red-800', bgColor: 'bg-red-100', icon: XCircle },
  expired: { label: 'Utgången', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: AlertCircle },
};

function getStatusConfig(status: string) {
  return statusConfig[status] || statusConfig['pending'];
}

export default function SupplierOffersPage() {
  const searchParams = useSearchParams();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(searchParams.get('success') === 'true');

  const fetchOffers = useCallback(async () => {
    try {
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();

      const offersRes = await fetch(
        `/api/suppliers/${supplierData.supplierId}/offers?status=${filter}`
      );
      if (offersRes.ok) {
        const data = await offersRes.json();
        setOffers(data.offers || []);
      }
    } catch (error) {
      console.error('Failed to fetch offers:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const isAccepted = (status: string) =>
    ['accepted', 'ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(status);

  const counts = {
    total: offers.length,
    pending: offers.filter(o => ['pending', 'SENT'].includes(o.status)).length,
    accepted: offers.filter(o => isAccepted(o.status)).length,
    rejected: offers.filter(o => o.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 relative">
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="absolute top-3 right-3 text-green-600 hover:text-green-800"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-800">Offert skickad!</h3>
              <p className="text-green-700 text-sm mt-1">
                Din offert har skickats till restaurangen.
              </p>
              <div className="mt-3 text-sm text-green-700">
                <p className="font-medium mb-1">Vad händer nu?</p>
                <ul className="list-disc list-inside space-y-1 text-green-600">
                  <li>Restaurangen får notis om din offert</li>
                  <li>De kan jämföra med andra leverantörer</li>
                  <li>Du får notis om de accepterar eller avböjer</li>
                  <li>Snabb svarstid ökar chansen att vinna affären</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Offerter</h1>
        <p className="text-gray-500 mt-1">
          Hantera och följ upp dina skickade offerter
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => {
          const labels: Record<string, string> = {
            all: 'Alla',
            pending: 'Väntar',
            accepted: 'Accepterade',
            rejected: 'Avböjda',
          };
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {labels[status]}
            </button>
          );
        })}
      </div>

      {/* Offers List */}
      {offers.length > 0 ? (
        <div className="space-y-3">
          {offers.map((offer) => {
            const config = getStatusConfig(offer.status);
            const StatusIcon = config.icon;
            const isExpanded = expandedId === offer.id;
            const hasMultipleLines = offer.lines.length > 1;
            const acceptedLines = offer.lines.filter(l => l.accepted === true);
            const rejectedLines = offer.lines.filter(l => l.accepted === false);

            return (
              <div
                key={offer.id}
                className={`bg-white rounded-lg border transition-all ${
                  isAccepted(offer.status)
                    ? 'border-green-200'
                    : offer.status === 'PARTIALLY_ACCEPTED'
                      ? 'border-amber-200'
                      : 'border-gray-200'
                }`}
              >
                {/* Offer Header — always visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : offer.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Restaurant name */}
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate">
                          {offer.restaurant_name}
                        </span>
                      </div>

                      {/* Summary line */}
                      <div className="flex items-center gap-3 text-sm text-gray-600 ml-6">
                        <span className="flex items-center gap-1">
                          <Wine className="h-3.5 w-3.5" />
                          {offer.wineCount} {offer.wineCount === 1 ? 'vin' : 'viner'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {offer.totalBottles} flaskor
                        </span>
                        <span className="font-medium">
                          {Math.round(offer.totalWithShipping).toLocaleString('sv-SE')} kr
                        </span>
                        {offer.is_franco && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Truck className="h-3.5 w-3.5" />
                            Franco
                          </span>
                        )}
                      </div>

                      {/* Partial acceptance info */}
                      {offer.status === 'PARTIALLY_ACCEPTED' && (
                        <p className="text-xs text-amber-600 ml-6 mt-1">
                          {acceptedLines.length} av {offer.lines.length} viner accepterade
                        </p>
                      )}

                      {/* Time */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 ml-6">
                        <Clock className="h-3 w-3" />
                        <span>
                          Skickad {new Date(offer.created_at).toLocaleDateString('sv-SE', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status + expand */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                      {hasMultipleLines ? (
                        isExpanded
                          ? <ChevronDown className="h-5 w-5 text-gray-400" />
                          : <ChevronRight className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-300" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded wine lines */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <table className="w-full mt-3 text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                          <th className="pb-2 font-medium">Vin</th>
                          <th className="pb-2 font-medium text-right">Pris/fl</th>
                          <th className="pb-2 font-medium text-right">Antal</th>
                          <th className="pb-2 font-medium text-right">Totalt</th>
                          {isAccepted(offer.status) && (
                            <th className="pb-2 font-medium text-right">Status</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {offer.lines.map((line, idx) => (
                          <tr key={line.id || idx} className={
                            line.accepted === true ? 'bg-green-50/50' :
                            line.accepted === false ? 'bg-gray-50 text-gray-400' : ''
                          }>
                            <td className="py-2 pr-4">
                              <span className={line.accepted === false ? 'line-through' : ''}>
                                {line.wineName}
                                {line.vintage ? ` ${line.vintage}` : ''}
                              </span>
                              {line.producer && (
                                <span className="text-xs text-gray-400 ml-1">
                                  — {line.producer}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {Math.round(line.priceSek).toLocaleString('sv-SE')} kr
                            </td>
                            <td className="py-2 text-right">
                              {line.quantity} fl
                            </td>
                            <td className="py-2 text-right font-medium whitespace-nowrap">
                              {Math.round(line.totalSek).toLocaleString('sv-SE')} kr
                            </td>
                            {isAccepted(offer.status) && (
                              <td className="py-2 text-right">
                                {line.accepted === true && (
                                  <span className="text-green-600 text-xs font-medium">Accepterad</span>
                                )}
                                {line.accepted === false && (
                                  <span className="text-gray-400 text-xs">Avböjd</span>
                                )}
                                {line.accepted === null && (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-gray-200">
                        <tr className="text-sm font-medium">
                          <td className="pt-2">Summa</td>
                          <td></td>
                          <td className="pt-2 text-right">{offer.totalBottles} fl</td>
                          <td className="pt-2 text-right whitespace-nowrap">
                            {Math.round(offer.totalSek).toLocaleString('sv-SE')} kr
                          </td>
                          {isAccepted(offer.status) && <td></td>}
                        </tr>
                        {!offer.is_franco && offer.shipping_cost_sek && (
                          <tr className="text-xs text-gray-500">
                            <td className="pt-1">Frakt</td>
                            <td></td>
                            <td></td>
                            <td className="pt-1 text-right">
                              +{offer.shipping_cost_sek.toLocaleString('sv-SE')} kr
                            </td>
                            {isAccepted(offer.status) && <td></td>}
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Inga offerter
          </h3>
          <p className="text-gray-500 mb-4">
            {filter === 'all'
              ? 'Du har inte skickat några offerter ännu.'
              : `Inga ${filter === 'pending' ? 'väntande' : filter === 'accepted' ? 'accepterade' : 'avböjda'} offerter.`}
          </p>
          <a
            href="/supplier/requests"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            Se förfrågningar
          </a>
        </div>
      )}

      {/* Stats summary */}
      {offers.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
            <p className="text-sm text-gray-500">Totalt</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{counts.pending}</p>
            <p className="text-sm text-gray-500">Väntar</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{counts.accepted}</p>
            <p className="text-sm text-gray-500">Accepterade</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
            <p className="text-sm text-gray-500">Avböjda</p>
          </div>
        </div>
      )}
    </div>
  );
}
