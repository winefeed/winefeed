/**
 * VINKOLL ACCESS - Browse Wines
 *
 * /admin/access/viner
 *
 * Search bar + filter chips + wine card grid + pagination
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Wine, MapPin, Grape } from 'lucide-react';
import type { WineWithProducer } from '@/lib/access-types';

const WINE_TYPE_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  orange: 'Orange',
  fortified: 'Starkvin',
};

const WINE_TYPE_COLORS: Record<string, string> = {
  red: 'bg-red-100 text-red-800',
  white: 'bg-amber-100 text-amber-800',
  rose: 'bg-pink-100 text-pink-800',
  sparkling: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  fortified: 'bg-amber-200 text-amber-900',
};

interface SearchResult {
  data: WineWithProducer[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  filters: { types: string[]; countries: string[] };
}

export default function BrowseWinesPage() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (typeFilter) params.set('type', typeFilter);
      if (countryFilter) params.set('country', countryFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/access/wines?${params}`);
      if (!res.ok) {
        const body = await res.text();
        console.error(`API ${res.status}:`, body);
        throw new Error(`API error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, countryFilter, page]);

  useEffect(() => {
    const timer = setTimeout(fetchWines, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchWines]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWines();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Utforska viner</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Sök på vin, druva, region..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#722F37] focus:border-transparent"
          />
        </div>
      </form>

      {/* Filter chips */}
      {result?.filters && (
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Type filters */}
          <button
            onClick={() => { setTypeFilter(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !typeFilter ? 'bg-[#722F37] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Alla typer
          </button>
          {result.filters.types.map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(typeFilter === t ? '' : t); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                typeFilter === t ? 'bg-[#722F37] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {WINE_TYPE_LABELS[t] || t}
            </button>
          ))}

          <span className="w-px h-6 bg-border self-center mx-1" />

          {/* Country filters */}
          <button
            onClick={() => { setCountryFilter(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !countryFilter ? 'bg-[#722F37] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Alla länder
          </button>
          {result.filters.countries.map((c) => (
            <button
              key={c}
              onClick={() => { setCountryFilter(countryFilter === c ? '' : c); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                countryFilter === c ? 'bg-[#722F37] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading && !result ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg h-48" />
          ))}
        </div>
      ) : result && result.data.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {result.total} {result.total === 1 ? 'vin' : 'viner'} hittade
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.data.map((wine) => (
              <WineCard key={wine.id} wine={wine} />
            ))}
          </div>

          {/* Pagination */}
          {(result.hasMore || result.page > 1) && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Föregående
              </button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                Sida {result.page} av {Math.ceil(result.total / result.limit)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!result.hasMore}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Nästa
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <Wine className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Inga viner hittades</h2>
          <p className="text-muted-foreground mb-6">
            Prova att ändra din sökning eller ta bort filter.
          </p>
          <p className="text-sm text-muted-foreground">
            Kan du inte hitta det du söker?{' '}
            <Link href="/admin/access/mina-sidor" className="text-[#722F37] hover:underline">
              Skapa en bevakning
            </Link>{' '}
            så meddelar vi dig när det dyker upp.
          </p>
        </div>
      )}
    </div>
  );
}

function WineCard({ wine }: { wine: WineWithProducer }) {
  const typeLabel = WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type;
  const typeColor = WINE_TYPE_COLORS[wine.wine_type] || 'bg-muted text-muted-foreground';

  return (
    <Link
      href={`/admin/access/vin/${wine.id}`}
      className="bg-card border border-border rounded-lg p-5 hover:border-rose-300 hover:shadow-md transition-all block"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>
          {typeLabel}
        </span>
        {wine.vintage && (
          <span className="px-2.5 py-1 rounded-md bg-stone-800 text-white text-xs font-bold tabular-nums">{wine.vintage}</span>
        )}
      </div>

      <h3 className="font-semibold text-foreground mb-1 line-clamp-2">{wine.name}</h3>
      <p className="text-sm text-muted-foreground mb-3">{wine.producer.name}</p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {wine.region && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {wine.region}{wine.country ? `, ${wine.country}` : ''}
          </span>
        )}
        {wine.grape && (
          <span className="flex items-center gap-1">
            <Grape className="h-3 w-3" />
            {wine.grape}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        {wine.price_sek ? (
          <span className="text-sm font-medium text-foreground">{wine.price_sek} kr</span>
        ) : (
          <span className="text-sm text-muted-foreground">Pris på förfrågan</span>
        )}
        <span className="text-xs text-muted-foreground">
          {wine.lot_count} {wine.lot_count === 1 ? 'importör' : 'importörer'}
        </span>
      </div>
    </Link>
  );
}
