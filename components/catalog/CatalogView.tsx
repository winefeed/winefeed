'use client';

/**
 * CATALOG VIEW - Public wine catalog display
 *
 * Client component with search, filter, and wine card grid.
 * Shows wine details WITHOUT prices.
 */

import { useState } from 'react';
import Image from 'next/image';
import { Search, Wine, Leaf, Sparkles, ArrowUpDown } from 'lucide-react';

interface CatalogWine {
  id: string;
  name: string;
  producer: string;
  vintage: number | string | null;
  region: string;
  country: string;
  grape: string;
  color: string;
  description: string | null;
  appellation: string | null;
  alcohol_pct: number | null;
  bottle_size_ml: number | null;
  organic: boolean | null;
  biodynamic: boolean | null;
  case_size: number | null;
}

interface CatalogViewProps {
  supplierName: string;
  supplierType: string;
  wines: CatalogWine[];
}

const COLOR_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  fortified: 'Starkvin',
  orange: 'Orange',
};

const COLOR_STYLES: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  white: 'bg-yellow-100 text-yellow-700',
  rose: 'bg-pink-100 text-pink-700',
  sparkling: 'bg-blue-100 text-blue-700',
  fortified: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
};

export default function CatalogView({ supplierName, supplierType, wines }: CatalogViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [colorFilter, setColorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('producer');
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());

  const uniqueColors = [...new Set(wines.map(w => w.color).filter(Boolean))].sort((a, b) =>
    (COLOR_LABELS[a] || a).localeCompare(COLOR_LABELS[b] || b, 'sv')
  );

  const filtered = wines.filter((wine) => {
    if (colorFilter !== 'ALL' && wine.color !== colorFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      wine.name.toLowerCase().includes(term) ||
      wine.producer.toLowerCase().includes(term) ||
      (wine.region?.toLowerCase() || '').includes(term) ||
      (wine.country?.toLowerCase() || '').includes(term) ||
      (wine.grape?.toLowerCase() || '').includes(term)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name, 'sv');
      case 'producer': return a.producer.localeCompare(b.producer, 'sv') || a.name.localeCompare(b.name, 'sv');
      case 'country': return (a.country || '').localeCompare(b.country || '', 'sv') || a.name.localeCompare(b.name, 'sv');
      case 'color': return (COLOR_LABELS[a.color] || '').localeCompare(COLOR_LABELS[b.color] || '', 'sv') || a.name.localeCompare(b.name, 'sv');
      default: return 0;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#722F37] to-[#8B3A42]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{supplierName}</h1>
              <p className="text-white/70 text-sm">Vinkatalog</p>
            </div>
            <Image src="/winefeed-logo-white.svg" alt="Winefeed" width={240} height={51} className="w-[140px] sm:w-[240px] h-auto" />
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök vin, producent, region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 focus:border-[#722F37] bg-white"
            />
          </div>
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className={`px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 bg-white ${
              colorFilter !== 'ALL' ? 'border-[#722F37] text-[#722F37]' : 'border-gray-300 text-gray-700'
            }`}
          >
            <option value="ALL">Alla färger</option>
            {uniqueColors.map(color => (
              <option key={color} value={color}>{COLOR_LABELS[color] || color}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 bg-white text-gray-700"
          >
            <option value="producer">Producent</option>
            <option value="name">Vinnamn</option>
            <option value="country">Land</option>
            <option value="color">Färg</option>
          </select>
          <span className="text-sm text-gray-500">{filtered.length} viner</span>
        </div>
      </div>

      {/* Wine Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {sorted.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((wine) => (
              <div key={wine.id} className="bg-white rounded-lg border border-gray-200 p-5">
                {/* Color badge */}
                {wine.color && (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${COLOR_STYLES[wine.color] || 'bg-gray-100 text-gray-700'}`}>
                    {COLOR_LABELS[wine.color] || wine.color}
                  </span>
                )}

                {/* Wine name */}
                <h3 className="font-semibold text-gray-900 mb-1">
                  {wine.name}
                  {!!wine.vintage && !wine.name.includes(String(wine.vintage)) && (
                    <span className="text-gray-500 font-normal ml-1">{wine.vintage}</span>
                  )}
                </h3>

                {/* Producer */}
                <p className="text-sm text-gray-600 mb-2">{wine.producer}</p>

                {/* Region + Country */}
                <p className="text-sm text-gray-500 mb-3">
                  {[wine.region, wine.country].filter(Boolean).join(', ')}
                  {wine.appellation && (
                    <span className="block text-xs text-gray-400 mt-0.5">{wine.appellation}</span>
                  )}
                </p>

                {/* Grape */}
                {wine.grape && (
                  <p className="text-xs text-gray-500 mb-2">
                    <span className="font-medium">Druva:</span> {wine.grape}
                  </p>
                )}

                {/* Alcohol + Bottle Size */}
                <div className="flex gap-3 text-xs text-gray-400 mb-3">
                  {!!wine.alcohol_pct && <span>{wine.alcohol_pct}%</span>}
                  {!!wine.bottle_size_ml && <span>{wine.bottle_size_ml} ml</span>}
                </div>

                {/* Badges */}
                <div className="flex gap-2 flex-wrap">
                  {wine.organic && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
                      <Leaf className="h-3 w-3" />
                      Ekologisk
                    </span>
                  )}
                  {wine.biodynamic && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">
                      <Sparkles className="h-3 w-3" />
                      Biodynamisk
                    </span>
                  )}
                </div>

                {/* Description */}
                {wine.description && (
                  <div className="mt-3">
                    <p className={`text-sm text-gray-600 ${expandedDescs.has(wine.id) ? '' : 'line-clamp-3'}`}>{wine.description}</p>
                    {wine.description.length > 150 && (
                      <button
                        onClick={() => setExpandedDescs(prev => {
                          const next = new Set(prev);
                          next.has(wine.id) ? next.delete(wine.id) : next.add(wine.id);
                          return next;
                        })}
                        className="text-xs text-[#722F37] hover:underline mt-1"
                      >
                        {expandedDescs.has(wine.id) ? 'Visa mindre' : 'Läs mer'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Wine className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inga viner hittades</h3>
            <p className="text-gray-500 mb-4">Prova med en annan sökning eller filter</p>
            <button
              onClick={() => { setSearchTerm(''); setColorFilter('ALL'); }}
              className="text-sm text-[#722F37] hover:underline font-medium"
            >
              Rensa sökning
            </button>
          </div>
        )}
      </div>

      {/* Sticky CTA Bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 py-3 z-10">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600 hidden sm:block">
            Intresserad? Kom i kontakt med {supplierName} via Winefeed.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#722F37] text-white rounded-lg font-medium hover:bg-[#8B3A42] transition-colors text-sm whitespace-nowrap sm:ml-auto"
          >
            Skicka förfrågan
          </a>
        </div>
      </div>

      {/* Powered by */}
      <div className="py-4 flex items-center justify-center gap-1.5">
        <span className="text-xs text-gray-400">Powered by</span>
        <a href="https://winefeed.se" className="opacity-50 hover:opacity-80 transition-opacity">
          <Image src="/winefeed-logo-light.svg" alt="Winefeed" width={80} height={20} />
        </a>
      </div>
    </div>
  );
}
