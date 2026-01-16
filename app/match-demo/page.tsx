/**
 * MATCH DEMO PAGE
 *
 * Test interface for product matching service
 * Allows testing different identifier combinations and text fallback
 */

'use client';

import { useState } from 'react';
import type { MatchProductOutput } from '@/lib/match-service';
import { MatchPanel } from '../components/match/MatchPanel';

export default function MatchDemoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchProductOutput | null>(null);

  // Form state
  const [gtin, setGtin] = useState('');
  const [lwin, setLwin] = useState('');
  const [producerSku, setProducerSku] = useState('');
  const [producerId, setProducerId] = useState('');
  const [importerSku, setImporterSku] = useState('');
  const [importerId, setImporterId] = useState('');
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState('');
  const [bottleMl, setBottleMl] = useState('');
  const [producer, setProducer] = useState('');
  const [region, setRegion] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        source: {
          source_type: 'manual',
          source_id: crypto.randomUUID()
        },
        identifiers: {
          ...(gtin && { gtin }),
          ...(lwin && { lwin }),
          ...(producerSku && producerId && { producer_sku: producerSku, producer_id: producerId }),
          ...(importerSku && importerId && { importer_sku: importerSku, importer_id: importerId })
        },
        textFallback: {
          ...(name && { name }),
          ...(vintage && { vintage: parseInt(vintage) }),
          ...(bottleMl && { bottle_ml: parseInt(bottleMl) }),
          ...(producer && { producer }),
          ...(region && { region })
        }
      };

      const response = await fetch('/api/match/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '00000000-0000-0000-0000-000000000001' // Test tenant
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Match failed');
      }

      const data = await response.json();
      setResult(data);

    } catch (err: any) {
      console.error('Match error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setGtin('');
    setLwin('');
    setProducerSku('');
    setProducerId('');
    setImporterSku('');
    setImporterId('');
    setName('');
    setVintage('');
    setBottleMl('');
    setProducer('');
    setRegion('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔍</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Match Demo</h1>
              <p className="text-sm text-primary-foreground/80">Testa produktmatchning</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Matchningsparametrar</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Identifiers */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">Identifierare (prioritet)</h3>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      GTIN (barcode)
                    </label>
                    <input
                      type="text"
                      value={gtin}
                      onChange={(e) => setGtin(e.target.value)}
                      placeholder="7350000000000"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      LWIN
                    </label>
                    <input
                      type="text"
                      value={lwin}
                      onChange={(e) => setLwin(e.target.value)}
                      placeholder="1014265"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Producer SKU
                      </label>
                      <input
                        type="text"
                        value={producerSku}
                        onChange={(e) => setProducerSku(e.target.value)}
                        placeholder="SKU-123"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Producer ID
                      </label>
                      <input
                        type="text"
                        value={producerId}
                        onChange={(e) => setProducerId(e.target.value)}
                        placeholder="UUID"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Importer SKU
                      </label>
                      <input
                        type="text"
                        value={importerSku}
                        onChange={(e) => setImporterSku(e.target.value)}
                        placeholder="IMP-456"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Importer ID
                      </label>
                      <input
                        type="text"
                        value={importerId}
                        onChange={(e) => setImporterId(e.target.value)}
                        placeholder="UUID"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Text Fallback */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-muted-foreground">Text-fallback</h3>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Vinnamn *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Château Margaux"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Årgång
                      </label>
                      <input
                        type="number"
                        value={vintage}
                        onChange={(e) => setVintage(e.target.value)}
                        placeholder="2015"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Flaskstorlek (ml)
                      </label>
                      <input
                        type="number"
                        value={bottleMl}
                        onChange={(e) => setBottleMl(e.target.value)}
                        placeholder="750"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Producent
                    </label>
                    <input
                      type="text"
                      value={producer}
                      onChange={(e) => setProducer(e.target.value)}
                      placeholder="Château Margaux"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Region
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Bordeaux"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Matchar...' : '🔍 Matcha produkt'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-3 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Rensa
                  </button>
                </div>
              </form>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">Hierarki:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>GTIN exact → AUTO_MATCH</li>
                <li>LWIN exact → AUTO_MATCH</li>
                <li>Producer SKU exact → AUTO_MATCH_WITH_GUARDS</li>
                <li>Importer SKU exact → AUTO_MATCH_WITH_GUARDS</li>
                <li>Wine-Searcher canonical → SUGGESTED</li>
              </ol>
            </div>
          </div>

          {/* Results */}
          <div>
            {loading && (
              <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <p className="text-lg font-medium text-foreground">Matchar produkt...</p>
              </div>
            )}

            {error && (
              <div className="bg-card border border-destructive rounded-lg shadow-sm p-6">
                <div className="flex items-start gap-3 text-destructive">
                  <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold">Matchning misslyckades</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Resultat</h2>
                <MatchPanel result={result} showActions={false} />
              </div>
            )}

            {!loading && !error && !result && (
              <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center text-muted-foreground">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-lg font-medium">Fyll i parametrar och klicka &quot;Matcha produkt&quot;</p>
                <p className="text-sm mt-2">
                  Testa olika kombinationer av identifierare och text för att se hur matchningen fungerar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
