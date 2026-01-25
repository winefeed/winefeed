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

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Clock, Building2, Wine, ChevronRight, AlertCircle, CheckSquare, Square, Zap, X, Truck } from 'lucide-react';

interface QuoteRequest {
  id: string;
  restaurantId: string;
  restaurantName: string;
  fritext: string;
  budgetPerFlaska: number | null;
  antalFlaskor: number | null;
  leveransSenast: string | null;
  leveransOrt: string | null; // For shipping calculation
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
  const [bulkShippingType, setBulkShippingType] = useState<'franco' | 'specified'>('specified');
  const [bulkShippingCost, setBulkShippingCost] = useState('');
  const [bulkShippingNotes, setBulkShippingNotes] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
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
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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
    const pendingIds = requests.filter(r => r.myOfferCount === 0).map(r => r.id);
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
              price_sek: bulkPrice ? parseInt(bulkPrice) : (request.budgetPerFlaska || 100),
              quantity: request.antalFlaskor || 24,
              lead_time_days: parseInt(bulkLeadTime),
              notes: `Offert: ${request.fritext}`,
              // Shipping information
              is_franco: bulkShippingType === 'franco',
              shipping_cost_sek: bulkShippingType === 'specified' && bulkShippingCost
                ? parseInt(bulkShippingCost)
                : null,
              shipping_notes: bulkShippingNotes || null
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

  const pendingCount = requests.filter((r) => r.myOfferCount === 0).length;
  const respondedCount = requests.filter((r) => r.myOfferCount > 0).length;

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
                Välj alla väntande ({requests.filter(r => r.myOfferCount === 0).length})
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
                {bulkMode && request.myOfferCount === 0 && (
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
                {bulkMode && request.myOfferCount > 0 && (
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
                          {request.restaurantName}
                        </span>
                        {request.myOfferCount === 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                            Ny
                          </span>
                        )}
                      </div>

                      {/* Request info */}
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Wine className="h-4 w-4 text-gray-400" />
                          <span className="line-clamp-1">{request.fritext}</span>
                        </div>
                        {request.antalFlaskor && (
                          <>
                            <span>•</span>
                            <span>{request.antalFlaskor} flaskor</span>
                          </>
                        )}
                        {request.budgetPerFlaska && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">{request.budgetPerFlaska} kr/fl</span>
                          </>
                        )}
                      </div>

                      {/* Delivery location - important for shipping calculation */}
                      {request.leveransOrt && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <Truck className="h-4 w-4 text-blue-500" />
                          <span className="text-blue-700 font-medium">
                            Leverans till: {request.leveransOrt}
                          </span>
                        </div>
                      )}

                      {/* Special requirements */}
                      {request.specialkrav && request.specialkrav.length > 0 && (
                        <p className="mt-2 text-sm text-gray-500">
                          Krav: {request.specialkrav.join(', ')}
                        </p>
                      )}

                      {/* Time */}
                      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(request.createdAt).toLocaleDateString('sv-SE', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {request.assignment.expiresAt && (
                          <>
                            <span>•</span>
                            <span className={request.assignment.isExpired ? 'text-red-600' : 'text-amber-600'}>
                              {request.assignment.isExpired ? 'Utgången' : `Svarstid: ${new Date(request.assignment.expiresAt).toLocaleDateString('sv-SE')}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status & Arrow */}
                    <div className="flex items-center gap-3">
                      {request.myOfferCount > 0 ? (
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
                        <span>{req.restaurantName}</span>
                        <span className="text-gray-400">{req.antalFlaskor || 0} fl</span>
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

              {/* Shipping section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">
                    Frakt
                  </label>
                </div>

                {/* Shipping type selection */}
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="shippingType"
                      checked={bulkShippingType === 'specified'}
                      onChange={() => setBulkShippingType('specified')}
                      className="text-blue-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Ange fraktkostnad</span>
                      <p className="text-xs text-gray-500">Separat frakt tillkommer utöver vinpriset</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="shippingType"
                      checked={bulkShippingType === 'franco'}
                      onChange={() => setBulkShippingType('franco')}
                      className="text-blue-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Fritt levererat (franco)</span>
                      <p className="text-xs text-gray-500">Frakt ingår i priset</p>
                    </div>
                  </label>
                </div>

                {/* Shipping cost input - only shown if specified */}
                {bulkShippingType === 'specified' && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fraktkostnad (SEK)
                    </label>
                    <input
                      type="number"
                      value={bulkShippingCost}
                      onChange={(e) => setBulkShippingCost(e.target.value)}
                      placeholder="T.ex. 500"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Total fraktkostnad för hela leveransen
                    </p>
                  </div>
                )}

                {/* Shipping notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fraktnotering (valfritt)
                  </label>
                  <input
                    type="text"
                    value={bulkShippingNotes}
                    onChange={(e) => setBulkShippingNotes(e.target.value)}
                    placeholder="T.ex. Leverans Sthlm, andra orter +200 kr"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
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
