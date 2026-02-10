/**
 * VINKOLL ACCESS - Wine Detail
 *
 * /admin/access/vin/[id]
 *
 * Wine info + producer + available lots with request form
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, MapPin, Grape, Wine, Send } from 'lucide-react';
import type { WineDetail, LotPublic } from '@/lib/access-types';

const WINE_TYPE_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  orange: 'Orange',
  fortified: 'Starkvin',
};

export default function WineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [wine, setWine] = useState<WineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request form state
  const [requestingLotId, setRequestingLotId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(6);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [requestedLotIds, setRequestedLotIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/access/wines/${id}`);
        if (!res.ok) throw new Error('Wine not found');
        setWine(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleRequest = async (lot: LotPublic) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/admin/access/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: wine!.id,
          lot_id: lot.id,
          importer_id: lot.importer_id,
          importer_name: lot.importer?.name || null,
          quantity,
          message: message || undefined,
        }),
      });

      if (res.status === 401) {
        router.push(`/admin/access/login?redirect=/admin/access/vin/${id}`);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Kunde inte skicka förfrågan');
      }

      setSubmitSuccess(lot.importer?.name || 'Importören');
      setRequestedLotIds(prev => new Set(prev).add(lot.id));
      setRequestingLotId(null);
      setQuantity(6);
      setMessage('');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-40" />
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded mt-8" />
        </div>
      </div>
    );
  }

  if (error || !wine) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Wine className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Vinet hittades inte</h2>
        <Link href="/admin/access/viner" className="text-[#722F37] hover:underline">
          Tillbaka till viner
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
        <Link href="/admin/access/viner" className="hover:text-foreground transition-colors">
          Viner
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium truncate">{wine.name}</span>
      </nav>

      {/* Wine info */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <div className="flex gap-6">
          {/* Wine image */}
          <div className="shrink-0 w-32 md:w-40">
            {wine.image_url ? (
              <img
                src={wine.image_url}
                alt={wine.name}
                className="w-full h-auto rounded-lg object-contain max-h-56"
              />
            ) : (
              <div className="w-full aspect-[3/4] bg-gradient-to-b from-[#722F37]/10 to-[#722F37]/5 rounded-lg flex items-center justify-center">
                <Wine className="h-12 w-12 text-[#722F37]/30" />
              </div>
            )}
          </div>

          {/* Wine details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                  wine.wine_type === 'red' ? 'bg-red-100 text-red-800' :
                  wine.wine_type === 'white' ? 'bg-amber-100 text-amber-800' :
                  wine.wine_type === 'rose' ? 'bg-pink-100 text-pink-800' :
                  wine.wine_type === 'sparkling' ? 'bg-yellow-100 text-yellow-800' :
                  wine.wine_type === 'orange' ? 'bg-orange-100 text-orange-800' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type}
                </span>
                <h1 className="text-2xl font-bold text-foreground">{wine.name}</h1>
                <p className="text-lg text-muted-foreground mt-1">{wine.producer.name}</p>
              </div>
              {wine.vintage && (
                <span className="text-3xl font-light text-muted-foreground">{wine.vintage}</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {wine.grape && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Grape className="h-3 w-3" /> Druva
              </p>
              <p className="text-sm font-medium text-foreground">{wine.grape}</p>
            </div>
          )}
          {wine.region && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Region
              </p>
              <p className="text-sm font-medium text-foreground">{wine.region}</p>
            </div>
          )}
          {wine.country && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Land</p>
              <p className="text-sm font-medium text-foreground">{wine.country}</p>
            </div>
          )}
          {wine.price_sek && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pris</p>
              <p className="text-sm font-medium text-foreground">{wine.price_sek} kr</p>
            </div>
          )}
        </div>

            {wine.description && (
              <p className="text-muted-foreground mt-6 leading-relaxed">{wine.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">
            Förfrågan skickad till {submitSuccess}!
          </p>
          <p className="text-green-700 text-sm mt-1">
            Du kan se status under{' '}
            <Link href="/admin/access/mina-sidor" className="underline">Mina sidor</Link>.
          </p>
        </div>
      )}

      {/* Available lots */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Tillgänglig via {wine.lots.length === 1 ? '1 importör' : `${wine.lots.length} importörer`}
      </h2>

      {wine.lots.length === 0 ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Inga tillgängliga partier just nu.</p>
          <p className="text-sm text-muted-foreground mt-2">
            <Link href="/admin/access/mina-sidor" className="text-[#722F37] hover:underline">
              Skapa en bevakning
            </Link>{' '}
            för att bli notifierad.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wine.lots.map((lot) => (
            <div key={lot.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#722F37]/10 flex items-center justify-center shrink-0">
                    <span className="text-[#722F37] font-bold text-sm">{(lot.importer?.name || 'I').charAt(0)}</span>
                  </div>
                  <div>
                  <h3 className="font-semibold text-foreground">{lot.importer?.name || 'Importör'}</h3>
                  {lot.note_public && (
                    <p className="text-sm text-muted-foreground mt-1">{lot.note_public}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm">
                    {lot.price_sek && (
                      <span className="font-medium text-foreground">{lot.price_sek} kr/fl</span>
                    )}
                    {lot.min_quantity > 1 && (
                      <span className="text-muted-foreground">Min: {lot.min_quantity} fl</span>
                    )}
                  </div>
                  </div>
                </div>

                {requestingLotId !== lot.id && (
                  requestedLotIds.has(lot.id) ? (
                    <span className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-medium shrink-0">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Förfrågan skickad
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setRequestingLotId(lot.id);
                        setQuantity(lot.min_quantity || 6);
                        setSubmitError(null);
                      }}
                      className="flex items-center gap-2 bg-[#722F37] text-white px-4 py-2 rounded-lg hover:bg-[#5a252c] transition-colors text-sm font-medium shrink-0"
                    >
                      <Send className="h-4 w-4" />
                      Skicka förfrågan
                    </button>
                  )
                )}
              </div>

              {/* Inline request form */}
              {requestingLotId === lot.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Antal flaskor
                      </label>
                      <input
                        type="number"
                        min={lot.min_quantity || 1}
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Meddelande (valfritt)
                      </label>
                      <input
                        type="text"
                        placeholder="T.ex. leveransönskemål..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                      />
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-sm text-red-600 mt-2">{submitError}</p>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleRequest(lot)}
                      disabled={submitting}
                      className="bg-[#722F37] text-white px-4 py-2 rounded-lg hover:bg-[#5a252c] transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {submitting ? 'Skickar...' : 'Bekräfta förfrågan'}
                    </button>
                    <button
                      onClick={() => { setRequestingLotId(null); setSubmitError(null); }}
                      className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Producer info */}
      {wine.producer.description && (
        <div className="mt-8 bg-muted/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Om {wine.producer.name}</h2>
          <p className="text-muted-foreground leading-relaxed">{wine.producer.description}</p>
        </div>
      )}
    </div>
  );
}
