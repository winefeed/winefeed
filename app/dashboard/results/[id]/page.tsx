'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { CheckCircle2, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

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

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    priceMin: '',
    priceMax: '',
    country: 'all',
    producer: 'all',
    sortBy: 'score' as SortOption,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('latest-suggestions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSuggestions(parsed);
        setSelectedWines(new Set(parsed.map((s: Suggestion) => s.wine.id)));
      } catch (e) {
        console.error('Failed to parse suggestions:', e);
      }
    }
    setLoading(false);
  }, [requestId]);

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

  const handleSendRequest = async () => {
    if (selectedWines.size === 0) {
      alert('Välj minst ett vin att skicka till leverantörer');
      return;
    }

    setSending(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSent(true);
    } catch (error) {
      console.error('Failed to send request:', error);
      alert('Kunde inte skicka förfrågan. Försök igen.');
    } finally {
      setSending(false);
    }
  };

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
            <button
              onClick={() => router.push('/dashboard/new-request')}
              className="px-4 py-2 bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors text-sm font-medium"
            >
              Ny offertförfrågan
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Results Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-secondary/20 text-secondary-foreground px-4 py-2 rounded-full mb-4">
            <span className="text-2xl">✓</span>
            <span className="font-medium">Din offert är klar</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Din vinoffert</h1>
          <p className="text-xl text-muted-foreground">
            Vi hittade <span className="font-semibold text-foreground">{suggestions.length} viner</span> för din restaurang
          </p>
        </div>

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
            filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.wine.id}
                className="bg-card border-2 border-border rounded-2xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {index + 1}
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
                    <div className="text-right">
                      <p className="text-3xl font-bold text-foreground">
                        {formatPrice(suggestion.wine.pris_sek)}
                      </p>
                      <p className="text-sm text-muted-foreground">per flaska</p>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  {/* Expert Recommendation */}
                  <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✨</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground mb-1">Varför detta vin passar dig</p>
                        <p className="text-sm text-foreground/80">{suggestion.motivering}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${suggestion.ranking_score * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {Math.round(suggestion.ranking_score * 100)}% matchning
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Wine Details */}
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
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Beskrivning</p>
                            <p className="text-sm text-foreground">{suggestion.wine.beskrivning}</p>
                          </div>
                        )}

                        {/* Wine Identity */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {suggestion.wine.druva && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Druva</p>
                              <p className="text-sm text-foreground">{suggestion.wine.druva}</p>
                            </div>
                          )}
                          {suggestion.wine.appellation && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Appellation</p>
                              <p className="text-sm text-foreground">{suggestion.wine.appellation}</p>
                            </div>
                          )}
                          {suggestion.wine.region && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Region</p>
                              <p className="text-sm text-foreground">{suggestion.wine.region}</p>
                            </div>
                          )}
                        </div>

                        {/* Technical Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border">
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
                          {suggestion.wine.argang && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Årgång</p>
                              <p className="text-sm text-foreground font-medium">{suggestion.wine.argang}</p>
                            </div>
                          )}
                        </div>

                        {/* Purchase Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border">
                          {suggestion.wine.moq !== undefined && suggestion.wine.moq !== null && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Min. order</p>
                              <p className="text-sm text-foreground font-medium">{suggestion.wine.moq} fl</p>
                            </div>
                          )}
                          {suggestion.wine.kartong && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Per kartong</p>
                              <p className="text-sm text-foreground font-medium">{suggestion.wine.kartong} fl</p>
                            </div>
                          )}
                          {suggestion.wine.lager !== undefined && suggestion.wine.lager !== null && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">I lager</p>
                              <p className={`text-sm font-medium ${suggestion.wine.lager > 0 ? 'text-green-600' : 'text-orange-500'}`}>
                                {suggestion.wine.lager > 0 ? `${suggestion.wine.lager} fl` : 'Beställningsvara'}
                              </p>
                            </div>
                          )}
                          {suggestion.wine.ledtid_dagar && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ledtid</p>
                              <p className="text-sm text-foreground font-medium">{suggestion.wine.ledtid_dagar} dagar</p>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>

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
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedWines.has(suggestion.wine.id)}
                        onChange={() => toggleWineSelection(suggestion.wine.id)}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className="text-sm font-medium">Inkludera i offert</span>
                    </label>
                  </div>
                </div>
              </div>
            ))
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
                Din förfrågan om {selectedWines.size} vin{selectedWines.size > 1 ? 'er' : ''} har skickats till leverantörerna.
                Du får svar inom 24 timmar.
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
              <h3 className="text-2xl font-bold mb-3">Bekräfta din offert</h3>
              <p className="text-primary-foreground/90 mb-2">
                {selectedWines.size > 0 ? (
                  <>Du har valt <span className="font-bold">{selectedWines.size} vin{selectedWines.size > 1 ? 'er' : ''}</span> att skicka till leverantörer.</>
                ) : (
                  <>Välj de viner du vill ha ovan.</>
                )}
              </p>
              <p className="text-primary-foreground/70 text-sm mb-6">
                Leverantörerna kontaktar dig inom 24 timmar med bekräftelse på pris, tillgänglighet och leveranstid.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleSendRequest}
                  disabled={sending || selectedWines.size === 0}
                  className="px-8 py-3 bg-primary-foreground text-primary rounded-xl hover:bg-primary-foreground/90 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Skickar...' : `📧 Skicka förfrågan (${selectedWines.size} viner)`}
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
    </div>
  );
}
