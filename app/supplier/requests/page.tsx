'use client';

/**
 * SUPPLIER REQUESTS PAGE
 *
 * View and respond to incoming quote requests from restaurants
 */

import { useEffect, useState } from 'react';
import { Inbox, Clock, Building2, Wine, ChevronRight, Filter, AlertCircle } from 'lucide-react';

interface QuoteRequest {
  id: string;
  restaurant_name: string;
  wine_name: string;
  quantity: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  notes: string | null;
  has_offer: boolean;
}

export default function SupplierRequestsPage() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('pending');
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  async function fetchRequests() {
    try {
      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Fetch requests
      const requestsRes = await fetch(
        `/api/suppliers/${supplierData.supplierId}/quote-requests?filter=${filter}`
      );
      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = requests.filter((r) => !r.has_offer).length;
  const respondedCount = requests.filter((r) => r.has_offer).length;

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
        <h1 className="text-2xl font-bold text-gray-900">Förfrågningar</h1>
        <p className="text-gray-500 mt-1">
          Förfrågningar från restauranger som väntar på ditt svar
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Väntar på svar
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('responded')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'responded'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Besvarade
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Alla
        </button>
      </div>

      {/* Request List */}
      {requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((request) => (
            <a
              key={request.id}
              href={`/supplier/requests/${request.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Restaurant */}
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {request.restaurant_name}
                    </span>
                    {!request.has_offer && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                        Ny
                      </span>
                    )}
                  </div>

                  {/* Wine info */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Wine className="h-4 w-4 text-gray-400" />
                      <span>{request.wine_name}</span>
                    </div>
                    <span>•</span>
                    <span>{request.quantity} flaskor</span>
                  </div>

                  {/* Notes */}
                  {request.notes && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-1">
                      &ldquo;{request.notes}&rdquo;
                    </p>
                  )}

                  {/* Time */}
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(request.created_at).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {request.expires_at && (
                      <>
                        <span>•</span>
                        <span className="text-amber-600">
                          Svarstid: {new Date(request.expires_at).toLocaleDateString('sv-SE')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status & Arrow */}
                <div className="flex items-center gap-3">
                  {request.has_offer ? (
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                      Offert skickad
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                      Väntar på svar
                    </span>
                  )}
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'pending'
              ? 'Inga väntande förfrågningar'
              : filter === 'responded'
              ? 'Inga besvarade förfrågningar'
              : 'Inga förfrågningar'}
          </h3>
          <p className="text-gray-500">
            {filter === 'pending'
              ? 'Du har svarat på alla förfrågningar. Bra jobbat!'
              : 'Förfrågningar från restauranger kommer att visas här.'}
          </p>
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">Så fungerar det</h3>
            <p className="text-sm text-blue-700 mt-1">
              När en restaurang söker ett vin som matchar din katalog får du en förfrågan här.
              Klicka på förfrågan för att skicka en offert med ditt pris och leveransinformation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
