'use client';

/**
 * SUPPLIER REQUESTS PAGE
 *
 * View and respond to incoming quote requests from restaurants
 *
 * Features:
 * - List all incoming quote requests
 * - Filter by status (pending, responded, all)
 * - Bulk selection for mass offer creation
 * - Quick actions per request
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Clock, Building2, Wine, ChevronRight, AlertCircle, CheckSquare, Square, Zap, X } from 'lucide-react';

interface QuoteRequest {
  id: string;
  restaurant_name: string;
  wine_name: string;
  quantity: number;
  budget_sek: number | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  notes: string | null;
  has_offer: boolean;
}

export default function SupplierRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('pending');
  const [supplierId, setSupplierId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkLeadTime, setBulkLeadTime] = useState('14');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  // Toggle selection of a request
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRequests(newSelected);
  };

  // Select all pending requests
  const selectAllPending = () => {
    const pendingIds = requests.filter(r => !r.has_offer).map(r => r.id);
    setSelectedRequests(new Set(pendingIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedRequests(new Set());
  };

  // Submit bulk offers
  const submitBulkOffers = async () => {
    if (selectedRequests.size === 0 || !supplierId) return;

    setBulkSubmitting(true);
    try {
      const selectedArray = Array.from(selectedRequests);
      const results = await Promise.allSettled(
        selectedArray.map(async (requestId) => {
          const request = requests.find(r => r.id === requestId);
          if (!request) throw new Error('Request not found');

          // Create offer for this request
          const response = await fetch(`/api/quote-requests/${requestId}/offers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': '00000000-0000-0000-0000-000000000001'
            },
            body: JSON.stringify({
              supplier_id: supplierId,
              price_sek: bulkPrice ? parseInt(bulkPrice) : (request.budget_sek || 100),
              quantity: request.quantity,
              lead_time_days: parseInt(bulkLeadTime),
              notes: `Offert för ${request.wine_name}`
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create offer');
          }

          return response.json();
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      alert(`Klart! ${successful} offerter skapade${failed > 0 ? `, ${failed} misslyckades` : ''}.`);

      // Refresh and reset
      setShowBulkModal(false);
      setSelectedRequests(new Set());
      setBulkMode(false);
      fetchRequests();
    } catch (error) {
      console.error('Bulk offer error:', error);
      alert('Kunde inte skapa offerter. Försök igen.');
    } finally {
      setBulkSubmitting(false);
    }
  };

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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Förfrågningar</h1>
          <p className="text-gray-500 mt-1">
            Förfrågningar från restauranger som väntar på ditt svar
          </p>
        </div>
        <button
          onClick={() => {
            setBulkMode(!bulkMode);
            if (bulkMode) clearSelection();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            bulkMode
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Zap className="h-4 w-4" />
          {bulkMode ? 'Avsluta bulkläge' : 'Bulksvara'}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {bulkMode && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-blue-800 font-medium">
                {selectedRequests.size} förfråg{selectedRequests.size === 1 ? 'an' : 'ningar'} valda
              </span>
              <button
                onClick={selectAllPending}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Välj alla väntande ({requests.filter(r => !r.has_offer).length})
              </button>
              {selectedRequests.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Rensa
                </button>
              )}
            </div>
            <button
              onClick={() => setShowBulkModal(true)}
              disabled={selectedRequests.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Skicka offerter ({selectedRequests.size})
            </button>
          </div>
        </div>
      )}

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
            <div
              key={request.id}
              className={`bg-white rounded-lg border p-4 transition-all ${
                bulkMode && selectedRequests.has(request.id)
                  ? 'border-blue-400 bg-blue-50/50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox for bulk mode */}
                {bulkMode && !request.has_offer && (
                  <button
                    onClick={() => toggleSelection(request.id)}
                    className="mt-1 flex-shrink-0"
                  >
                    {selectedRequests.has(request.id) ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                )}

                {/* Already responded - show disabled checkbox */}
                {bulkMode && request.has_offer && (
                  <div className="mt-1 flex-shrink-0">
                    <CheckSquare className="h-5 w-5 text-green-400" />
                  </div>
                )}

                <a
                  href={`/supplier/requests/${request.id}`}
                  className="flex-1 block"
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
                        {request.budget_sek && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">{request.budget_sek} kr/fl</span>
                          </>
                        )}
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
              </div>
            </div>
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
            <p className="text-sm text-blue-700 mt-2">
              <strong>Tips:</strong> Använd &quot;Bulksvara&quot; för att svara på flera förfrågningar samtidigt!
            </p>
          </div>
        </div>
      </div>

      {/* Bulk Offer Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Skicka {selectedRequests.size} offerter
                </h2>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary of selected requests */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Valda förfrågningar:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {Array.from(selectedRequests).map(id => {
                    const req = requests.find(r => r.id === id);
                    return req ? (
                      <div key={id} className="text-sm text-gray-600 flex justify-between">
                        <span>{req.restaurant_name}</span>
                        <span className="text-gray-400">{req.quantity} fl</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Price input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pris per flaska (SEK)
                </label>
                <input
                  type="number"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  placeholder="Lämna tomt för att använda restaurangens budget"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lämna tomt för att använda varje restaurangs angivna budget
                </p>
              </div>

              {/* Lead time input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leveranstid (dagar)
                </label>
                <select
                  value={bulkLeadTime}
                  onChange={(e) => setBulkLeadTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={submitBulkOffers}
                disabled={bulkSubmitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {bulkSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Skickar...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Skicka alla offerter
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
