'use client';

/**
 * DEMO SEARCH — Public replica of the restaurant search experience
 *
 * Mirrors /dashboard/new-request + /dashboard/results/[id] flow
 * but runs entirely client-side with pre-fetched wines.
 * No auth required, no API calls.
 */

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  Wine,
  MapPin,
  Leaf,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe2,
  TrendingUp,
} from 'lucide-react';
import type { DemoWine } from '@/app/demo/page';

/* ───────────────── constants ───────────────── */

const WINE_TYPES = [
  { value: 'all', label: 'Alla typer', dotColor: 'bg-gray-400' },
  { value: 'red', label: 'Rött', dotColor: 'bg-red-600' },
  { value: 'white', label: 'Vitt', dotColor: 'bg-amber-200' },
  { value: 'sparkling', label: 'Mousserande', dotColor: 'bg-amber-400' },
  { value: 'rose', label: 'Rosé', dotColor: 'bg-pink-400' },
  { value: 'orange', label: 'Orange', dotColor: 'bg-orange-500' },
] as const;

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

/* ───────────────── component ───────────────── */

export default function DemoSearch({ wines }: { wines: DemoWine[] }) {
  const [searchText, setSearchText] = useState('');
  const [wineType, setWineType] = useState('all');
  const [showDelivery, setShowDelivery] = useState(false);
  const [deliveryCity, setDeliveryCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState('relevance');
  const resultsRef = useRef<HTMLDivElement>(null);

  /* ── client-side search/filter ── */

  const results = useMemo(() => {
    if (!hasSearched) return [];

    let filtered = wines;

    // Filter by wine type
    if (wineType !== 'all') {
      filtered = filtered.filter((w) => w.color === wineType);
    }

    // Filter by search text
    if (searchText.trim()) {
      const terms = searchText.toLowerCase().split(/\s+/);
      filtered = filtered.filter((w) => {
        const haystack = [
          w.name,
          w.producer,
          w.country,
          w.region,
          w.grape,
          w.appellation,
          w.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case 'producer':
        sorted.sort((a, b) =>
          (a.producer || '').localeCompare(b.producer || '', 'sv')
        );
        break;
      case 'country':
        sorted.sort((a, b) =>
          (a.country || '').localeCompare(b.country || '', 'sv')
        );
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
        break;
      // 'relevance' = default order from DB
    }

    return sorted;
  }, [wines, wineType, searchText, hasSearched, sortBy]);

  /* ── color counts for quick-filter badges ── */

  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const base = searchText.trim()
      ? wines.filter((w) => {
          const terms = searchText.toLowerCase().split(/\s+/);
          const haystack = [w.name, w.producer, w.country, w.region, w.grape, w.appellation, w.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return terms.every((t) => haystack.includes(t));
        })
      : wines;
    for (const w of base) {
      if (w.color) counts[w.color] = (counts[w.color] || 0) + 1;
    }
    return counts;
  }, [wines, searchText]);

  /* ── handlers ── */

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    // Small delay to show spinner (mimics real API call)
    setTimeout(() => {
      setIsSearching(false);
      setHasSearched(true);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 600);
  };

  const uniqueSuppliers = new Set(wines.map((w) => w.supplier_name).filter(Boolean));

  /* ───────────────── RENDER ───────────────── */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      {/* ── Hero Header — exact replica of new-request ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom right, #93092b, #b41a42, #93092b)',
        }}
      >
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
          <div className="text-center">
            {/* Logo + demo badge */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image
                src="/winefeed-logo-white.svg"
                alt="Winefeed"
                width={160}
                height={34}
                priority
              />
              <span className="px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white/90 rounded-full text-xs font-medium">
                Demo
              </span>
            </div>

            {/* Icon badge — hidden on mobile */}
            <div className="hidden sm:inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 ring-1 ring-white/30 shadow-lg">
              <span className="text-3xl sm:text-4xl">🍷</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Hitta rätt vin
            </h1>
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">
              Beskriv vad du söker så hittar vi matchande viner
            </p>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 mt-4 text-sm text-white/70">
              <span className="flex items-center gap-1.5">
                <Wine className="h-4 w-4" />
                {wines.length} viner
              </span>
              <span>·</span>
              <span>{uniqueSuppliers.size} leverantörer</span>
            </div>
          </div>
        </div>

        {/* Wave divider — hidden on mobile */}
        <div className="relative hidden sm:block h-8">
          <svg
            className="absolute bottom-0 w-full h-8"
            preserveAspectRatio="none"
            viewBox="0 0 1440 54"
          >
            <path
              fill="white"
              d="M0,32L120,37.3C240,43,480,53,720,48C960,43,1200,21,1320,10.7L1440,0L1440,54L1320,54C1200,54,960,54,720,54C480,54,240,54,120,54L0,54Z"
            />
          </svg>
        </div>
      </div>

      {/* ── Search Form Card ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-8 pb-8">
        <div className="relative">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div
              className="h-2"
              style={{
                background: 'linear-gradient(to right, #93092b, #f1b4b0, #93092b)',
              }}
            />
            <div className="p-6 sm:p-8">
              <form onSubmit={handleSearch} className="space-y-6">
                {/* Main search input */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder='T.ex. "Italienskt rött till lamm" eller "12 Ripasso under 150 kr"'
                    className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#93092b] focus:ring-2 focus:ring-[#93092b]/20 outline-none transition-all"
                  />
                </div>

                {/* Wine type chips */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Wine className="h-4 w-4" />
                    Vintyp
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 sm:overflow-visible sm:flex-wrap sm:mx-0 sm:px-0 scrollbar-hide [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:[mask-image:none]">
                    {WINE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setWineType(type.value)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          wineType === type.value
                            ? 'bg-[#93092b] text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block w-3 h-3 rounded-full mr-1.5 ${type.dotColor}`}
                        />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivery city */}
                <div className="space-y-2">
                  {!showDelivery && !deliveryCity ? (
                    <button
                      type="button"
                      onClick={() => setShowDelivery(true)}
                      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <MapPin className="h-4 w-4" />
                      + Lägg till leveransort
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={deliveryCity}
                        onChange={(e) => setDeliveryCity(e.target.value)}
                        placeholder="T.ex. Stockholm, Malmö"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#93092b] focus:ring-1 focus:ring-[#93092b]/20 outline-none"
                      />
                      {deliveryCity && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryCity('');
                            setShowDelivery(false);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full py-4 bg-[#93092b] text-white rounded-2xl font-semibold text-lg hover:bg-[#b41a42] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  {isSearching ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Söker viner...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      Sök viner
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Feature cards — hidden on mobile, only before search */}
        {!hasSearched && (
          <div className="hidden sm:grid sm:grid-cols-2 gap-4 sm:gap-6 mt-8">
            <div
              className="group relative overflow-hidden rounded-2xl border p-5 sm:p-6 hover:shadow-lg transition-all duration-300"
              style={{
                background: 'linear-gradient(to bottom right, #fef5f5, #fff9f9)',
                borderColor: '#f1b4b0',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(to bottom right, #93092b, #b41a42)',
                  }}
                >
                  <Globe2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 text-base sm:text-lg">
                    Direktleverans från EU
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Beställ direkt från franska, italienska och spanska producenter.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="group relative overflow-hidden rounded-2xl border p-5 sm:p-6 hover:shadow-lg transition-all duration-300"
              style={{
                background: 'linear-gradient(to bottom right, #fffbf5, #fffef9)',
                borderColor: '#f2e2b6',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(to bottom right, #93092b, #b41a42)',
                  }}
                >
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 text-base sm:text-lg">
                    Smart prisöversikt
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Jämför priser från flera leverantörer automatiskt.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How it works — hidden on mobile, only before search */}
        {!hasSearched && (
          <div className="hidden sm:block mt-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-shadow duration-300">
              <button
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="w-full flex items-center justify-center p-5 sm:p-6 hover:bg-gray-50/50 transition-colors min-h-[60px] relative"
              >
                <span className="font-semibold text-gray-900 text-base sm:text-lg">
                  Så fungerar det
                </span>
                <div className="absolute right-5">
                  {showHowItWorks ? (
                    <ChevronUp className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500" />
                  )}
                </div>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  showHowItWorks
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="p-5 sm:p-6 pt-0 border-t border-gray-100">
                    <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                      {[
                        {
                          num: 1,
                          emoji: '💬',
                          title: 'Beskriv fritt',
                          text: 'Skriv vad du söker med egna ord — "italienskt till lamm"',
                        },
                        {
                          num: 2,
                          emoji: '🔍',
                          title: 'Se förslag',
                          text: 'Få matchande viner direkt — förfina med budget och antal',
                        },
                        {
                          num: 3,
                          emoji: '📨',
                          title: 'Skicka förfrågan',
                          text: 'Välj viner och skicka till leverantörer för offert',
                        },
                      ].map((s) => (
                        <div
                          key={s.num}
                          className="relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 hover:shadow-md transition-all duration-300"
                        >
                          <div
                            className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                            style={{
                              background:
                                'linear-gradient(to bottom right, #93092b, #b41a42)',
                            }}
                          >
                            {s.num}
                          </div>
                          <div className="text-3xl mb-3">{s.emoji}</div>
                          <h4 className="font-semibold text-gray-900 mb-2">
                            {s.title}
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {s.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════ RESULTS ══════════════ */}
      {hasSearched && (
        <div ref={resultsRef} className="max-w-6xl mx-auto px-4 pb-12">
          {/* Results header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {results.length} viner hittade
              </h2>
              {searchText && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Sökning: &quot;{searchText}&quot;
                  {wineType !== 'all' && ` · ${COLOR_LABELS[wineType] || wineType}`}
                </p>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93092b]/20 bg-white text-gray-700"
            >
              <option value="relevance">Relevans</option>
              <option value="producer">Producent</option>
              <option value="name">Vinnamn</option>
              <option value="country">Land</option>
            </select>
          </div>

          {/* Quick color filters */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {WINE_TYPES.map((type) => {
              const count =
                type.value === 'all'
                  ? Object.values(colorCounts).reduce((a, b) => a + b, 0)
                  : colorCounts[type.value] || 0;
              return (
                <button
                  key={type.value}
                  onClick={() => setWineType(type.value)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    wineType === type.value
                      ? 'bg-[#93092b] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${type.dotColor}`}
                  />
                  {type.label}
                  <span className="ml-1 text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Wine grid */}
          {results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((wine) => (
                <div
                  key={wine.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  {/* Color badge */}
                  {wine.color && (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${
                        COLOR_STYLES[wine.color] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {COLOR_LABELS[wine.color] || wine.color}
                    </span>
                  )}

                  {/* Wine name */}
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {wine.name}
                    {!!wine.vintage &&
                      !wine.name.includes(String(wine.vintage)) && (
                        <span className="text-gray-500 font-normal ml-1">
                          {wine.vintage}
                        </span>
                      )}
                  </h3>

                  {/* Producer */}
                  <p className="text-sm text-gray-600 mb-2">{wine.producer}</p>

                  {/* Region + Country */}
                  <p className="text-sm text-gray-500 mb-3">
                    {[wine.region, wine.country].filter(Boolean).join(', ')}
                    {wine.appellation && (
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {wine.appellation}
                      </span>
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
                      <p
                        className={`text-sm text-gray-600 ${
                          expandedDescs.has(wine.id) ? '' : 'line-clamp-3'
                        }`}
                      >
                        {wine.description}
                      </p>
                      {wine.description.length > 150 && (
                        <button
                          onClick={() =>
                            setExpandedDescs((prev) => {
                              const next = new Set(prev);
                              next.has(wine.id)
                                ? next.delete(wine.id)
                                : next.add(wine.id);
                              return next;
                            })
                          }
                          className="text-xs text-[#93092b] hover:underline mt-1"
                        >
                          {expandedDescs.has(wine.id) ? 'Visa mindre' : 'Läs mer'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Supplier */}
                  {wine.supplier_name && (
                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                      via {wine.supplier_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wine className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Inga viner hittades
              </h3>
              <p className="text-gray-500 mb-4">
                Prova med en annan sökning eller filter
              </p>
              <button
                onClick={() => {
                  setSearchText('');
                  setWineType('all');
                }}
                className="text-sm text-[#93092b] hover:underline font-medium"
              >
                Rensa sökning
              </button>
            </div>
          )}

          {/* CTA bar */}
          <div className="mt-12 bg-gradient-to-br from-[#93092b] via-[#b41a42] to-[#93092b] rounded-2xl p-8 sm:p-12 text-center text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Redo att komma igång?
            </h2>
            <p className="text-white/80 max-w-lg mx-auto mb-8">
              Skapa ett gratiskonto och börja ta emot offerter från Sveriges
              bästa vinimportörer. Ingen bindningstid, inga startavgifter.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#93092b] rounded-full font-semibold text-lg hover:bg-white/90 transition-colors"
              >
                Skapa konto gratis
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="mailto:markus@winefeed.se"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/40 text-white rounded-full font-medium hover:bg-white/10 transition-colors"
              >
                Kontakta oss
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Sticky CTA bar (only after search) */}
      {hasSearched && results.length > 0 && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 py-3 z-10">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600 hidden sm:block">
              Vill du skicka förfrågan på dessa viner? Skapa ett gratis konto.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#93092b] text-white rounded-lg font-medium hover:bg-[#b41a42] transition-colors text-sm whitespace-nowrap sm:ml-auto"
            >
              Skapa konto & skicka förfrågan
            </Link>
          </div>
        </div>
      )}

      {/* Powered by */}
      <div className="py-4 flex items-center justify-center gap-1.5">
        <span className="text-xs text-gray-400">Powered by</span>
        <a
          href="https://winefeed.se"
          className="opacity-50 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/winefeed-logo-light.svg"
            alt="Winefeed"
            width={80}
            height={20}
          />
        </a>
      </div>
    </div>
  );
}
