'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Wine, Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface WineMatch {
  id: string;
  name: string;
  producer: string;
  vintage: number;
  color: string;
  country: string;
  region: string | null;
  price_ex_vat_sek: number;
  stock_qty: number;
  match_score: number;
  match_reasons: string[];
}

interface RequestWithMatches {
  request: {
    id: string;
    text: string;
    restaurant: string;
    deadline: string;
    filters: {
      color?: string;
      country?: string;
      region?: string;
      budget?: number;
    };
  };
  matches: WineMatch[];
  total_matches: number;
}

interface MatchingSuggestionsProps {
  limit?: number;
}

export function MatchingSuggestions({ limit = 3 }: MatchingSuggestionsProps) {
  const [data, setData] = useState<RequestWithMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch('/api/supplier/matches');
        if (res.ok) {
          const result = await res.json();
          setData(result.requests_with_matches || []);
        }
      } catch (error) {
        console.error('Failed to fetch matches:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return null; // Don't show if no matches
  }

  const formatPrice = (priceInOre: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(priceInOre / 100);
  };

  const getColorLabel = (color: string) => {
    const labels: Record<string, string> = {
      red: 'Rött',
      white: 'Vitt',
      rose: 'Rosé',
      sparkling: 'Mousserande',
      fortified: 'Stärkt',
      orange: 'Orange',
    };
    return labels[color] || color;
  };

  return (
    <div className="bg-gradient-to-br from-[#7B1E1E]/5 to-amber-50 rounded-lg border border-[#7B1E1E]/20 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-[#7B1E1E]/10 rounded-lg">
          <Sparkles className="h-5 w-5 text-[#7B1E1E]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Matchande förfrågningar
          </h2>
          <p className="text-sm text-gray-600">
            Dina viner matchar dessa förfrågningar
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.slice(0, limit).map((item) => (
          <div
            key={item.request.id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* Request Header */}
            <button
              onClick={() => setExpanded(expanded === item.request.id ? null : item.request.id)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {item.request.restaurant}
                  </span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {item.total_matches} matchande viner
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-1">
                  {item.request.text}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  Deadline{' '}
                  {formatDistanceToNow(new Date(item.request.deadline), {
                    addSuffix: true,
                    locale: sv,
                  })}
                </div>
              </div>
              <ChevronRight
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  expanded === item.request.id ? 'rotate-90' : ''
                }`}
              />
            </button>

            {/* Expanded Matches */}
            {expanded === item.request.id && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-3 mb-2">
                  Föreslagna viner från din katalog
                </p>
                <div className="space-y-2">
                  {item.matches.map((wine) => (
                    <div
                      key={wine.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                    >
                      <div className="p-1.5 bg-[#7B1E1E]/10 rounded">
                        <Wine className="h-4 w-4 text-[#7B1E1E]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {wine.producer} {wine.name}{' '}
                          {wine.vintage > 0 ? wine.vintage : 'NV'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{getColorLabel(wine.color)}</span>
                          <span>•</span>
                          <span>{wine.country}</span>
                          <span>•</span>
                          <span>{formatPrice(wine.price_ex_vat_sek)}</span>
                          <span>•</span>
                          <span>{wine.stock_qty} i lager</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <a
                  href={`/supplier/requests?id=${item.request.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#7B1E1E] hover:text-[#7B1E1E]/80"
                >
                  Skapa offert
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {data.length > limit && (
        <a
          href="/supplier/requests"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#7B1E1E] hover:text-[#7B1E1E]/80"
        >
          Visa alla {data.length} matchande förfrågningar
          <ArrowRight className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
