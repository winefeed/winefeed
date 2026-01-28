'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActor } from '@/lib/hooks/useActor';
import { useDraftList } from '@/lib/hooks/useDraftList';
import { formatPrice } from '@/lib/utils';
import { CheckCircle2, Filter, X, ChevronDown, ChevronUp, Bell, ArrowRight, Inbox, AlertCircle, ListPlus, ShoppingCart, Check, Info, Minus, Plus } from 'lucide-react';

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
}

interface Supplier {
  namn: string;
  kontakt_email: string;
  normalleveranstid_dagar?: number;
}

interface MarketData {
  lowest_price: number;
  merchant_name: string;
  merchant_count: number;
  price_difference: number;
  price_difference_percent: string;
}

interface Suggestion {
  wine: Wine;
  supplier: Supplier;
  motivering: string;
  ranking_score: number;
  market_data?: MarketData | null;
}

type SortOption = 'score' | 'price_asc' | 'price_desc' | 'country' | 'producer';

const COLOR_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  red: { label: 'Rött', bg: 'bg-red-100', text: 'text-red-700' },
  white: { label: 'Vitt', bg: 'bg-amber-50', text: 'text-amber-700' },
  rose: { label: 'Rosé', bg: 'bg-pink-100', text: 'text-pink-700' },
  sparkling: { label: 'Mousserande', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  orange: { label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700' },
  fortified: { label: 'Starkvin', bg: 'bg-amber-200', text: 'text-amber-800' },
};

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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

  // Draft list (Spara till lista)
  const draftList = useDraftList();

  // Get quantity for a wine (default to requestedQuantity or MOQ or 6)
  const getWineQuantity = (wineId: string, moq: number) => {
    if (wineQuantities[wineId] !== undefined) return wineQuantities[wineId];
    if (requestedQuantity && requestedQuantity > 0) return requestedQuantity;
    if (moq > 0) return moq;
    return 6;
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
      console.log('Could not fetch offer counts:', err);
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
      console.log('Could not fetch request details:', err);
    }
  }, [requestId]);

  useEffect(() => {
    const stored = sessionStorage.getItem('latest-suggestions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSuggestions(parsed);
        // Start with empty selection - user must actively choose wines to include
        // This is better UX for B2B: deliberate opt-in rather than opt-out
        setSelectedWines(new Set());
      } catch (e) {
        console.error('Failed to parse suggestions:', e);
      }
    }

    // Get search params from sessionStorage (more reliable than API call)
    const searchParams = sessionStorage.getItem('latest-search-params');
    if (searchParams) {
      try {
        const params = JSON.parse(searchParams);
        if (params.antal_flaskor) {
          setRequestedQuantity(params.antal_flaskor);
        }
        if (params.budget_max) {
          setBudgetMax(params.budget_max);
        }
      } catch (e) {
        console.error('Failed to parse search params:', e);
      }
    }

    setLoading(false);

    // Fetch offer counts (still needed for incoming offers banner)
    fetchOfferCounts();
    // Also try API as fallback for quantity
    fetchRequestDetails();
  }, [fetchOfferCounts, fetchRequestDetails]);

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const countries = [...new Set(suggestions.map(s => s.wine.land))].sort();
    const producers = [...new Set(suggestions.map(s => s.wine.producent))].sort();
    return { countries, producers };
  }, [suggestions]);

  // Apply filters and sorting
  const filteredSuggestions = useMemo(() => {
    let result = [...suggestions];

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
  }, [suggestions, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceMin) count++;
    if (filters.priceMax) count++;
    if (filters.country !== 'all') count++;
    if (filters.producer !== 'all') count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      priceMin: '',
      priceMax: '',
      country: 'all',
      producer: 'all',
      sortBy: 'score',
    });
  };

  const toggleWineSelection = (wineId: string) => {
    setSelectedWines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wineId)) {
        newSet.delete(wineId);
      } else {
        newSet.add(wineId);
      }
      return newSet;
    });
  };

  const toggleWineExpanded = (wineId: string) => {
    setExpandedWines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wineId)) {
        newSet.delete(wineId);
      } else {
        newSet.add(wineId);
      }
      return newSet;
    });
  };

  const handleRequestConfirmation = () => {
    if (selectedWines.size === 0) {
      alert('Välj minst ett vin att skicka till leverantörer');
      return;
    }
    setShowConfirmModal(true);
  };

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
          console.log('Request already dispatched');
        } else {
          throw new Error(errorData.error || 'Kunde inte skicka förfrågan');
        }
      }

      setShowConfirmModal(false);
      setSent(true);

      // Refresh offer counts after dispatching
      setTimeout(() => fetchOfferCounts(), 2000);
    } catch (error) {
      console.error('Failed to send request:', error);
      alert(error instanceof Error ? error.message : 'Kunde inte skicka förfrågan. Försök igen.');
    } finally {
      setSending(false);
    }
  };

  // Get selected wine details for confirmation modal
  const selectedWineDetails = useMemo(() => {
    return suggestions.filter(s => selectedWines.has(s.wine.id));
  }, [suggestions, selectedWines]);

  // Calculate total value: price × quantity for each wine
  const totalEstimatedValue = useMemo(() => {
    const qty = requestedQuantity || 1;
    return selectedWineDetails.reduce((sum, s) => sum + (s.wine.pris_sek * qty), 0);
  }, [selectedWineDetails, requestedQuantity]);

  // Total bottles
  const totalBottles = useMemo(() => {
    const qty = requestedQuantity || 1;
    return selectedWineDetails.length * qty;
  }, [selectedWineDetails, requestedQuantity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🍷</div>
          <p className="text-xl font-medium text-foreground">Genomsöker marknaden...</p>
          <p className="text-sm text-muted-foreground mt-2">Matchar viner efter dina behov</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
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
            <div className="flex items-center gap-3">
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
        {/* Results Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-secondary/20 text-secondary-foreground px-4 py-2 rounded-full mb-4">
            <span className="text-2xl">🔍</span>
            <span className="font-medium">Sökning klar</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Dina sökresultat</h1>
          <p className="text-xl text-muted-foreground">
            Vi hittade <span className="font-semibold text-foreground">{suggestions.length} matchande {suggestions.length === 1 ? 'vin' : 'viner'}</span> för din förfrågan
          </p>
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

        {/* Filter Section */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filtrera & sortera</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showFilters && (
            <div className="mt-4 p-4 bg-card border border-border rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  className={`px-6 py-4 border-b cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-green-100/50 border-green-200'
                      : 'bg-gradient-to-r from-primary/5 to-accent/5 border-border hover:bg-primary/10'
                  }`}
                  onClick={() => toggleWineSelection(suggestion.wine.id)}
                >
                  <div className="flex items-start justify-between">
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
                        {isSelected ? (
                          <span className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            I din offert
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
                        const qty = requestedQuantity || suggestion.wine.moq || 6;
                        return (
                          <p className="text-xs text-muted-foreground mt-1">
                            {qty} fl = <span className="font-medium text-foreground">{formatPrice(suggestion.wine.pris_sek * qty)}</span>
                          </p>
                        );
                      })()}
                      {isSelected ? (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          ✓ I offerten
                        </p>
                      ) : (
                        <p className="text-xs text-primary font-medium mt-1 opacity-70 group-hover:opacity-100">
                          + Lägg till i offert
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
                    const qty = requestedQuantity || 0;
                    const isBelowMoq = moq > 0 && qty > 0 && qty < moq;
                    const moqDiff = moq - qty;
                    const stock = suggestion.wine.lager;
                    const isLowStock = stock !== undefined && stock !== null && qty > 0 && stock > 0 && stock < qty;

                    return (
                      <div className={`mb-6 p-4 rounded-xl border ${isBelowMoq ? 'bg-orange-50 border-orange-200' : 'bg-muted/30 border-border'}`}>
                        <div className="grid grid-cols-4 gap-3">
                          {/* Requested Quantity */}
                          <div className="text-center p-3 bg-primary/10 rounded-lg">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Du sökte</p>
                            <p className="text-lg font-bold text-primary">
                              {qty > 0 ? `${qty} fl` : '–'}
                            </p>
                          </div>

                          {/* MOQ */}
                          <div className={`text-center p-3 rounded-lg ${isBelowMoq ? 'bg-orange-100' : 'bg-background'}`}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Min. order</p>
                            {moq > 0 ? (
                              <>
                                <p className={`text-lg font-bold ${isBelowMoq ? 'text-orange-600' : 'text-foreground'}`}>
                                  {moq} fl
                                </p>
                                {isBelowMoq ? (
                                  <p className="text-xs text-orange-600 font-medium mt-1">
                                    +{moqDiff} fl behövs
                                  </p>
                                ) : qty > 0 ? (
                                  <p className="text-xs text-green-600 font-medium mt-1">✓ OK</p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-lg font-bold text-green-600">Ingen</p>
                            )}
                          </div>

                          {/* Stock */}
                          <div className={`text-center p-3 rounded-lg ${isLowStock ? 'bg-amber-100' : 'bg-background'}`}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">I lager</p>
                            {stock !== undefined && stock !== null ? (
                              stock > 0 ? (
                                <>
                                  <p className={`text-lg font-bold ${isLowStock ? 'text-amber-600' : 'text-green-600'}`}>
                                    {stock} fl
                                  </p>
                                  {isLowStock && (
                                    <p className="text-xs text-amber-600 font-medium mt-1">
                                      Endast {stock} fl
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm font-medium text-orange-500">Beställningsvara</p>
                              )
                            ) : (
                              <p className="text-sm font-medium text-muted-foreground">Ej angivet</p>
                            )}
                          </div>

                          {/* Lead Time */}
                          <div className="text-center p-3 bg-background rounded-lg">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Leveranstid</p>
                            {suggestion.wine.ledtid_dagar ? (
                              <p className="text-lg font-bold text-foreground">{suggestion.wine.ledtid_dagar} dagar</p>
                            ) : suggestion.supplier.normalleveranstid_dagar ? (
                              <p className="text-lg font-bold text-foreground">{suggestion.supplier.normalleveranstid_dagar} dagar</p>
                            ) : (
                              <p className="text-sm font-medium text-muted-foreground">Ej angivet</p>
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

                        {/* MOQ Warning Banner */}
                        {isBelowMoq && (
                          <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                            <p className="text-sm text-orange-800 font-medium flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              Öka till minst {moq} flaskor för att kunna beställa från denna leverantör
                            </p>
                          </div>
                        )}

                        {/* Matching score with explanation */}
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground">Matchning</span>
                              <div className="group relative">
                                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64">
                                  <div className="bg-foreground text-background text-xs p-3 rounded-lg shadow-lg">
                                    <p className="font-medium mb-2">Så beräknas matchningen:</p>
                                    <ul className="space-y-1 text-background/90">
                                      <li>• Vintyp (rött/vitt etc)</li>
                                      <li>• Land/region matchar</li>
                                      <li>• Druva/stil passar</li>
                                      <li>• Certifieringar (eko etc)</li>
                                    </ul>
                                    <p className="mt-2 text-background/70 text-[10px]">
                                      OBS: Lägre pris än budget är positivt!
                                    </p>
                                  </div>
                                </div>
                              </div>
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
                          {/* Price advantage badge */}
                          {budgetMax && suggestion.wine.pris_sek < budgetMax * 0.7 && (
                            <p className="text-xs text-green-600 font-medium">
                              💰 Prisfördelaktigt! {Math.round((1 - suggestion.wine.pris_sek / budgetMax) * 100)}% under budget
                            </p>
                          )}
                          {/* Matching feedback - adjusted for price */}
                          {suggestion.ranking_score < 0.6 && !(budgetMax && suggestion.wine.pris_sek < budgetMax * 0.7) && (
                            <p className="text-xs text-amber-600">
                              💡 Partiell matchning – granska att vinet passar dina övriga behov
                            </p>
                          )}
                          {suggestion.ranking_score >= 0.6 && suggestion.ranking_score < 0.8 && (
                            <p className="text-xs text-muted-foreground">
                              ✓ God matchning
                            </p>
                          )}
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
                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-xl transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                        <span>🍇</span>
                        Mer om detta vin
                      </span>
                      {expandedWines.has(suggestion.wine.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                      </div>
                    )}
                  </div>
                    );
                  })()}

                  {/* Market Data */}
                  {suggestion.market_data && (
                    <div className="mb-6 p-4 bg-secondary/10 border border-secondary/20 rounded-xl">
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
                      </div>
                    </div>
                    {/* Spara till lista med antal-väljare */}
                    <div className="flex items-center gap-2">
                      {!draftList.hasItem(suggestion.wine.id) && (
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateWineQuantity(suggestion.wine.id, -1, suggestion.wine.moq || 0);
                            }}
                            className="p-1.5 rounded hover:bg-background transition-colors"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-10 text-center text-sm font-medium">
                            {getWineQuantity(suggestion.wine.id, suggestion.wine.moq || 0)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateWineQuantity(suggestion.wine.id, 1, suggestion.wine.moq || 0);
                            }}
                            className="p-1.5 rounded hover:bg-background transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (draftList.hasItem(suggestion.wine.id)) {
                            draftList.removeItem(suggestion.wine.id);
                          } else {
                            draftList.addItem({
                              wine_id: suggestion.wine.id,
                              wine_name: suggestion.wine.namn,
                              producer: suggestion.wine.producent,
                              country: suggestion.wine.land,
                              region: suggestion.wine.region,
                              vintage: suggestion.wine.argang,
                              color: suggestion.wine.color,
                              supplier_id: suggestion.supplier.namn,
                              supplier_name: suggestion.supplier.namn,
                              quantity: getWineQuantity(suggestion.wine.id, suggestion.wine.moq || 0),
                              moq: suggestion.wine.moq || 0,
                              price_sek: suggestion.wine.pris_sek,
                              stock: suggestion.wine.lager,
                              lead_time_days: suggestion.wine.ledtid_dagar || suggestion.supplier.normalleveranstid_dagar,
                            });
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          draftList.hasItem(suggestion.wine.id)
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                        title={draftList.hasItem(suggestion.wine.id) ? 'Ta bort från sparade viner' : 'Spara för senare (separat från offertförfrågan)'}
                      >
                        {draftList.hasItem(suggestion.wine.id) ? (
                          <>
                            <Check className="h-4 w-4" />
                            Sparad
                          </>
                        ) : (
                          <>
                            <ListPlus className="h-4 w-4" />
                            Spara
                          </>
                        )}
                      </button>
                    </div>
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
              <p className="text-white/90 mb-6">
                Din förfrågan om {selectedWines.size} vin{selectedWines.size > 1 ? 'er' : ''} har skickats.
                Vi skickar offerterna till dig så snart leverantörerna har svarat.
              </p>
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
                {selectedWines.size > 0 ? `${selectedWines.size} vin${selectedWines.size > 1 ? 'er' : ''} valt` : 'Välj viner för offertförfrågan'}
              </h3>
              <p className="text-primary-foreground/90 mb-2">
                {selectedWines.size > 0 ? (
                  <>Klicka på &quot;Granska och skicka&quot; för att begära offerter från leverantörer.</>
                ) : (
                  <>Klicka på ett vinkort för att lägga till det i din offertförfrågan.</>
                )}
              </p>
              <p className="text-primary-foreground/70 text-sm mb-6">
                Leverantörerna svarar vanligtvis inom 24-48 timmar.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleRequestConfirmation}
                  disabled={selectedWines.size === 0}
                  className="px-8 py-3 bg-primary-foreground text-primary rounded-xl hover:bg-primary-foreground/90 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📧 Granska och skicka ({selectedWines.size} viner)
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

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
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
                {/* Summary */}
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900">
                        {selectedWineDetails.length} vin{selectedWineDetails.length > 1 ? 'er' : ''} × {requestedQuantity || 1} flaskor = {totalBottles} flaskor totalt
                      </p>
                      <p className="text-sm text-blue-700">
                        Uppskattat ordervärde: {formatPrice(totalEstimatedValue)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wine List */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Viner som ingår:</p>
                  {selectedWineDetails.map((suggestion, index) => (
                    <div
                      key={suggestion.wine.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {suggestion.wine.namn}
                            {suggestion.wine.argang && (
                              <span className="text-gray-500 ml-1">{suggestion.wine.argang}</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {suggestion.wine.producent} · {suggestion.supplier.namn}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">
                          {requestedQuantity || 1} fl × {formatPrice(suggestion.wine.pris_sek)}
                        </p>
                        <p className="font-semibold text-gray-900">
                          {formatPrice(suggestion.wine.pris_sek * (requestedQuantity || 1))}
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
    </div>
  );
}
