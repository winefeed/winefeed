'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActor } from '@/lib/hooks/useActor';
import { useDraftList } from '@/lib/hooks/useDraftList';
import { formatPrice } from '@/lib/utils';
import { CheckCircle2, Filter, X, ChevronDown, ChevronUp, Bell, ArrowRight, Inbox, AlertCircle, AlertTriangle, ListPlus, ShoppingCart, Check, Info, Minus, Plus, Wine, HelpCircle, Send, Menu, Star } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { FloatingDraftList } from '@/components/FloatingDraftList';
import { Spinner } from '@/components/ui/spinner';
import { HelpTooltip, InfoBox, GLOSSARY } from '@/components/ui/help-tooltip';
import { RefinePanel, DeliveryTime } from '@/components/rfq/RefinePanel';

interface Wine {
  id: string;
  namn: string;
  producent: string;
  land: string;
  region?: string;
  appellation?: string;
  druva?: string;
  color?: string;
  argang?: number;
  pris_sek: number;
  // Extended details
  alkohol?: number;
  volym_ml?: number;
  beskrivning?: string;
  sku?: string;
  lager?: number;
  moq?: number;
  kartong?: number;
  ledtid_dagar?: number;
  ekologisk?: boolean;
  biodynamiskt?: boolean;
  veganskt?: boolean;
  location?: 'domestic' | 'eu' | null;
}

interface Supplier {
  id?: string;
  namn: string;
  kontakt_email: string;
  normalleveranstid_dagar?: number;
  min_order_bottles?: number;
  min_order_value_sek?: number | null;
  provorder_enabled?: boolean;
  provorder_fee_sek?: number;
  payment_terms?: string | null;
}

interface MarketData {
  lowest_price: number;
  merchant_name: string;
  merchant_count: number;
  price_difference: number;
  price_difference_percent: string;
}

interface ScoreBreakdownData {
  stil: number;       // 0-15
  druva: number;      // 0-20
  mat: number;        // 0-15
  region: number;     // 0-15
  pris: number;       // 0-20
  klassiker: number;  // 0-10
  kok: number;        // 0-8
}

interface Suggestion {
  wine: Wine;
  supplier: Supplier;
  motivering: string;
  ranking_score: number;
  score_breakdown?: ScoreBreakdownData;
  golden_pair_reason?: string | null;
  market_data?: MarketData | null;
}

type SortOption = 'score' | 'price_asc' | 'price_desc' | 'country' | 'producer';

const COLOR_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  red: { label: 'Rött', bg: 'bg-red-100', text: 'text-red-700' },
  white: { label: 'Vitt', bg: 'bg-amber-50', text: 'text-amber-700' },
  rose: { label: 'Rosé', bg: 'bg-pink-100', text: 'text-pink-700' },
  sparkling: { label: 'Mousserande', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  orange: { label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700' },
  alcohol_free: { label: 'Alkoholfritt', bg: 'bg-teal-100', text: 'text-teal-700' },
  fortified: { label: 'Starkvin', bg: 'bg-amber-200', text: 'text-amber-800' },
  spirit: { label: 'Sprit', bg: 'bg-violet-200', text: 'text-violet-800' },
};

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [relaxedMessage, setRelaxedMessage] = useState<string | null>(null);
  const [selectedWines, setSelectedWines] = useState<Set<string>>(new Set());
  const [expandedWines, setExpandedWines] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [offersCount, setOffersCount] = useState(0);
  const [newOffersCount, setNewOffersCount] = useState(0);
  const [requestedQuantity, setRequestedQuantity] = useState<number | null>(null);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [wineQuantities, setWineQuantities] = useState<Record<string, number>>({});
  const [deliveryCity, setDeliveryCity] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<DeliveryTime>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchDescription, setSearchDescription] = useState<string>('');
  const [wineType, setWineType] = useState<string>('all');
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  const [justAdjustedToMoq, setJustAdjustedToMoq] = useState<string | null>(null);
  const [provorderWines, setProvorderWines] = useState<Set<string>>(new Set());
  // Track wines where user has actively chosen to adjust to MOQ
  const [userAdjustedToMoq, setUserAdjustedToMoq] = useState<Set<string>>(new Set());

  // Score breakdown expanded state
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());

  // Food suggestions per wine (keyed by wineId)
  const [foodSuggestionsMap, setFoodSuggestionsMap] = useState<Record<string, { food: string; score: number; isGoldenPair: boolean; reason?: string }[]>>({});
  const [foodSuggestionsLoading, setFoodSuggestionsLoading] = useState<Set<string>>(new Set());

  // Similar wines per wine (keyed by wineId)
  interface SimilarWineResult {
    wine: {
      id: string;
      name: string;
      producer: string;
      country: string;
      region?: string;
      grape?: string;
      color?: string;
      vintage?: number;
      price_ex_vat_sek: number;
      supplier_id: string;
      supplier_name: string;
      moq?: number;
      stock_qty?: number;
      organic?: boolean;
      biodynamic?: boolean;
    };
    similarity: number;
    reasons: string[];
  }
  const [similarWinesMap, setSimilarWinesMap] = useState<Record<string, SimilarWineResult[]>>({});
  const [similarWinesLoading, setSimilarWinesLoading] = useState<Set<string>>(new Set());

  // Draft list (Spara till lista)
  const draftList = useDraftList();

  // Toast notifications
  const toast = useToast();

  // Check if an order meets minimum requirements (bottle MOQ OR value threshold)
  const checkMeetsMinimum = (qty: number, moq: number, pricePerBottle: number, supplier: Supplier): boolean => {
    const meetsQuantity = moq <= 0 || qty >= moq;
    const minValueSek = supplier.min_order_value_sek;
    const meetsValue = minValueSek != null && (qty * pricePerBottle) >= minValueSek;
    return meetsQuantity || meetsValue;
  };

  // Get quantity for a wine - NO auto-adjustment, user must actively choose
  const getWineQuantity = (wineId: string, moq: number) => {
    // If user has set a specific quantity, use it
    if (wineQuantities[wineId] !== undefined) return wineQuantities[wineId];
    // Otherwise, use the original requested quantity (don't auto-adjust to MOQ)
    if (requestedQuantity && requestedQuantity > 0) {
      return requestedQuantity;
    }
    // Fallback default
    return moq > 0 ? moq : 6;
  };

  // Handle user clicking to adjust to MOQ
  const handleAdjustToMoq = (wineId: string, moq: number) => {
    setWineQuantities(prev => ({ ...prev, [wineId]: moq }));
    setUserAdjustedToMoq(prev => {
      const newSet = new Set(prev);
      newSet.add(wineId);
      return newSet;
    });
  };

  const updateWineQuantity = (wineId: string, delta: number, moq: number) => {
    setWineQuantities(prev => {
      const current = getWineQuantity(wineId, moq);
      const newQty = Math.max(1, current + delta);
      return { ...prev, [wineId]: newQty };
    });
  };

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    priceMin: '',
    priceMax: '',
    country: 'all',
    producer: 'all',
    sortBy: 'score' as SortOption,
  });

  // Quick filters (always visible chips)
  const [quickFilters, setQuickFilters] = useState({
    color: null as string | null,  // 'red', 'white', 'rose', 'sparkling', etc.
    inStock: false,
    organic: false,
    withinBudget: false,
    location: null as 'domestic' | 'eu' | null,  // 'domestic' = I lager, 'eu' = Direktimport
  });

  const fetchOfferCounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/quote-requests/${requestId}/offers`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setOffersCount(data.summary?.total || data.offers?.length || 0);
        setNewOffersCount(data.summary?.active || 0);
      }
    } catch (err) {
      // Silently fail - offer count is non-critical
    }
  }, [requestId]);

  // Fetch request details to get requested quantity
  const fetchRequestDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRequestedQuantity(data.request?.quantity_bottles || data.request?.antal_flaskor || null);
      }
    } catch (err) {
      // Silently fail - request details are non-critical
    }
  }, [requestId]);

  useEffect(() => {
    const stored = sessionStorage.getItem('latest-suggestions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSuggestions(parsed);
        setSelectedWines(new Set());
      } catch (e) {
        console.error('Failed to parse suggestions:', e);
      }
    }
    const storedRelaxed = sessionStorage.getItem('latest-relaxed-message');
    if (storedRelaxed) {
      setRelaxedMessage(storedRelaxed);
    }

    // Get RFQ draft from sessionStorage (new flow)
    const rfqDraft = sessionStorage.getItem('rfq-draft');
    if (rfqDraft) {
      try {
        const draft = JSON.parse(rfqDraft);
        if (draft.budget) setBudgetMax(draft.budget);
        if (draft.quantity) setRequestedQuantity(draft.quantity);
        if (draft.deliveryCity) setDeliveryCity(draft.deliveryCity);
        if (draft.deliveryTime) setDeliveryTime(draft.deliveryTime);
        if (draft.freeText) setSearchDescription(draft.freeText);
        if (draft.wineType) setWineType(draft.wineType);
      } catch (e) {
        console.error('Failed to parse RFQ draft:', e);
      }
    }

    // Get search params from sessionStorage (legacy/fallback)
    const searchParams = sessionStorage.getItem('latest-search-params');
    if (searchParams) {
      try {
        const params = JSON.parse(searchParams);
        if (params.antal_flaskor && !requestedQuantity) {
          setRequestedQuantity(params.antal_flaskor);
        }
        if (params.budget_max && !budgetMax) {
          setBudgetMax(params.budget_max);
        }
        if (params.deliveryCity && !deliveryCity) {
          setDeliveryCity(params.deliveryCity);
        }
        if (params.freeText && !searchDescription) {
          setSearchDescription(params.freeText);
        }
        if (params.color && wineType === 'all') {
          setWineType(params.color);
        }
      } catch (e) {
        console.error('Failed to parse search params:', e);
      }
    }

    // Fetch user's default delivery city if none set
    if (!rfqDraft || !JSON.parse(rfqDraft).deliveryCity) {
      fetch('/api/me/restaurant')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.city && !deliveryCity) {
            setDeliveryCity(data.city);
          }
        })
        .catch(() => { /* ignore */ });
    }

    setLoading(false);

    // Fetch offer counts (still needed for incoming offers banner)
    fetchOfferCounts();

    // Close tooltip when clicking outside
    const handleClickOutside = () => setOpenTooltip(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
    // Also try API as fallback for quantity
    fetchRequestDetails();
  }, [fetchOfferCounts, fetchRequestDetails]);

  // Autosave draft to sessionStorage
  useEffect(() => {
    // Skip initial render
    if (loading) return;

    const draft = {
      freeText: searchDescription,
      wineType,
      deliveryCity,
      deliveryTime,
      budget: budgetMax,
      quantity: requestedQuantity,
    };
    sessionStorage.setItem('rfq-draft', JSON.stringify(draft));
    setLastSaved(new Date());
  }, [budgetMax, requestedQuantity, deliveryCity, deliveryTime, loading, searchDescription, wineType]);

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const countries = [...new Set(suggestions.map(s => s.wine.land))].sort();
    const producers = [...new Set(suggestions.map(s => s.wine.producent))].sort();
    return { countries, producers };
  }, [suggestions]);

  // Apply filters and sorting
  const filteredSuggestions = useMemo(() => {
    let result = [...suggestions];

    // Quick filters
    if (quickFilters.color) {
      result = result.filter(s => s.wine.color?.toLowerCase() === quickFilters.color);
    }
    if (quickFilters.inStock) {
      result = result.filter(s => s.wine.lager && s.wine.lager > 0);
    }
    if (quickFilters.organic) {
      result = result.filter(s => s.wine.ekologisk);
    }
    if (quickFilters.withinBudget && budgetMax) {
      result = result.filter(s => s.wine.pris_sek <= budgetMax);
    }
    if (quickFilters.location) {
      result = result.filter(s => {
        const loc = s.wine.location || 'domestic';
        return loc === quickFilters.location;
      });
    }

    // Price filters
    if (filters.priceMin) {
      const min = parseInt(filters.priceMin);
      result = result.filter(s => s.wine.pris_sek >= min);
    }
    if (filters.priceMax) {
      const max = parseInt(filters.priceMax);
      result = result.filter(s => s.wine.pris_sek <= max);
    }

    // Country filter
    if (filters.country !== 'all') {
      result = result.filter(s => s.wine.land === filters.country);
    }

    // Producer filter
    if (filters.producer !== 'all') {
      result = result.filter(s => s.wine.producent === filters.producer);
    }

    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.wine.pris_sek - b.wine.pris_sek);
        break;
      case 'price_desc':
        result.sort((a, b) => b.wine.pris_sek - a.wine.pris_sek);
        break;
      case 'country':
        result.sort((a, b) => a.wine.land.localeCompare(b.wine.land));
        break;
      case 'producer':
        result.sort((a, b) => a.wine.producent.localeCompare(b.wine.producent));
        break;
      case 'score':
      default:
        result.sort((a, b) => b.ranking_score - a.ranking_score);
        break;
    }

    return result;
  }, [suggestions, filters, quickFilters, budgetMax]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceMin) count++;
    if (filters.priceMax) count++;
    if (filters.country !== 'all') count++;
    if (filters.producer !== 'all') count++;
    // Quick filters
    if (quickFilters.color) count++;
    if (quickFilters.inStock) count++;
    if (quickFilters.organic) count++;
    if (quickFilters.withinBudget) count++;
    if (quickFilters.location) count++;
    return count;
  }, [filters, quickFilters]);

  // Count wines by color for filter badges
  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    suggestions.forEach(s => {
      const color = s.wine.color?.toLowerCase();
      if (color) {
        counts[color] = (counts[color] || 0) + 1;
      }
    });
    return counts;
  }, [suggestions]);

  // Count wines in stock
  const inStockCount = useMemo(() => {
    return suggestions.filter(s => s.wine.lager && s.wine.lager > 0).length;
  }, [suggestions]);

  // Count organic wines
  const organicCount = useMemo(() => {
    return suggestions.filter(s => s.wine.ekologisk).length;
  }, [suggestions]);

  // Count wines within budget
  const withinBudgetCount = useMemo(() => {
    if (!budgetMax) return 0;
    return suggestions.filter(s => s.wine.pris_sek <= budgetMax).length;
  }, [suggestions, budgetMax]);

  // Count wines by location
  const domesticCount = useMemo(() => {
    return suggestions.filter(s => !s.wine.location || s.wine.location === 'domestic').length;
  }, [suggestions]);

  const euCount = useMemo(() => {
    return suggestions.filter(s => s.wine.location === 'eu').length;
  }, [suggestions]);

  // Show location filters only when there's a mix
  const hasLocationMix = domesticCount > 0 && euCount > 0;

  const clearFilters = () => {
    setFilters({
      priceMin: '',
      priceMax: '',
      country: 'all',
      producer: 'all',
      sortBy: 'score',
    });
    setQuickFilters({
      color: null,
      inStock: false,
      organic: false,
      withinBudget: false,
      location: null,
    });
  };

  const toggleWineSelection = (wineId: string, suggestion?: Suggestion) => {
    const isCurrentlySelected = selectedWines.has(wineId);

    if (isCurrentlySelected) {
      // Deselecting - remove from both selectedWines and draftList
      setSelectedWines(prev => {
        const newSet = new Set(prev);
        newSet.delete(wineId);
        return newSet;
      });
      draftList.removeItem(wineId);
    } else {
      // Selecting - add to selectedWines, and try to add to draftList if data available
      setSelectedWines(prev => new Set([...prev, wineId]));

      // Add to draft list if we have the suggestion data
      if (suggestion) {
        const moq = suggestion.wine.moq || 1;
        const qty = getWineQuantity(wineId, moq);
        const meetsMin = checkMeetsMinimum(qty, moq, suggestion.wine.pris_sek, suggestion.supplier);
        const hasProvorder = provorderWines.has(wineId) && suggestion.supplier.provorder_enabled;

        // Only add to list if meets minimum or is provorder
        if (meetsMin || hasProvorder) {
          const existingItem = draftList.items.find(item => item.wine_id === wineId);
          if (!existingItem) {
            draftList.addItem({
              wine_id: wineId,
              wine_name: suggestion.wine.namn,
              producer: suggestion.wine.producent,
              country: suggestion.wine.land,
              region: suggestion.wine.region,
              vintage: suggestion.wine.argang,
              color: suggestion.wine.color,
              supplier_id: suggestion.supplier.id || suggestion.supplier.namn,
              supplier_name: suggestion.supplier.namn,
              quantity: qty,
              moq: moq,
              price_sek: suggestion.wine.pris_sek,
              stock: suggestion.wine.lager,
              lead_time_days: suggestion.wine.ledtid_dagar || suggestion.supplier.normalleveranstid_dagar,
              provorder: hasProvorder,
              provorder_fee: hasProvorder ? (suggestion.supplier.provorder_fee_sek || 500) : undefined,
            });
          }
        }
      }
    }
  };

  const toggleWineExpanded = (wineId: string) => {
    setExpandedWines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wineId)) {
        newSet.delete(wineId);
      } else {
        newSet.add(wineId);
        // Fetch food suggestions when expanding
        if (!foodSuggestionsMap[wineId] && !foodSuggestionsLoading.has(wineId)) {
          const matchingSuggestion = suggestions.find(s => s.wine.id === wineId);
          const suppId = matchingSuggestion?.supplier?.id;
          if (suppId) {
            setFoodSuggestionsLoading(prev => new Set(prev).add(wineId));
            fetch(`/api/suppliers/${suppId}/wines/${wineId}/food-suggestions`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.suggestions) {
                  setFoodSuggestionsMap(prev => ({ ...prev, [wineId]: data.suggestions }));
                }
              })
              .catch(() => {})
              .finally(() => {
                setFoodSuggestionsLoading(prev => {
                  const next = new Set(prev);
                  next.delete(wineId);
                  return next;
                });
              });
          }
        }

        // Fetch similar wines when expanding
        if (!similarWinesMap[wineId] && !similarWinesLoading.has(wineId)) {
          const matchingSuggestion = suggestions.find(s => s.wine.id === wineId);
          const suppId = matchingSuggestion?.supplier?.id;
          if (suppId) {
            setSimilarWinesLoading(prev => new Set(prev).add(wineId));
            fetch(`/api/suppliers/${suppId}/wines/${wineId}/similar`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.similar) {
                  // Only show wines with >= 40% similarity
                  const filtered = data.similar.filter((s: SimilarWineResult) => s.similarity >= 40);
                  setSimilarWinesMap(prev => ({ ...prev, [wineId]: filtered }));
                }
              })
              .catch(() => {})
              .finally(() => {
                setSimilarWinesLoading(prev => {
                  const next = new Set(prev);
                  next.delete(wineId);
                  return next;
                });
              });
          }
        }
      }
      return newSet;
    });
  };

  const handleRequestConfirmation = () => {
    if (draftList.items.length === 0) {
      toast.warning('Tom lista', 'Lägg till minst ett vin i din lista innan du skickar förfrågan');
      return;
    }

    // Budget and quantity are optional - no gating
    setShowConfirmModal(true);
  };

  // Can always send if there are items in the list
  const canSend = draftList.items.length > 0;

  const handleConfirmAndSend = async () => {
    setSending(true);
    try {
      // Dispatch the request to suppliers
      const response = await fetch(`/api/quote-requests/${requestId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          maxMatches: 10,
          minScore: 20,
          expiresInHours: 48,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // If already dispatched, treat as success
        if (response.status === 409) {
          // Already dispatched - continue as success
        } else {
          throw new Error(errorData.error || 'Kunde inte skicka förfrågan');
        }
      }

      setShowConfirmModal(false);
      setSent(true);

      // Clear the draft list after successfully sending the request
      draftList.clear();

      // Clear visual selections too
      setSelectedWines(new Set());

      // Show toast and redirect to "Mina förfrågningar" after showing success message
      toast.success('Förfrågan skickad!', 'Du dirigeras till dina förfrågningar...');
      setTimeout(() => {
        router.push('/dashboard/my-requests');
      }, 2500);
    } catch (error) {
      console.error('Failed to send request:', error);
      toast.error('Kunde inte skicka', error instanceof Error ? error.message : 'Försök igen senare');
    } finally {
      setSending(false);
    }
  };

  // Get selected wine details for confirmation modal - USE DRAFT LIST for accurate data
  const selectedWineDetails = useMemo(() => {
    return suggestions.filter(s => selectedWines.has(s.wine.id));
  }, [suggestions, selectedWines]);

  // Calculate total value from draftList (MOQ-aware quantities)
  const totalEstimatedValue = useMemo(() => {
    return draftList.items.reduce((sum, item) => sum + (item.price_sek * item.quantity), 0);
  }, [draftList.items]);

  // Total bottles from draftList
  const totalBottles = useMemo(() => {
    return draftList.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [draftList.items]);

  // Toggle score breakdown visibility
  const toggleBreakdown = (wineId: string) => {
    setExpandedBreakdowns(prev => {
      const next = new Set(prev);
      if (next.has(wineId)) {
        next.delete(wineId);
      } else {
        next.add(wineId);
      }
      return next;
    });
  };

  // Render a single breakdown bar row
  const renderBreakdownBar = (label: string, score: number, max: number) => {
    if (score <= 0) return null;
    const pct = Math.round((score / max) * 100);
    const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-gray-400';
    return (
      <div key={label} className="flex items-center gap-2 text-xs">
        <span className="w-16 text-muted-foreground truncate">{label}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right text-muted-foreground tabular-nums">{score}/{max}</span>
      </div>
    );
  };

  // Render the full score breakdown for a suggestion
  const renderScoreBreakdown = (suggestion: Suggestion) => {
    const bd = suggestion.score_breakdown;
    if (!bd) return null;

    const isExpanded = expandedBreakdowns.has(suggestion.wine.id);

    // Check if motivering is useful (not generic)
    const hasUsefulMotivering = suggestion.motivering &&
      !suggestion.motivering.includes('Baserat på dina kriterier') &&
      suggestion.motivering.length > 30;

    if (!isExpanded) return null;

    return (
      <div className="mt-2 space-y-2">
        {/* AI motivation quote */}
        {hasUsefulMotivering && (
          <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2 mb-2">
            {suggestion.motivering}
          </p>
        )}

        {/* Breakdown bars */}
        <div className="space-y-1.5">
          {renderBreakdownBar('Druva', bd.druva, 20)}
          {renderBreakdownBar('Pris', bd.pris, 20)}
          {renderBreakdownBar('Stil', bd.stil, 15)}
          {renderBreakdownBar('Mat', bd.mat, 15)}
          {renderBreakdownBar('Region', bd.region, 15)}
          {renderBreakdownBar('Kök', bd.kok, 8)}
        </div>

        {/* Golden pair special display */}
        {bd.klassiker > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-medium">
              {suggestion.golden_pair_reason || `Klassisk kombination (+${bd.klassiker})`}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Wine className="h-12 w-12 text-wine" />
              <Spinner size="lg" className="absolute inset-0 text-wine/30" />
            </div>
          </div>
          <p className="text-xl font-medium text-foreground">Genomsöker marknaden...</p>
          <p className="text-sm text-muted-foreground mt-2">Matchar viner efter dina behov</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 ${draftList.items.length > 0 && !sent ? 'pb-24' : ''}`}>
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🍷</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Winefeed</h1>
                <p className="text-sm text-primary-foreground/80">Din vininköpare</p>
              </div>
            </div>
            {/* Mobile header buttons */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => window.dispatchEvent(new Event('openMobileMenu'))}
                className="p-2 bg-primary-foreground/20 text-primary-foreground rounded-lg hover:bg-primary-foreground/30 transition-colors"
                aria-label="Meny"
              >
                <Menu className="h-5 w-5" />
              </button>
              {draftList.count > 0 && (
                <button
                  onClick={() => router.push('/dashboard/draft-list')}
                  className="relative p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-white text-amber-600 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {draftList.count}
                  </span>
                </button>
              )}
              <button
                onClick={handleRequestConfirmation}
                disabled={draftList.items.length === 0}
                title={draftList.items.length === 0 ? 'Välj minst ett vin' : 'Skicka förfrågan'}
                className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="h-4 w-4" />
                Skicka
              </button>
            </div>

            {/* Desktop header buttons */}
            <div className="hidden md:flex items-center gap-3">
              {/* Min lista - med badge */}
              <button
                onClick={() => router.push('/dashboard/draft-list')}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 ${
                  draftList.count > 0
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30'
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                Min lista
                {draftList.count > 0 && (
                  <span className="px-2 py-0.5 bg-white text-amber-600 text-xs font-bold rounded-full">
                    {draftList.count}
                  </span>
                )}
              </button>
              <button
                onClick={() => router.push('/dashboard/my-requests')}
                className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground rounded-lg hover:bg-primary-foreground/30 transition-colors text-sm font-medium"
              >
                Mina förfrågningar
              </button>
              <button
                onClick={() => router.push('/dashboard/offers')}
                className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground rounded-lg hover:bg-primary-foreground/30 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Inbox className="h-4 w-4" />
                Inkommande offerter
                {offersCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                    {offersCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => router.push('/dashboard/new-request')}
                className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors text-sm font-medium"
              >
                Ny förfrågan
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Results Header — compact */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {suggestions.length} matchande {suggestions.length === 1 ? 'vin' : 'viner'}
          </h1>
          {searchDescription && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              &quot;{searchDescription}&quot;
            </p>
          )}
          {relaxedMessage && (
            <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              {relaxedMessage}
            </div>
          )}
        </div>

        {/* Incoming Offers Banner */}
        {offersCount > 0 && (
          <div
            className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push(`/dashboard/offers/${requestId}`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Inbox className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-blue-900 text-lg">
                    {offersCount} offert{offersCount > 1 ? 'er' : ''} mottagna!
                  </p>
                  <p className="text-blue-700 text-sm">
                    Leverantörer har svarat på din förfrågan. Klicka här för att jämföra och acceptera.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-blue-600 font-medium group-hover:text-blue-800">
                <span>Granska offerter</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        )}

        {/* Refine Panel - Budget & Quantity (required for send) */}
        <div id="refine-panel" className="mb-6">
          <RefinePanel
            budget={budgetMax}
            quantity={requestedQuantity}
            onBudgetChange={(budget) => {
              setBudgetMax(budget);
            }}
            onQuantityChange={setRequestedQuantity}
            deliveryCity={deliveryCity}
            onDeliveryCityChange={setDeliveryCity}
            deliveryTime={deliveryTime}
            onDeliveryTimeChange={setDeliveryTime}
            lastSaved={lastSaved}
          />
        </div>

        {/* Quick Filters - Always Visible */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Color filters */}
            {Object.entries(COLOR_LABELS).map(([colorKey, colorInfo]) => {
              const count = colorCounts[colorKey] || 0;
              if (count === 0) return null;
              const isActive = quickFilters.color === colorKey;
              return (
                <button
                  key={colorKey}
                  onClick={() => setQuickFilters(f => ({ ...f, color: isActive ? null : colorKey }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? `${colorInfo.bg} ${colorInfo.text} ring-2 ring-offset-1 ring-primary`
                      : `${colorInfo.bg} ${colorInfo.text} opacity-70 hover:opacity-100`
                  }`}
                >
                  {colorInfo.label}
                  <span className="ml-1.5 text-xs opacity-70">({count})</span>
                </button>
              );
            })}

            {/* Divider */}
            {Object.keys(colorCounts).length > 0 && (inStockCount > 0 || organicCount > 0 || withinBudgetCount > 0) && (
              <div className="w-px h-6 bg-border mx-1" />
            )}

            {/* In Stock filter */}
            {inStockCount > 0 && (
              <button
                onClick={() => setQuickFilters(f => ({ ...f, inStock: !f.inStock }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  quickFilters.inStock
                    ? 'bg-green-100 text-green-700 ring-2 ring-offset-1 ring-green-500'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                📦 I lager
                <span className="text-xs opacity-70">({inStockCount})</span>
              </button>
            )}

            {/* Organic filter */}
            {organicCount > 0 && (
              <button
                onClick={() => setQuickFilters(f => ({ ...f, organic: !f.organic }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  quickFilters.organic
                    ? 'bg-emerald-100 text-emerald-700 ring-2 ring-offset-1 ring-emerald-500'
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                🌱 Ekologiskt
                <span className="text-xs opacity-70">({organicCount})</span>
              </button>
            )}

            {/* Within Budget filter */}
            {budgetMax && withinBudgetCount > 0 && (
              <button
                onClick={() => setQuickFilters(f => ({ ...f, withinBudget: !f.withinBudget }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  quickFilters.withinBudget
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-offset-1 ring-blue-500'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                💰 Inom budget
                <span className="text-xs opacity-70">({withinBudgetCount})</span>
              </button>
            )}

            {/* Location filters — only when mix of domestic + eu */}
            {hasLocationMix && (
              <>
                {(inStockCount > 0 || organicCount > 0 || withinBudgetCount > 0) && (
                  <div className="w-px h-6 bg-border mx-1" />
                )}
                <button
                  onClick={() => setQuickFilters(f => ({ ...f, location: f.location === 'domestic' ? null : 'domestic' }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    quickFilters.location === 'domestic'
                      ? 'bg-green-100 text-green-700 ring-2 ring-offset-1 ring-green-500'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  I lager
                  <span className="text-xs opacity-70">({domesticCount})</span>
                </button>
                <button
                  onClick={() => setQuickFilters(f => ({ ...f, location: f.location === 'eu' ? null : 'eu' }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    quickFilters.location === 'eu'
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-offset-1 ring-blue-500'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  Direktimport
                  <span className="text-xs opacity-70">({euCount})</span>
                </button>
              </>
            )}

            {/* Clear quick filters */}
            {(quickFilters.color || quickFilters.inStock || quickFilters.organic || quickFilters.withinBudget || quickFilters.location) && (
              <button
                onClick={() => setQuickFilters({ color: null, inStock: false, organic: false, withinBudget: false, location: null })}
                className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Rensa
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filter Section — collapsible on all screens */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium text-sm sm:text-base">Filter & sortering</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showFilters && (
            <div className="mt-4 p-4 bg-card border border-border rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                {/* Min Price */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Min pris (kr)
                  </label>
                  <input
                    type="number"
                    value={filters.priceMin}
                    onChange={(e) => setFilters(f => ({ ...f, priceMin: e.target.value }))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  />
                </div>

                {/* Max Price */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Max pris (kr)
                  </label>
                  <input
                    type="number"
                    value={filters.priceMax}
                    onChange={(e) => setFilters(f => ({ ...f, priceMax: e.target.value }))}
                    placeholder="1000"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Land
                  </label>
                  <select
                    value={filters.country}
                    onChange={(e) => setFilters(f => ({ ...f, country: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">Alla länder</option>
                    {filterOptions.countries.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                {/* Producer */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Producent
                  </label>
                  <select
                    value={filters.producer}
                    onChange={(e) => setFilters(f => ({ ...f, producer: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">Alla producenter</option>
                    {filterOptions.producers.map(producer => (
                      <option key={producer} value={producer}>{producer}</option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Sortera efter
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as SortOption }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="score">Bäst matchning</option>
                    <option value="price_asc">Lägst pris först</option>
                    <option value="price_desc">Högst pris först</option>
                    <option value="country">Land A-Ö</option>
                    <option value="producer">Producent A-Ö</option>
                  </select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Visar {filteredSuggestions.length} av {suggestions.length} viner
                  </p>
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <X className="h-4 w-4" />
                    Rensa filter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wine Cards */}
        <div className="space-y-6 mb-12">
          {filteredSuggestions.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <p className="text-xl text-muted-foreground mb-2">Inga viner matchar filtren</p>
              <button
                onClick={clearFilters}
                className="text-primary hover:underline"
              >
                Rensa filter
              </button>
            </div>
          ) : (
            filteredSuggestions.map((suggestion, index) => {
              const isSelected = selectedWines.has(suggestion.wine.id);

              return (
              <div
                key={suggestion.wine.id}
                className={`bg-card border-2 rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden group ${
                  isSelected ? 'border-green-500 bg-green-50/30' : 'border-border'
                }`}
              >
                {/* Card Header - Clickable to toggle selection */}
                <div
                  className={`px-4 md:px-6 py-3 md:py-4 border-b cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-green-100/50 border-green-200'
                      : 'bg-gradient-to-r from-primary/5 to-accent/5 border-border hover:bg-primary/10'
                  }`}
                  onClick={() => toggleWineSelection(suggestion.wine.id, suggestion)}
                >
                  {/* Mobile layout */}
                  <div className="md:hidden">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isSelected ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'
                      }`}>
                        {isSelected ? <Check className="h-3 w-3" /> : index + 1}
                      </span>
                      <h2 className="text-base font-bold text-foreground leading-tight flex-1">
                        {suggestion.wine.namn}
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 pl-8">
                      {suggestion.wine.producent} · {suggestion.wine.land}
                      {suggestion.wine.argang ? ` · ${suggestion.wine.argang}` : ''}
                    </p>
                    <div className="flex items-center justify-between pl-8">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-foreground">{formatPrice(suggestion.wine.pris_sek)}</span>
                        {suggestion.wine.color && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                            COLOR_LABELS[suggestion.wine.color]?.bg || 'bg-muted'
                          } ${COLOR_LABELS[suggestion.wine.color]?.text || 'text-muted-foreground'}`}>
                            {COLOR_LABELS[suggestion.wine.color]?.label || suggestion.wine.color}
                          </span>
                        )}
                        {suggestion.wine.ekologisk && (
                          <span className="text-[10px] text-green-600 font-medium">🌱</span>
                        )}
                        {suggestion.wine.location === 'eu' ? (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">Direktimport</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full">I lager</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWineSelection(suggestion.wine.id, suggestion); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-green-600 text-white'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {isSelected ? '✓ Vald' : 'Välj'}
                      </button>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          isSelected ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'
                        }`}>
                          {isSelected ? <Check className="h-4 w-4" /> : index + 1}
                        </span>
                        <h2 className="text-2xl font-bold text-foreground">
                          {suggestion.wine.namn}
                        </h2>
                        {suggestion.wine.color && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            COLOR_LABELS[suggestion.wine.color]?.bg || 'bg-muted'
                          } ${COLOR_LABELS[suggestion.wine.color]?.text || 'text-muted-foreground'}`}>
                            {COLOR_LABELS[suggestion.wine.color]?.label || suggestion.wine.color}
                          </span>
                        )}
                        {suggestion.wine.ekologisk && (
                          <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full">
                            🌱 Eko
                          </span>
                        )}
                        {suggestion.wine.location === 'eu' ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Direktimport</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">I lager</span>
                        )}
                        {isSelected ? (
                          <span className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            I förfrågan
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            Klicka för att välja
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{suggestion.wine.producent}</span>
                        <span>•</span>
                        <span>{suggestion.wine.land}</span>
                        {suggestion.wine.region && (
                          <>
                            <span>•</span>
                            <span>{suggestion.wine.region}</span>
                          </>
                        )}
                        {suggestion.wine.druva && (
                          <>
                            <span>•</span>
                            <span>{suggestion.wine.druva}</span>
                          </>
                        )}
                        {suggestion.wine.argang && (
                          <>
                            <span>•</span>
                            <span>{suggestion.wine.argang}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <p className="text-3xl font-bold text-foreground">
                        {formatPrice(suggestion.wine.pris_sek)}
                      </p>
                      <p className="text-sm text-muted-foreground">per flaska</p>
                      {(() => {
                        const moq = suggestion.wine.moq || 0;
                        const qty = getWineQuantity(suggestion.wine.id, moq);
                        const minValueSek = suggestion.supplier.min_order_value_sek;
                        const currentValueSek = qty * (suggestion.wine.pris_sek || 0);
                        const meetsValue = minValueSek != null && currentValueSek >= minValueSek;
                        const isBelowMoq = (moq > 0 && qty < moq) && !meetsValue;

                        return (
                          <div className="mt-1 text-right space-y-0.5">
                            {/* Always show MOQ badge when MOQ exists */}
                            {(moq > 0 || minValueSek != null) && (
                              <p className={`text-xs font-medium ${isBelowMoq ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                {moq > 0 ? `Min. ${moq} fl` : ''}{moq > 0 && minValueSek != null ? ' / ' : ''}{minValueSek != null ? `${minValueSek.toLocaleString('sv-SE')} kr` : ''}
                              </p>
                            )}
                            {/* Show current selection total */}
                            <p className="text-xs text-muted-foreground">
                              {qty} fl = <span className={`font-medium ${isBelowMoq ? 'text-orange-600' : 'text-foreground'}`}>{formatPrice(suggestion.wine.pris_sek * qty)}</span>
                            </p>
                          </div>
                        );
                      })()}
                      {isSelected ? (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          ✓ I förfrågan
                        </p>
                      ) : (
                        <p className="text-xs text-primary font-medium mt-1 opacity-70 group-hover:opacity-100">
                          + Lägg till i förfrågan
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Body - Hidden when selected (compact view) */}
                {!isSelected && (
                <div className="p-6">
                  {/* Order Info - Requested Qty, MOQ, Stock, Lead Time */}
                  {(() => {
                    const moq = suggestion.wine.moq || 0;
                    const originalQty = requestedQuantity || 0;
                    const currentQty = getWineQuantity(suggestion.wine.id, moq);
                    const wasAutoAdjusted = moq > 0 && originalQty > 0 && originalQty < moq;
                    const stock = suggestion.wine.lager;
                    const isLowStock = stock !== undefined && stock !== null && currentQty > 0 && stock > 0 && stock < currentQty;

                    // Determine MOQ status (OR logic: meets bottle MOQ OR value threshold)
                    const meetsMin = checkMeetsMinimum(currentQty, moq, suggestion.wine.pris_sek, suggestion.supplier);
                    const isBelowMoq = !meetsMin;
                    const originalMeetsMin = originalQty <= 0 || checkMeetsMinimum(originalQty, moq, suggestion.wine.pris_sek, suggestion.supplier);
                    const hasUserAdjusted = userAdjustedToMoq.has(suggestion.wine.id);
                    const isInDraftList = draftList.items.some(item => item.wine_id === suggestion.wine.id);
                    const minValueSek = suggestion.supplier.min_order_value_sek;

                    return (
                      <div className="mb-6 p-4 rounded-xl border bg-muted/30 border-border">
                        {/* Compact MOQ status — single inline row */}
                        {isBelowMoq && !hasUserAdjusted && (
                          <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <p className="text-xs text-red-700 flex-1">
                              Under minimum ({moq > 0 ? `${moq} fl` : ''}{moq > 0 && minValueSek != null ? ' / ' : ''}{minValueSek != null ? `${minValueSek.toLocaleString('sv-SE')} kr` : ''})
                            </p>
                            {moq > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdjustToMoq(suggestion.wine.id, moq);
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors flex-shrink-0"
                              >
                                Justera till {moq} fl
                              </button>
                            )}
                          </div>
                        )}
                        {hasUserAdjusted && !isInDraftList && (
                          <div className="mb-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0" />
                            <p className="text-xs text-amber-700">
                              Justerat: {originalQty} → {currentQty} fl
                            </p>
                          </div>
                        )}
                        {isInDraftList && (
                          <div className="mb-3 flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <p className="text-xs text-green-700">{currentQty} fl i din lista</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                          {/* Order Quantity */}
                          <div className="text-center p-3 rounded-lg bg-background border border-border">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Att beställa</p>
                            <p className="text-lg font-bold text-foreground">
                              {currentQty > 0 ? `${currentQty} fl` : '–'}
                            </p>
                          </div>

                          {/* MOQ */}
                          <div className="text-center p-3 rounded-lg bg-background border border-border">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum</p>
                              <HelpTooltip content={GLOSSARY.moq} side="bottom" />
                            </div>
                            {moq > 0 || minValueSek != null ? (
                              <p className="text-lg font-bold text-foreground">
                                {moq > 0 ? `${moq} fl` : ''}{moq > 0 && minValueSek != null ? ' / ' : ''}{minValueSek != null ? `${minValueSek.toLocaleString('sv-SE')} kr` : ''}
                              </p>
                            ) : (
                              <p className="text-lg font-bold text-green-600">Ingen</p>
                            )}
                          </div>

                          {/* Stock */}
                          <div className={`text-center p-3 rounded-lg border ${isLowStock ? 'bg-amber-50 border-amber-200' : 'bg-background border-border'}`}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">I lager</p>
                            {stock !== undefined && stock !== null ? (
                              stock > 0 ? (
                                <p className={`text-lg font-bold ${isLowStock ? 'text-amber-600' : 'text-green-600'}`}>
                                  {stock} fl
                                </p>
                              ) : (
                                <p className="text-sm font-medium text-orange-500">Beställningsvara</p>
                              )
                            ) : (
                              <p className="text-sm font-medium text-muted-foreground">Ej angivet</p>
                            )}
                          </div>

                          {/* Lead Time — visible on all screens */}
                          <div className="text-center p-3 bg-background border border-border rounded-lg">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leveranstid</p>
                              <HelpTooltip content={GLOSSARY.leadtime} side="bottom" />
                            </div>
                            {suggestion.wine.ledtid_dagar ? (
                              <p className="text-lg font-bold text-foreground">{suggestion.wine.ledtid_dagar} d</p>
                            ) : suggestion.supplier.normalleveranstid_dagar ? (
                              <p className="text-lg font-bold text-foreground">{suggestion.supplier.normalleveranstid_dagar} d</p>
                            ) : (
                              <p className="text-sm font-medium text-muted-foreground">–</p>
                            )}
                          </div>
                        </div>

                        {/* Carton info */}
                        {suggestion.wine.kartong && suggestion.wine.kartong > 0 && (
                          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-700 font-medium">
                              📦 {suggestion.wine.kartong} fl/kartong = {formatPrice(suggestion.wine.pris_sek * suggestion.wine.kartong)}/kartong
                            </p>
                          </div>
                        )}

                        {/* Provorder option - shown when auto-adjusted and supplier supports it */}
                        {wasAutoAdjusted && suggestion.supplier.provorder_enabled && !provorderWines.has(suggestion.wine.id) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWineQuantities(prev => ({ ...prev, [suggestion.wine.id]: originalQty }));
                              setProvorderWines(prev => {
                                const newSet = new Set(prev);
                                newSet.add(suggestion.wine.id);
                                return newSet;
                              });
                            }}
                            className="mt-2 w-full p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-100 transition-colors text-center"
                          >
                            Provorder: {originalQty} fl (+{suggestion.supplier.provorder_fee_sek || 500} kr avgift)
                          </button>
                        )}

                        {/* Provorder confirmation */}
                        {provorderWines.has(suggestion.wine.id) && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                              <Check className="h-4 w-4" />
                              Provorder ({originalQty} fl) +{suggestion.supplier.provorder_fee_sek || 500} kr
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Reset to MOQ and remove provorder
                                setWineQuantities(prev => ({ ...prev, [suggestion.wine.id]: moq }));
                                setProvorderWines(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(suggestion.wine.id);
                                  return newSet;
                                });
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Ångra
                            </button>
                          </div>
                        )}

                        {/* Matching score with explanation */}
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Matchning</span>
                              {suggestion.score_breakdown && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBreakdown(suggestion.wine.id);
                                  }}
                                  className="p-1 -m-1 rounded hover:bg-muted/50 transition-colors"
                                  title="Visa matchningsdetaljer"
                                >
                                  {expandedBreakdowns.has(suggestion.wine.id) ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    suggestion.ranking_score >= 0.8 ? 'bg-green-500' :
                                    suggestion.ranking_score >= 0.6 ? 'bg-amber-400' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${suggestion.ranking_score * 100}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${
                                suggestion.ranking_score >= 0.8 ? 'text-green-600' :
                                suggestion.ranking_score >= 0.6 ? 'text-amber-600' :
                                'text-red-600'
                              }`}>
                                {Math.round(suggestion.ranking_score * 100)}%
                              </span>
                            </div>
                          </div>
                          {/* Matching criteria tags */}
                          {(() => {
                            const tags: string[] = [];
                            const wine = suggestion.wine;

                            // Color (try multiple formats)
                            if (wine.color && COLOR_LABELS[wine.color]) {
                              tags.push(COLOR_LABELS[wine.color].label);
                            } else if (wine.color && COLOR_LABELS[wine.color.toLowerCase()]) {
                              tags.push(COLOR_LABELS[wine.color.toLowerCase()].label);
                            }

                            // Region/Country
                            if (wine.region) {
                              tags.push(wine.region);
                            } else if (wine.land) {
                              tags.push(wine.land);
                            }

                            // Grape variety (if no region)
                            if (tags.length < 2 && wine.druva) {
                              tags.push(wine.druva.split(',')[0].trim()); // First grape only
                            }

                            // Price vs budget
                            if (budgetMax) {
                              if (wine.pris_sek <= budgetMax) {
                                tags.push('inom budget');
                              }
                            }

                            // Certifications
                            if (wine.ekologisk) tags.push('eko');
                            if (wine.biodynamiskt) tags.push('biodynamisk');
                            if (wine.location === 'eu') tags.push('direktimport');

                            // Fallback: use producer if still no tags
                            if (tags.length === 0 && wine.producent) {
                              tags.push(wine.producent);
                            }

                            const isGoodMatch = suggestion.ranking_score >= 0.8;

                            return (
                              <div className="flex flex-wrap items-center gap-1">
                                {isGoodMatch && (
                                  <span className="text-green-600 text-xs">✓</span>
                                )}
                                {tags.length > 0 ? (
                                  <span className={`text-xs ${isGoodMatch ? 'text-green-600' : 'text-muted-foreground'}`}>
                                    {tags.join(' · ')}
                                  </span>
                                ) : suggestion.motivering && !suggestion.motivering.includes('Baserat på dina kriterier') ? (
                                  <span className={`text-xs ${
                                    isGoodMatch ? 'text-green-600' :
                                    suggestion.ranking_score >= 0.6 ? 'text-muted-foreground' :
                                    'text-amber-600'
                                  }`}>
                                    {suggestion.motivering}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })()}
                          {/* Price advantage badge */}
                          {budgetMax && suggestion.wine.pris_sek < budgetMax * 0.7 && (
                            <p className="text-xs text-green-600 font-medium">
                              {Math.round((1 - suggestion.wine.pris_sek / budgetMax) * 100)}% under budget
                            </p>
                          )}

                          {/* Score breakdown (collapsible) */}
                          {renderScoreBreakdown(suggestion)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expandable Wine Details - Only show if there's extra content */}
                  {(() => {
                    const hasExtraContent = suggestion.wine.beskrivning ||
                      suggestion.wine.appellation ||
                      suggestion.wine.alkohol ||
                      suggestion.wine.volym_ml ||
                      suggestion.wine.sku ||
                      suggestion.wine.biodynamiskt ||
                      suggestion.wine.veganskt;

                    if (!hasExtraContent) return null;

                    return (
                  <div className="mb-6">
                    <button
                      onClick={() => toggleWineExpanded(suggestion.wine.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        expandedWines.has(suggestion.wine.id)
                          ? 'bg-primary/5 border-primary/20 text-primary'
                          : 'bg-muted/40 border-border hover:bg-muted/60 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Mer om detta vin
                      </span>
                      {expandedWines.has(suggestion.wine.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {expandedWines.has(suggestion.wine.id) && (
                      <div className="mt-3 p-4 bg-muted/20 border border-border rounded-xl space-y-4">
                        {/* Description */}
                        {suggestion.wine.beskrivning && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Smakprofil</p>
                            <p className="text-sm text-foreground">{suggestion.wine.beskrivning}</p>
                          </div>
                        )}

                        {/* Wine Details - Only unique info not shown elsewhere */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {suggestion.wine.appellation && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Appellation</p>
                              <p className="text-sm text-foreground">{suggestion.wine.appellation}</p>
                            </div>
                          )}
                          {suggestion.wine.alkohol && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Alkohol</p>
                              <p className="text-sm text-foreground font-medium">{suggestion.wine.alkohol}%</p>
                            </div>
                          )}
                          {suggestion.wine.volym_ml && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Flaskstorlek</p>
                              <p className="text-sm text-foreground font-medium">{suggestion.wine.volym_ml} ml</p>
                            </div>
                          )}
                          {suggestion.wine.sku && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Art.nr</p>
                              <p className="text-sm text-foreground font-mono">{suggestion.wine.sku}</p>
                            </div>
                          )}
                        </div>

                        {/* Certifications */}
                        {(suggestion.wine.biodynamiskt || suggestion.wine.veganskt) && (
                          <div className="flex gap-2 pt-3 border-t border-border">
                            {suggestion.wine.biodynamiskt && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                🌙 Biodynamiskt
                              </span>
                            )}
                            {suggestion.wine.veganskt && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                🌱 Veganskt
                              </span>
                            )}
                          </div>
                        )}

                        {/* Food Suggestions */}
                        {(() => {
                          const wineFs = foodSuggestionsMap[suggestion.wine.id];
                          const isLoadingFs = foodSuggestionsLoading.has(suggestion.wine.id);
                          if (isLoadingFs) {
                            return (
                              <div className="pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground">Laddar matforslag...</p>
                              </div>
                            );
                          }
                          if (wineFs && wineFs.length > 0) {
                            return (
                              <div className="pt-3 border-t border-border">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Passar till</p>
                                <p className="text-sm text-foreground">
                                  {wineFs.map((fs, i) => (
                                    <span key={fs.food}>
                                      {fs.isGoldenPair ? (
                                        <span className="font-semibold text-amber-700" title={fs.reason}>{fs.food}</span>
                                      ) : (
                                        <span>{fs.food}</span>
                                      )}
                                      {i < wineFs.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Similar Wines */}
                        {(() => {
                          const similarWines = similarWinesMap[suggestion.wine.id];
                          const isLoadingSw = similarWinesLoading.has(suggestion.wine.id);
                          if (isLoadingSw) {
                            return (
                              <div className="pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground">Laddar liknande viner...</p>
                              </div>
                            );
                          }
                          if (similarWines && similarWines.length > 0) {
                            return (
                              <div className="pt-3 border-t border-border">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Liknande viner</p>
                                <div className="space-y-2">
                                  {similarWines.slice(0, 5).map((sw) => (
                                    <div key={sw.wine.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{sw.wine.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {sw.wine.producer} {sw.wine.vintage ? `${sw.wine.vintage}` : ''} — {sw.wine.supplier_name}
                                        </p>
                                        {sw.reasons.length > 0 && (
                                          <p className="text-xs text-muted-foreground/70 mt-0.5">{sw.reasons.join(' · ')}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                        <div className="text-right">
                                          <p className="text-sm font-semibold text-foreground">{formatPrice(sw.wine.price_ex_vat_sek)}</p>
                                          <p className="text-xs text-muted-foreground">{sw.similarity}% match</p>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const alreadySaved = draftList.items.some(item => item.wine_id === sw.wine.id);
                                            if (!alreadySaved) {
                                              draftList.addItem({
                                                wine_id: sw.wine.id,
                                                wine_name: sw.wine.name,
                                                producer: sw.wine.producer,
                                                country: sw.wine.country,
                                                region: sw.wine.region,
                                                vintage: sw.wine.vintage,
                                                color: sw.wine.color,
                                                supplier_id: sw.wine.supplier_id,
                                                supplier_name: sw.wine.supplier_name,
                                                quantity: sw.wine.moq || 6,
                                                moq: sw.wine.moq || 6,
                                                price_sek: sw.wine.price_ex_vat_sek,
                                                stock: sw.wine.stock_qty,
                                              });
                                              toast.success('Tillagt', `${sw.wine.name} tillagd i listan`);
                                            }
                                          }}
                                          disabled={draftList.items.some(item => item.wine_id === sw.wine.id)}
                                          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                                            draftList.items.some(item => item.wine_id === sw.wine.id)
                                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                              : 'bg-wine/10 text-wine hover:bg-wine/20'
                                          }`}
                                        >
                                          {draftList.items.some(item => item.wine_id === sw.wine.id) ? (
                                            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Tillagd</span>
                                          ) : (
                                            <span className="flex items-center gap-1"><ListPlus className="h-3 w-3" /> Lagg till</span>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                    );
                  })()}

                  {/* Market Data — compact on mobile, full on desktop */}
                  {suggestion.market_data && (
                    <>
                      {/* Mobile: compact badge */}
                      <div className="md:hidden mb-4 flex items-center gap-2 p-2.5 bg-secondary/10 border border-secondary/20 rounded-lg">
                        <span className="text-sm">💰</span>
                        <p className={`text-xs font-medium ${
                          parseFloat(suggestion.market_data.price_difference_percent) <= 0
                            ? 'text-green-600' : 'text-foreground'
                        }`}>
                          {parseFloat(suggestion.market_data.price_difference_percent) <= 0
                            ? `${Math.abs(parseFloat(suggestion.market_data.price_difference_percent))}% under marknad`
                            : `+${suggestion.market_data.price_difference_percent}% vs marknad`
                          }
                        </p>
                        <span className="text-xs text-muted-foreground">
                          ({suggestion.market_data.merchant_count} återförsäljare)
                        </span>
                      </div>
                      {/* Desktop: full panel */}
                      <div className="hidden md:block mb-6 p-4 bg-secondary/10 border border-secondary/20 rounded-xl">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">💰</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground mb-2">Marknadsprisinfo</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Lägsta marknadspris</p>
                                <p className="text-lg font-bold text-foreground">
                                  {formatPrice(suggestion.market_data.lowest_price)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  från {suggestion.market_data.merchant_name}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Prisjämförelse</p>
                                <p className={`text-lg font-bold ${
                                  parseFloat(suggestion.market_data.price_difference_percent) > 0
                                    ? 'text-destructive'
                                    : 'text-green-600'
                                }`}>
                                  {parseFloat(suggestion.market_data.price_difference_percent) > 0 ? '+' : ''}
                                  {suggestion.market_data.price_difference_percent}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {suggestion.market_data.merchant_count} återförsäljare
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Supplier Info */}
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-xl">📦</span>
                      <div>
                        <p className="font-medium text-foreground">
                          {suggestion.supplier.namn}
                        </p>
                        {suggestion.supplier.normalleveranstid_dagar && (
                          <p className="text-xs text-muted-foreground">
                            Leverans: {suggestion.supplier.normalleveranstid_dagar} dagar
                          </p>
                        )}
                        {suggestion.supplier.payment_terms && (
                          <p className="text-xs text-muted-foreground">
                            Betalvillkor: {suggestion.supplier.payment_terms}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Spara till lista med antal-väljare */}
                    {(() => {
                      const moq = suggestion.wine.moq || 0;
                      const qty = getWineQuantity(suggestion.wine.id, moq);
                      const isSaved = draftList.hasItem(suggestion.wine.id);
                      const meetsMin = checkMeetsMinimum(qty, moq, suggestion.wine.pris_sek, suggestion.supplier);
                      const isBelowMoq = !meetsMin;
                      const hasProvorder = provorderWines.has(suggestion.wine.id);
                      const canAddToList = meetsMin || hasProvorder;
                      const provorderFee = suggestion.supplier.provorder_fee_sek || 500;
                      const minValueSek = suggestion.supplier.min_order_value_sek;

                      return (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            {!isSaved && (
                              <div className="flex flex-col items-center">
                                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateWineQuantity(suggestion.wine.id, -1, moq);
                                    }}
                                    className="p-1.5 rounded hover:bg-background transition-colors"
                                    aria-label="Minska antal"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className={`w-10 text-center text-sm font-medium transition-colors ${
                                    justAdjustedToMoq === suggestion.wine.id
                                      ? 'text-green-600 bg-green-100 rounded px-1'
                                      : isBelowMoq && !hasProvorder ? 'text-orange-600' : ''
                                  }`}>
                                    {qty}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateWineQuantity(suggestion.wine.id, 1, moq);
                                    }}
                                    className="p-1.5 rounded hover:bg-background transition-colors"
                                    aria-label="Öka antal"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {(moq > 0 || minValueSek != null) && !hasProvorder && (
                                  <span className={`text-xs mt-0.5 ${isBelowMoq ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                                    Min. {moq > 0 ? `${moq} fl` : ''}{moq > 0 && minValueSek != null ? ' / ' : ''}{minValueSek != null ? `${minValueSek.toLocaleString('sv-SE')} kr` : ''}
                                  </span>
                                )}
                                {hasProvorder && (
                                  <span className="text-xs mt-0.5 text-green-600 font-medium flex items-center gap-1">
                                    Provorder
                                    <HelpTooltip content={GLOSSARY.provorder} side="bottom" />
                                  </span>
                                )}
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSaved) {
                                  draftList.removeItem(suggestion.wine.id);
                                  // Also remove from offer selection
                                  setSelectedWines(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(suggestion.wine.id);
                                    return newSet;
                                  });
                                } else if (canAddToList) {
                                  draftList.addItem({
                                    wine_id: suggestion.wine.id,
                                    wine_name: suggestion.wine.namn,
                                    producer: suggestion.wine.producent,
                                    country: suggestion.wine.land,
                                    region: suggestion.wine.region,
                                    vintage: suggestion.wine.argang,
                                    color: suggestion.wine.color,
                                    supplier_id: suggestion.supplier.id || suggestion.supplier.namn,
                                    supplier_name: suggestion.supplier.namn,
                                    quantity: qty,
                                    moq: moq,
                                    price_sek: suggestion.wine.pris_sek,
                                    stock: suggestion.wine.lager,
                                    lead_time_days: suggestion.wine.ledtid_dagar || suggestion.supplier.normalleveranstid_dagar,
                                    provorder: hasProvorder,
                                    provorder_fee: hasProvorder ? provorderFee : undefined,
                                  });
                                  // Also add to offer selection so user can proceed to review
                                  setSelectedWines(prev => new Set([...prev, suggestion.wine.id]));
                                }
                              }}
                              disabled={!isSaved && !canAddToList}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isSaved
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : !canAddToList
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : hasProvorder
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-amber-500 text-white hover:bg-amber-600'
                              }`}
                              title={isSaved ? 'Ta bort från din lista' : !canAddToList ? `Öka till minst ${moq > 0 ? `${moq} fl` : ''}${moq > 0 && minValueSek != null ? ' eller ' : ''}${minValueSek != null ? `${minValueSek.toLocaleString('sv-SE')} kr` : ''} eller välj provorder` : hasProvorder ? `Lägg till som provorder (+${provorderFee} kr)` : 'Lägg till i din lista'}
                            >
                              {isSaved ? (
                                <>
                                  <Check className="h-4 w-4" />
                                  I din lista ({qty} fl)
                                </>
                              ) : hasProvorder ? (
                                <>
                                  <ListPlus className="h-4 w-4" />
                                  Provorder +{provorderFee} kr
                                </>
                              ) : (
                                <>
                                  <ListPlus className="h-4 w-4" />
                                  Lägg i lista
                                </>
                              )}
                            </button>
                          </div>
                          {!isSaved && isBelowMoq && !hasProvorder && (
                            <div className="flex flex-col items-end gap-1">
                              {moq > 0 && qty < moq && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWineQuantities(prev => ({ ...prev, [suggestion.wine.id]: moq }));
                                    setJustAdjustedToMoq(suggestion.wine.id);
                                    setTimeout(() => setJustAdjustedToMoq(null), 1500);
                                  }}
                                  className="text-xs text-orange-600 hover:text-orange-700 underline"
                                >
                                  Ändra till {moq} fl
                                </button>
                              )}
                              {suggestion.supplier.provorder_enabled && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProvorderWines(prev => {
                                      const newSet = new Set(prev);
                                      newSet.add(suggestion.wine.id);
                                      return newSet;
                                    });
                                  }}
                                  className="text-xs text-green-600 hover:text-green-700 underline"
                                >
                                  Eller provorder (+{provorderFee} kr)
                                </button>
                              )}
                            </div>
                          )}
                          {justAdjustedToMoq === suggestion.wine.id && (
                            <span className="text-xs text-green-600 font-medium animate-pulse">
                              ✓ Ändrat till {moq} fl
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                )}
              </div>
            );
            })
          )}
        </div>

        {/* CTA Section */}
        {sent ? (
          <div className="bg-green-600 text-white rounded-2xl shadow-xl p-8">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Förfrågan skickad!</h3>
              <p className="text-white/90 mb-4">
                Din förfrågan om {draftList.items.length} vin{draftList.items.length > 1 ? 'er' : ''} har skickats till leverantörer.
              </p>

              {/* What happens next - helpful for infrequent users */}
              <div className="bg-white/10 rounded-xl p-4 mb-6 text-left">
                <p className="text-white/90 font-medium mb-2">Vad händer nu?</p>
                <ul className="text-white/80 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-white/60">1.</span>
                    <span>Leverantörer granskar din förfrågan och skickar offerter</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/60">2.</span>
                    <span>Du får notis när nya offerter kommer in (oftast inom 24-48h)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/60">3.</span>
                    <span>Jämför offerter och acceptera den du vill ha - ingen förpliktelse förrän du accepterar</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/dashboard/my-requests')}
                  className="px-8 py-3 bg-white text-green-700 rounded-xl hover:bg-white/90 transition-colors font-medium shadow-lg"
                >
                  Mina förfrågningar
                </button>
                <button
                  onClick={() => router.push('/dashboard/new-request')}
                  className="px-8 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors font-medium"
                >
                  Ny förfrågan
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-primary text-primary-foreground rounded-2xl shadow-xl p-8">
            <div className="max-w-3xl mx-auto text-center">
              <h3 className="text-2xl font-bold mb-3">
                {draftList.items.length > 0 ? `${draftList.items.length} vin${draftList.items.length > 1 ? 'er' : ''} i din lista` : 'Lägg till viner i din lista'}
              </h3>
              <p className="text-primary-foreground/90 mb-2">
                {draftList.items.length > 0 ? (
                  <>Klicka på &quot;Granska och skicka&quot; för att begära offerter från leverantörer.</>
                ) : (
                  <>Klicka på &quot;Lägg i lista&quot; på ett vin för att lägga till det.</>
                )}
              </p>
              <p className="text-primary-foreground/70 text-sm mb-6">
                Leverantörerna svarar vanligtvis inom 24-48 timmar.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleRequestConfirmation}
                  disabled={draftList.items.length === 0}
                  className="px-8 py-3 bg-primary-foreground text-primary rounded-xl hover:bg-primary-foreground/90 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📧 Granska och skicka ({draftList.items.length} viner)
                </button>
                <button
                  onClick={() => router.push('/dashboard/new-request')}
                  className="px-8 py-3 bg-primary/20 text-primary-foreground rounded-xl hover:bg-primary/30 transition-colors font-medium"
                >
                  🔍 Ny förfrågan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => !sending && setShowConfirmModal(false)}
          />

          {/* Modal — bottom-sheet on mobile, centered on desktop */}
          <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 p-0 md:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] md:max-h-[90vh] overflow-hidden">
              {/* Drag handle — mobile only */}
              <div className="flex justify-center pt-2 md:hidden">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Bekräfta din förfrågan</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Granska ditt val innan du skickar till leverantörer
                    </p>
                  </div>
                  <button
                    onClick={() => !sending && setShowConfirmModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={sending}
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
                {/* Summary - use draftList for accurate MOQ-aware data */}
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900">
                        {draftList.items.length} vin{draftList.items.length > 1 ? 'er' : ''} = {totalBottles} flaskor totalt
                      </p>
                      <p className="text-sm text-blue-700">
                        Uppskattat ordervärde: {formatPrice(totalEstimatedValue)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wine List - use draftList.items for accurate quantities */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Viner som ingår:</p>
                  {draftList.items.map((item, index) => (
                    <div
                      key={item.wine_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.wine_name}
                            {item.vintage && (
                              <span className="text-gray-500 ml-1">{item.vintage}</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.producer} · {item.supplier_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">
                          {item.quantity} fl × {formatPrice(item.price_sek)}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {formatPrice(item.price_sek * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* No obligation notice */}
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">Ingen beställning – endast offertförfrågan</p>
                      <p className="text-green-700">
                        Du ber om offerter utan förpliktelse att köpa. När du fått offerter kan du i lugn och ro jämföra och välja – eller tacka nej.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">Vad händer nu?</p>
                      <ul className="space-y-1 text-amber-700">
                        <li>• Din förfrågan skickas till relevanta leverantörer</li>
                        <li>• Du får offerter inom 24-48 timmar</li>
                        <li>• Du kan jämföra och välja den bästa offerten</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={sending}
                  className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  Tillbaka
                </button>
                <button
                  onClick={handleConfirmAndSend}
                  disabled={sending}
                  className="px-8 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Skickar...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Bekräfta och skicka
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sticky action bar - shows when wines are in list */}
      {draftList.items.length > 0 && !sent && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg safe-area-inset-bottom">
          {/* RFQ Summary Bar — hidden on mobile */}
          <div className="hidden sm:block max-w-4xl mx-auto px-4 pt-3 pb-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              {searchDescription && (
                <span className="truncate max-w-[200px]" title={searchDescription}>
                  &quot;{searchDescription}&quot;
                </span>
              )}
              {wineType && wineType !== 'all' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {wineType === 'red' ? 'Rött' : wineType === 'white' ? 'Vitt' : wineType === 'sparkling' ? 'Bubbel' : wineType === 'rose' ? 'Rosé' : wineType}
                </span>
              )}
              {budgetMax && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-green-600">✓</span> {budgetMax} kr
                </span>
              )}
              {requestedQuantity && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-green-600">✓</span> {requestedQuantity} fl
                </span>
              )}
              {deliveryCity && (
                <span className="inline-flex items-center gap-1">
                  📍 {deliveryCity}
                </span>
              )}
              {deliveryTime && (
                <span className="inline-flex items-center gap-1">
                  🕐 {deliveryTime === 'this_week' ? 'Denna vecka' : deliveryTime === 'two_weeks' ? '2 veckor' : 'Flexibel'}
                </span>
              )}
            </div>
          </div>
          {/* Action Row */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {draftList.items.length} vin{draftList.items.length > 1 ? 'er' : ''} ({totalBottles} fl)
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {formatPrice(totalEstimatedValue)}
              </p>
            </div>
            <button
              onClick={handleRequestConfirmation}
              className="flex-shrink-0 px-5 sm:px-6 py-2.5 rounded-lg transition-colors font-medium shadow flex items-center gap-2 bg-primary text-white hover:bg-primary/90 text-sm sm:text-base"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Skicka förfrågan</span>
              <span className="sm:hidden">Skicka</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating draft list */}
      <FloatingDraftList />
    </div>
  );
}
