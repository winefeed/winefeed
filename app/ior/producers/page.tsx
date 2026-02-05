/**
 * IOR PRODUCERS LIST
 *
 * Full list of producers with search, filters, and table view.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  Building2,
  MapPin,
  Wine,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Producer {
  id: string;
  name: string;
  country: string;
  region?: string;
  logoUrl?: string;
  contactName?: string;
  contactEmail?: string;
  productCount: number;
  openCasesCount: number;
  overdueCasesCount: number;
  isActive: boolean;
  onboardedAt?: string;
}

interface ProducersResponse {
  items: Producer[];
  page: number;
  pageSize: number;
  total: number;
}

const countries = [
  'Alla länder',
  'France',
  'Italy',
  'Spain',
  'Germany',
  'Portugal',
  'Argentina',
  'Chile',
  'Australia',
  'USA',
];

export default function IORProducersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ProducersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || '');
  const [showInactive, setShowInactive] = useState(searchParams.get('inactive') === 'true');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  const fetchProducers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedCountry && selectedCountry !== 'Alla länder') {
        params.set('country', selectedCountry);
      }
      if (showInactive) params.set('inactive', 'true');
      params.set('page', String(page));
      params.set('pageSize', '20');

      const response = await fetch(`/api/ior/producers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch producers');

      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Kunde inte ladda producenter');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCountry, showInactive, page]);

  useEffect(() => {
    fetchProducers();
  }, [fetchProducers]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCountry && selectedCountry !== 'Alla länder') {
      params.set('country', selectedCountry);
    }
    if (showInactive) params.set('inactive', 'true');
    if (page > 1) params.set('page', String(page));

    const queryString = params.toString();
    router.replace(`/ior/producers${queryString ? `?${queryString}` : ''}`, {
      scroll: false,
    });
  }, [searchQuery, selectedCountry, showInactive, page, router]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCountry('');
    setShowInactive(false);
    setPage(1);
  };

  const hasActiveFilters = searchQuery || selectedCountry || showInactive;

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Producenter</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hantera dina vinproducenter och deras kataloger
          </p>
        </div>
        <Link
          href="/ior/producers/new"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-wine text-white font-medium',
            'hover:bg-wine/90 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
          )}
        >
          <Plus className="h-4 w-4" />
          Lägg till producent
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök producent..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className={cn(
              'w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
              'placeholder:text-gray-400'
            )}
          />
        </div>

        {/* Country filter */}
        <select
          value={selectedCountry}
          onChange={(e) => {
            setSelectedCountry(e.target.value);
            setPage(1);
          }}
          className={cn(
            'px-3 py-2 border border-gray-300 rounded-lg bg-white',
            'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
          )}
        >
          {countries.map((country) => (
            <option key={country} value={country === 'Alla länder' ? '' : country}>
              {country}
            </option>
          ))}
        </select>

        {/* Show inactive toggle */}
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(1);
            }}
            className="rounded border-gray-300 text-wine focus:ring-wine"
          />
          <span className="text-sm text-gray-600">Visa inaktiva</span>
        </label>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
            Rensa filter
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Producer list */}
      {data && (
        <>
          {data.items.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {hasActiveFilters
                  ? 'Inga producenter matchar dina filter'
                  : 'Inga producenter ännu'}
              </p>
              {!hasActiveFilters && (
                <Link
                  href="/ior/producers/new"
                  className="inline-flex items-center gap-2 text-wine hover:text-wine/80 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Lägg till din första producent
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.items.map((producer) => (
                <Link
                  key={producer.id}
                  href={`/ior/producers/${producer.id}`}
                  className={cn(
                    'block bg-white border rounded-lg p-4 transition-all',
                    'hover:shadow-md hover:border-wine/30',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2',
                    !producer.isActive && 'opacity-60'
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="h-12 w-12 bg-gradient-to-br from-wine/5 to-wine/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      {producer.logoUrl ? (
                        <img
                          src={producer.logoUrl}
                          alt={producer.name}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-wine/50" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {producer.name}
                        </h3>
                        {!producer.isActive && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                            Inaktiv
                          </span>
                        )}
                        {producer.overdueCasesCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            {producer.overdueCasesCount} försenade
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {producer.region
                            ? `${producer.region}, ${producer.country}`
                            : producer.country}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wine className="h-3.5 w-3.5" />
                          {producer.productCount} produkter
                        </span>
                        {producer.openCasesCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {producer.openCasesCount} öppna ärenden
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.total > data.pageSize && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Visar {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} av {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg border',
                    page === 1
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Föregående
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * data.pageSize >= data.total}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg border',
                    page * data.pageSize >= data.total
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Nästa
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
