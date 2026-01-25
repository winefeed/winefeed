'use client';

/**
 * SUPPLIER OFFERS PAGE
 *
 * View and manage sent offers
 */

import { useEffect, useState, useCallback } from 'react';
import { FileText, Clock, Building2, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';

interface Offer {
  id: string;
  request_id: string;
  restaurant_name: string;
  wine_name: string;
  quantity: number;
  offered_price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string | null;
}

export default function SupplierOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Fetch offers
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

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Väntar', color: 'bg-blue-100 text-blue-800', icon: Clock },
    accepted: { label: 'Accepterad', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    rejected: { label: 'Avböjd', color: 'bg-red-100 text-red-800', icon: XCircle },
    expired: { label: 'Utgången', color: 'bg-gray-100 text-gray-600', icon: AlertCircle },
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Offerter</h1>
        <p className="text-gray-500 mt-1">
          Hantera och följ upp dina skickade offerter
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'Alla' : statusConfig[status]?.label}
          </button>
        ))}
      </div>

      {/* Offers List */}
      {offers.length > 0 ? (
        <div className="space-y-3">
          {offers.map((offer) => {
            const config = statusConfig[offer.status];
            const StatusIcon = config?.icon || Clock;

            return (
              <a
                key={offer.id}
                href={`/supplier/offers/${offer.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Restaurant */}
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {offer.restaurant_name}
                      </span>
                    </div>

                    {/* Offer details */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{offer.wine_name}</span>
                      <span>•</span>
                      <span>{offer.quantity} flaskor</span>
                      <span>•</span>
                      <span className="font-medium">
                        {offer.offered_price.toLocaleString('sv-SE')} kr
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>
                        Skickad {new Date(offer.created_at).toLocaleDateString('sv-SE', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status & Arrow */}
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {config?.label}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </a>
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
              : `Inga ${statusConfig[filter]?.label.toLowerCase()} offerter.`}
          </p>
          <a
            href="/supplier/requests"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            Se förfrågningar →
          </a>
        </div>
      )}

      {/* Stats summary */}
      {offers.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {offers.length}
            </p>
            <p className="text-sm text-gray-500">Totalt</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {offers.filter((o) => o.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-500">Väntar</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {offers.filter((o) => o.status === 'accepted').length}
            </p>
            <p className="text-sm text-gray-500">Accepterade</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {offers.filter((o) => o.status === 'rejected').length}
            </p>
            <p className="text-sm text-gray-500">Avböjda</p>
          </div>
        </div>
      )}
    </div>
  );
}
