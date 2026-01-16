'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';

interface Wine {
  id: string;
  namn: string;
  producent: string;
  land: string;
  region?: string;
  pris_sek: number;
  ekologisk: boolean;
}

interface Supplier {
  namn: string;
  kontakt_email: string;
  normalleveranstid_dagar: number;
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

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hämta suggestions från sessionStorage (sparades av request-form)
    const stored = sessionStorage.getItem('latest-suggestions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSuggestions(parsed);
      } catch (e) {
        console.error('Failed to parse suggestions:', e);
      }
    }
    setLoading(false);
  }, [requestId]);

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
                <p className="text-sm text-primary-foreground/80">Offertförfrågningar för restauranger</p>
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
            Vi hittade <span className="font-semibold text-foreground">{suggestions.length} perfekta viner</span> för din restaurang
          </p>
        </div>

        {/* Wine Cards */}
        <div className="space-y-6 mb-12">
          {suggestions.map((suggestion, index) => (
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
                      {suggestion.wine.ekologisk && (
                        <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full">
                          🌱 Ekologisk
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <span className="font-medium">{suggestion.wine.producent}</span>
                      <span>•</span>
                      <span>{suggestion.wine.land}</span>
                      {suggestion.wine.region && (
                        <>
                          <span>•</span>
                          <span>{suggestion.wine.region}</span>
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
                    <div>
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
                      <p className="text-xs text-muted-foreground">
                        Leverans: {suggestion.supplier.normalleveranstid_dagar} dagar
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm font-medium">Inkludera i offert</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-primary text-primary-foreground rounded-2xl shadow-xl p-8">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-3">Bekräfta din offert</h3>
            <p className="text-primary-foreground/90 mb-6">
              Välj de viner du vill ha och skicka din offertförfrågan.
              Leverantörerna kontaktar dig inom 24 timmar med bekräftelse på pris, tillgänglighet och leveranstid. För EU-viner hanteras all regelefterlevnad av vår licensierade importörpartner.
            </p>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-3 bg-primary-foreground text-primary rounded-xl hover:bg-primary-foreground/90 transition-colors font-medium shadow-lg">
                📧 Skicka offert
              </button>
              <button
                onClick={() => router.push('/dashboard/new-request')}
                className="px-8 py-3 bg-primary/20 text-primary-foreground rounded-xl hover:bg-primary/30 transition-colors font-medium"
              >
                🔍 Ny offertförfrågan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
