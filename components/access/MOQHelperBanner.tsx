/**
 * MOQ HELPER BANNER - UI Component
 *
 * Shows MOQ fill-up suggestions for ACCEPTED requests.
 * Feature flag: FEATURE_MOQ_HELPER (default: false)
 *
 * DISPLAYS WHEN:
 * 1. Feature flag is enabled (NEXT_PUBLIC_FEATURE_MOQ_HELPER=true)
 * 2. Request status is ACCEPTED (besvarad/meddelad/slutford)
 * 3. Importer has MOQ set
 * 4. Current quantity is below MOQ
 *
 * NO CART, NO CHECKOUT, NO PAYMENT:
 * - indicative_price_sek is for display context only
 * - No totals shown
 * - No checkout button
 * - Adding items = adding to RFQ, not cart
 *
 * GUARDRAILS IN UI:
 * - [ ] No "total" or "subtotal" displayed
 * - [ ] No "checkout" or "pay" buttons
 * - [ ] Price shown as "ca X kr" (approximate, context only)
 * - [ ] Clear messaging: "Lägg till för att nå importörens minimum"
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Minus, X, Check, Loader2, Wine, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface MOQStatus {
  moq_bottles: number | null;
  current_bottles: number;
  deficit: number;
  is_met: boolean;
  moq_note: string | null;
}

interface MOQSuggestion {
  lot_id: string;
  wine_id: string;
  wine_name: string;
  vintage: number | null;
  wine_type: string | null;
  producer_name: string | null;
  appellation: string | null;
  indicative_price_sek: number | null;
  match_reason: 'same_producer' | 'same_type' | 'same_importer';
}

interface AccessRequestItem {
  id: string;
  lot_id: string;
  wine_name: string;
  vintage: number | null;
  quantity: number;
}

interface MOQHelperResponse {
  status: MOQStatus;
  suggestions: MOQSuggestion[];
  added_items: AccessRequestItem[];
}

interface MOQHelperBannerProps {
  requestId: string;
  onItemAdded?: () => void;
  className?: string;
}

// ============================================
// FEATURE FLAG CHECK
// ============================================

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_MOQ_HELPER === 'true';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatWineName(name: string, vintage: number | null): string {
  if (vintage === null) {
    if (/\bNV\b|non.?vintage/i.test(name)) return name;
    return `${name} NV`;
  }
  if (name.includes(String(vintage))) return name;
  return `${name} ${vintage}`;
}

function formatMatchReason(reason: string): string {
  switch (reason) {
    case 'same_producer': return 'Samma producent';
    case 'same_type': return 'Samma typ';
    default: return 'Samma importör';
  }
}

// ============================================
// COMPONENT
// ============================================

export function MOQHelperBanner({
  requestId,
  onItemAdded,
  className,
}: MOQHelperBannerProps) {
  const [data, setData] = useState<MOQHelperResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [addingLotId, setAddingLotId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Fetch MOQ data
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/access/requests/${requestId}/moq`);
      if (response.status === 404) {
        // Feature disabled or not applicable
        setData(null);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load MOQ helper');
      }
      const result = await response.json();
      setData(result);

      // Initialize quantities to 1 for each suggestion
      const initQty: Record<string, number> = {};
      result.suggestions.forEach((s: MOQSuggestion) => {
        initQty[s.lot_id] = 1;
      });
      setQuantities(initQty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!FEATURE_ENABLED) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [fetchData]);

  // Add item handler
  const handleAddItem = async (lotId: string) => {
    const qty = quantities[lotId] || 1;
    setAddingLotId(lotId);

    try {
      const response = await fetch(`/api/access/requests/${requestId}/moq/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: lotId, quantity: qty }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || 'Failed to add item');
      }

      // Refresh data
      await fetchData();
      onItemAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setAddingLotId(null);
    }
  };

  // Remove item handler
  const handleRemoveItem = async (itemId: string) => {
    try {
      const response = await fetch(
        `/api/access/requests/${requestId}/moq/add?item_id=${itemId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      await fetchData();
      onItemAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  };

  // Dismiss handler
  const handleDismiss = async () => {
    setDismissed(true);
    // Log dismissal
    try {
      await fetch(`/api/access/requests/${requestId}/moq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'DISMISSED', payload: {} }),
      });
    } catch {
      // Ignore logging errors
    }
  };

  // Quantity handlers
  const incrementQty = (lotId: string) => {
    setQuantities(q => ({ ...q, [lotId]: Math.min((q[lotId] || 1) + 1, 24) }));
  };

  const decrementQty = (lotId: string) => {
    setQuantities(q => ({ ...q, [lotId]: Math.max((q[lotId] || 1) - 1, 1) }));
  };

  // ============================================
  // RENDER GUARDS
  // ============================================

  // Feature disabled
  if (!FEATURE_ENABLED) return null;

  // Loading
  if (loading) {
    return (
      <div className={cn('p-4 bg-gray-50 rounded-lg animate-pulse', className)}>
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  // No data or dismissed
  if (!data || dismissed) return null;

  // MOQ already met
  if (data.status.is_met) {
    return (
      <div className={cn(
        'p-4 bg-emerald-50 border border-emerald-200 rounded-lg',
        className
      )}>
        <div className="flex items-center gap-2 text-emerald-700">
          <Check className="h-5 w-5" />
          <span className="font-medium">
            Minimum uppnått ({data.status.current_bottles} av {data.status.moq_bottles} flaskor)
          </span>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className={cn(
      'border border-amber-200 bg-amber-50 rounded-xl overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Package className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-900">
              Fyll upp till importörens minimum
            </h3>
            <p className="text-sm text-amber-700 mt-0.5">
              Du har {data.status.current_bottles} av {data.status.moq_bottles} flaskor.
              {' '}Lägg till {data.status.deficit} till för att nå minimum.
            </p>
            {data.status.moq_note && (
              <p className="text-xs text-amber-600 mt-1 italic">
                {data.status.moq_note}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-amber-400 hover:text-amber-600 transition-colors"
          aria-label="Stäng"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Added Items */}
      {data.added_items.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-medium text-amber-700 mb-2">Tillagda viner:</p>
          <div className="space-y-2">
            {data.added_items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-white border border-amber-200 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Wine className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-gray-900">
                    {formatWineName(item.wine_name, item.vintage)}
                  </span>
                  <span className="text-xs text-gray-500">
                    × {item.quantity}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Ta bort"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div className="p-4 pt-0">
          <p className="text-xs font-medium text-amber-700 mb-3">
            Förslag från samma importör:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.suggestions.map(suggestion => (
              <div
                key={suggestion.lot_id}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-amber-300 transition-colors"
              >
                {/* Wine info */}
                <div className="mb-2">
                  <p className="font-medium text-gray-900 text-sm leading-tight">
                    {formatWineName(suggestion.wine_name, suggestion.vintage)}
                  </p>
                  {suggestion.producer_name && (
                    <p className="text-xs text-gray-500">
                      {suggestion.producer_name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {suggestion.wine_type && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {suggestion.wine_type}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatMatchReason(suggestion.match_reason)}
                    </span>
                  </div>
                  {/*
                    GUARDRAIL: Price shown as indicative only, no totals
                    This is context info, NOT for checkout
                  */}
                  {suggestion.indicative_price_sek && (
                    <p className="text-xs text-gray-400 mt-1">
                      ca {suggestion.indicative_price_sek} kr/fl
                    </p>
                  )}
                </div>

                {/* Quantity & Add */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button
                      onClick={() => decrementQty(suggestion.lot_id)}
                      disabled={quantities[suggestion.lot_id] <= 1}
                      className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-sm font-medium min-w-[24px] text-center">
                      {quantities[suggestion.lot_id] || 1}
                    </span>
                    <button
                      onClick={() => incrementQty(suggestion.lot_id)}
                      disabled={quantities[suggestion.lot_id] >= 24}
                      className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleAddItem(suggestion.lot_id)}
                    disabled={addingLotId === suggestion.lot_id}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                      'bg-amber-500 text-white hover:bg-amber-600',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center justify-center gap-1.5'
                    )}
                  >
                    {addingLotId === suggestion.lot_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Lägg till
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
        GUARDRAIL COMMENT:
        - NO "Total" display
        - NO "Checkout" button
        - NO payment flow
        This is a fill-up helper, not a cart.
      */}
    </div>
  );
}

export default MOQHelperBanner;
