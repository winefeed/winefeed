/**
 * VINKOLL ACCESS - Lots Section (Client Component)
 *
 * Interactive lot cards with request form.
 * Separated from server-rendered page for SSR + hydration.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send } from 'lucide-react';
import type { LotPublic } from '@/lib/access-types';

interface LotsSectionProps {
  wineId: string;
  lots: LotPublic[];
}

export default function LotsSection({ wineId, lots }: LotsSectionProps) {
  const router = useRouter();

  const [requestingLotId, setRequestingLotId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(6);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [requestedLotIds, setRequestedLotIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleRequest = async (lot: LotPublic) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/admin/access/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: wineId,
          lot_id: lot.id,
          importer_id: lot.importer_id,
          importer_name: lot.importer?.name || null,
          quantity,
          message: message || undefined,
        }),
      });

      if (res.status === 401) {
        router.push(`/admin/access/login?redirect=/admin/access/vin/${wineId}`);
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

  return (
    <>
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
        Tillgänglig via {lots.length === 1 ? '1 importör' : `${lots.length} importörer`}
      </h2>

      {lots.length === 0 ? (
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
          {lots.map((lot) => (
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
    </>
  );
}
