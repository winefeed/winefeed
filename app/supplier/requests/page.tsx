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

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Clock, Building2, Wine, ChevronRight, AlertCircle, CheckSquare, Square, Zap, X, Truck, Send, AlertTriangle, CheckCircle } from 'lucide-react';

// ============================================================================
// URGENCY HELPERS
// ============================================================================

type UrgencyLevel = 'critical' | 'urgent' | 'normal' | 'expired';

interface DeadlineInfo {
  label: string;
  urgency: UrgencyLevel;
  hoursLeft: number;
}

function getDeadlineInfo(expiresAt: string | null, isExpired: boolean): DeadlineInfo {
  if (isExpired || !expiresAt) {
    return { label: 'Utgången', urgency: 'expired', hoursLeft: -1 };
  }

  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return { label: 'Utgången', urgency: 'expired', hoursLeft: -1 };
  }

  if (diffHours < 4) {
    return { label: `${diffHours}h kvar`, urgency: 'critical', hoursLeft: diffHours };
  }

  if (diffHours < 24) {
    return { label: 'Utgår idag', urgency: 'critical', hoursLeft: diffHours };
  }

  if (diffDays === 1) {
    return { label: 'Utgår imorgon', urgency: 'urgent', hoursLeft: diffHours };
  }

  if (diffDays <= 3) {
    return { label: `${diffDays} dagar kvar`, urgency: 'urgent', hoursLeft: diffHours };
  }

  return { label: `${diffDays} dagar kvar`, urgency: 'normal', hoursLeft: diffHours };
}

function getUrgencyStyles(urgency: UrgencyLevel): { badge: string; dot: string } {
  switch (urgency) {
    case 'critical':
      return {
        badge: 'bg-red-100 text-red-800 border-red-200',
        dot: 'bg-red-500 animate-pulse'
      };
    case 'urgent':
      return {
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        dot: 'bg-amber-500'
      };
    case 'expired':
      return {
        badge: 'bg-gray-100 text-gray-500 border-gray-200',
        dot: 'bg-gray-400'
      };
    default:
      return {
        badge: 'bg-green-100 text-green-800 border-green-200',
        dot: 'bg-green-500'
      };
  }
}

function getLastActivityInfo(request: QuoteRequest): { label: string; isNew: boolean } {
  const now = new Date();

  // Check various activity timestamps
  const respondedAt = request.assignment.respondedAt ? new Date(request.assignment.respondedAt) : null;
  const viewedAt = request.assignment.viewedAt ? new Date(request.assignment.viewedAt) : null;
  const sentAt = request.assignment.sentAt ? new Date(request.assignment.sentAt) : null;
  const createdAt = new Date(request.createdAt);

  // Use the most recent activity
  const lastActivity = respondedAt || viewedAt || sentAt || createdAt;
  const diffMs = now.getTime() - lastActivity.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Mark as "new" if less than 2 hours old and not viewed/responded
  const isNew = !viewedAt && !respondedAt && diffHours < 2;

  if (isNew) {
    return { label: 'Ny', isNew: true };
  }

  if (diffHours < 1) {
    return { label: 'Uppdaterad nyss', isNew: false };
  }

  if (diffHours < 24) {
    return { label: `Uppdaterad ${diffHours}h sedan`, isNew: false };
  }

  if (diffDays === 1) {
    return { label: 'Uppdaterad igår', isNew: false };
  }

  return { label: `Uppdaterad ${diffDays}d sedan`, isNew: false };
}

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
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'urgent'>('all');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'urgency' | 'date'>('urgency');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Quick respond modal state
  const [quickRespondRequest, setQuickRespondRequest] = useState<QuoteRequest | null>(null);
  const [quickRespondPrice, setQuickRespondPrice] = useState('');
  const [quickRespondNote, setQuickRespondNote] = useState('');
  const [quickRespondSubmitting, setQuickRespondSubmitting] = useState(false);

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

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Quick respond handler
  const submitQuickRespond = async () => {
    if (!quickRespondRequest || !supplierId) return;

    const price = quickRespondPrice ? parseInt(quickRespondPrice) : quickRespondRequest.budgetPerFlaska;
    if (!price || price <= 0) {
      showToast('Ange ett giltigt pris', 'error');
      return;
    }

    setQuickRespondSubmitting(true);
    try {
      const response = await fetch(`/api/quote-requests/${quickRespondRequest.id}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '00000000-0000-0000-0000-000000000001'
        },
        body: JSON.stringify({
          supplier_id: supplierId,
          price_sek: price,
          quantity: quickRespondRequest.antalFlaskor || 24,
          lead_time_days: 14,
          notes: quickRespondNote || `Offert: ${quickRespondRequest.fritext}`,
        })
      });

      if (response.ok) {
        const restaurantName = quickRespondRequest.restaurantName;
        setQuickRespondRequest(null);
        setQuickRespondPrice('');
        setQuickRespondNote('');
        showToast(`Offert skickad till ${restaurantName}!`, 'success');
        fetchRequests();
      } else {
        const error = await response.json();
        showToast(error.error || 'Kunde inte skicka offert', 'error');
      }
    } catch (error) {
      showToast('Ett fel uppstod - kontrollera nätverket', 'error');
    } finally {
      setQuickRespondSubmitting(false);
    }
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

      // Refresh and reset
      setShowBulkModal(false);
      setSelectedRequests(new Set());
      setBulkMode(false);
      fetchRequests();

      if (failed > 0) {
        showToast(`${successful} offerter skickade, ${failed} misslyckades`, 'error');
      } else {
        showToast(`${successful} offerter skickade!`, 'success');
      }
    } catch (error) {
      console.error('Bulk offer error:', error);
      showToast('Kunde inte skapa offerter - försök igen', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Sorted and filtered requests
  const sortedRequests = useMemo(() => {
    let filtered = [...requests];

    // Apply status filter
    if (filter === 'pending') {
      filtered = filtered.filter(r => r.myOfferCount === 0);
    } else if (filter === 'responded') {
      filtered = filtered.filter(r => r.myOfferCount > 0);
    }

    // Apply urgency filter
    if (urgencyFilter !== 'all') {
      filtered = filtered.filter(r => {
        const info = getDeadlineInfo(r.assignment.expiresAt, r.assignment.isExpired);
        if (urgencyFilter === 'critical') return info.urgency === 'critical';
        if (urgencyFilter === 'urgent') return info.urgency === 'critical' || info.urgency === 'urgent';
        return true;
      });
    }

    // Sort by urgency (most urgent first) or date
    if (sortBy === 'urgency') {
      filtered.sort((a, b) => {
        const aInfo = getDeadlineInfo(a.assignment.expiresAt, a.assignment.isExpired);
        const bInfo = getDeadlineInfo(b.assignment.expiresAt, b.assignment.isExpired);

        // 1. Expired ones go to the end
        if (aInfo.urgency === 'expired' && bInfo.urgency !== 'expired') return 1;
        if (bInfo.urgency === 'expired' && aInfo.urgency !== 'expired') return -1;

        // 2. Primary: sort by hours left (ascending = most urgent first)
        if (aInfo.hoursLeft !== bInfo.hoursLeft) {
          return aInfo.hoursLeft - bInfo.hoursLeft;
        }

        // 3. Secondary: deadline closest first (for same hoursLeft bucket)
        const aExpires = new Date(a.assignment.expiresAt || 0).getTime();
        const bExpires = new Date(b.assignment.expiresAt || 0).getTime();
        if (aExpires !== bExpires) {
          return aExpires - bExpires;
        }

        // 4. Tertiary: newest created first (for deterministic order)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  }, [requests, filter, urgencyFilter, sortBy]);

  // Count urgent requests that need attention today
  const urgentCount = useMemo(() => {
    return requests.filter(r => {
      if (r.myOfferCount > 0) return false; // Already responded
      const info = getDeadlineInfo(r.assignment.expiresAt, r.assignment.isExpired);
      return info.urgency === 'critical' || info.urgency === 'urgent';
    }).length;
  }, [requests]);

  const criticalCount = useMemo(() => {
    return requests.filter(r => {
      if (r.myOfferCount > 0) return false;
      const info = getDeadlineInfo(r.assignment.expiresAt, r.assignment.isExpired);
      return info.urgency === 'critical';
    }).length;
  }, [requests]);

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
      {/* Urgent Notification Banner - Clickable to filter */}
      {criticalCount > 0 && (
        <button
          onClick={() => {
            setFilter('pending');
            setUrgencyFilter('critical');
          }}
          className="w-full mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 hover:bg-red-100 transition-colors text-left"
        >
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-800">
              {criticalCount} {criticalCount === 1 ? 'förfrågan kräver' : 'förfrågningar kräver'} svar idag!
            </p>
            <p className="text-sm text-red-700">Klicka för att visa endast brådskande</p>
          </div>
          <ChevronRight className="h-5 w-5 text-red-400" />
        </button>
      )}

      {urgentCount > 0 && criticalCount === 0 && (
        <button
          onClick={() => {
            setFilter('pending');
            setUrgencyFilter('urgent');
          }}
          className="w-full mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 hover:bg-amber-100 transition-colors text-left"
        >
          <div className="flex-shrink-0">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-amber-800">
              {urgentCount} {urgentCount === 1 ? 'förfrågan' : 'förfrågningar'} med kort deadline
            </p>
            <p className="text-sm text-amber-700">Klicka för att visa endast brådskande</p>
          </div>
          <ChevronRight className="h-5 w-5 text-amber-400" />
        </button>
      )}

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

      {/* Filter Tabs + Sort */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setFilter('pending'); setUrgencyFilter('all'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending' && urgencyFilter === 'all'
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
            onClick={() => { setFilter('responded'); setUrgencyFilter('all'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'responded'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Besvarade
          </button>
          <button
            onClick={() => { setFilter('all'); setUrgencyFilter('all'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' && urgencyFilter === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Alla
          </button>

          {/* Active urgency filter indicator */}
          {urgencyFilter !== 'all' && (
            <button
              onClick={() => setUrgencyFilter('all')}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors flex items-center gap-1"
            >
              {urgencyFilter === 'critical' ? 'Endast kritiska' : 'Brådskande'}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sort Toggle */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Sortera:</span>
          <button
            onClick={() => setSortBy('urgency')}
            className={`px-3 py-1 rounded ${sortBy === 'urgency' ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Brådskande först
          </button>
          <button
            onClick={() => setSortBy('date')}
            className={`px-3 py-1 rounded ${sortBy === 'date' ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Nyast först
          </button>
        </div>
      </div>

      {/* Request List */}
      {sortedRequests.length > 0 ? (
        <div className="space-y-3">
          {sortedRequests.map((request) => {
            const deadlineInfo = getDeadlineInfo(request.assignment.expiresAt, request.assignment.isExpired);
            const urgencyStyles = getUrgencyStyles(deadlineInfo.urgency);
            const activityInfo = getLastActivityInfo(request);
            return (
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
                        {request.myOfferCount === 0 && activityInfo.isNew && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                            Ny
                          </span>
                        )}
                        {request.myOfferCount === 0 && !activityInfo.isNew && (
                          <span className="text-xs text-gray-400">
                            {activityInfo.label}
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

                      {/* Time + Deadline */}
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyStyles.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${urgencyStyles.dot}`}></span>
                              {deadlineInfo.label}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2">
                      {request.myOfferCount > 0 ? (
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                          Offert skickad
                        </span>
                      ) : (
                        <>
                          {/* Quick Respond Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setQuickRespondRequest(request);
                              setQuickRespondPrice(request.budgetPerFlaska?.toString() || '');
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <Send className="h-3 w-3" />
                            Svara
                          </button>
                        </>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </a>
              </div>
            </div>
          );
          })}
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

      {/* Success indicator when all urgent are handled */}
      {requests.length > 0 && pendingCount === 0 && filter === 'pending' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-lg">🎉</span>
          </div>
          <div>
            <p className="font-medium text-green-800">Alla förfrågningar besvarade!</p>
            <p className="text-sm text-green-700">Du har svarat på alla inkommande förfrågningar.</p>
          </div>
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

      {/* Quick Respond Modal */}
      {quickRespondRequest && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuickRespondRequest(null);
              setQuickRespondPrice('');
              setQuickRespondNote('');
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Snabbsvar</h2>
                <button
                  onClick={() => {
                    setQuickRespondRequest(null);
                    setQuickRespondPrice('');
                    setQuickRespondNote('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (quickRespondPrice && !quickRespondSubmitting) {
                  submitQuickRespond();
                }
              }}
              className="p-6 space-y-4"
            >
              {/* Request summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-900">{quickRespondRequest.restaurantName}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{quickRespondRequest.fritext}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  {quickRespondRequest.antalFlaskor && <span>{quickRespondRequest.antalFlaskor} flaskor</span>}
                  {quickRespondRequest.budgetPerFlaska && <span>Budget: {quickRespondRequest.budgetPerFlaska} kr/fl</span>}
                </div>
                {/* Deadline warning */}
                {(() => {
                  const info = getDeadlineInfo(quickRespondRequest.assignment.expiresAt, quickRespondRequest.assignment.isExpired);
                  const styles = getUrgencyStyles(info.urgency);
                  return info.urgency !== 'normal' && info.urgency !== 'expired' ? (
                    <div className={`mt-3 px-3 py-2 rounded-lg border ${styles.badge}`}>
                      <span className="text-sm font-medium">{info.label}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Price input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ditt pris per flaska (SEK) *
                </label>
                <input
                  type="number"
                  value={quickRespondPrice}
                  onChange={(e) => setQuickRespondPrice(e.target.value)}
                  placeholder={quickRespondRequest.budgetPerFlaska?.toString() || 'Ange pris'}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                />
              </div>

              {/* Note input (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kommentar (valfritt)
                </label>
                <input
                  type="text"
                  value={quickRespondNote}
                  onChange={(e) => setQuickRespondNote(e.target.value)}
                  placeholder="T.ex. Kan leverera inom 7 dagar"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setQuickRespondRequest(null);
                    setQuickRespondPrice('');
                    setQuickRespondNote('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={quickRespondSubmitting || !quickRespondPrice}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                {quickRespondSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
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
            </form>
          </div>
        </div>
      )}

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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
