'use client';

/**
 * Supplier response UI for OPEN (broadcast) requests.
 *
 * Unlike targeted requests where a restaurant picked specific SKUs,
 * open requests only carry criteria. The supplier browses their own
 * catalogue (filtered by those criteria) and picks wines to propose.
 *
 * Submit path reuses the existing /api/quote-requests/[id]/offers
 * endpoint — offer_lines carry supplier_wine_id so the shape works
 * for both request types.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Send, Wine, AlertTriangle } from 'lucide-react';

interface OpenCriteria {
  color?: string;
  appellation?: string;
  region?: string;
  country?: string;
  grape?: string;
  max_price_ex_vat_sek?: number;
  min_bottles?: number;
  vintage_from?: number;
  organic?: boolean;
  biodynamic?: boolean;
  free_text?: string;
}

interface SupplierWine {
  id: string;
  name: string;
  producer: string;
  country: string;
  region: string | null;
  appellation: string | null;
  vintage: number | null;
  color: string | null;
  grape: string | null;
  price_ex_vat_sek: number | null;
  organic: boolean | null;
  biodynamic: boolean | null;
}

interface Props {
  requestId: string;
  supplierId: string;
  restaurantName: string;
  openCriteria: OpenCriteria;
  alreadyResponded: boolean;
}

const COLOR_LABEL: Record<string, string> = {
  red: 'Rött', white: 'Vitt', rose: 'Rosé',
  sparkling: 'Mousserande', orange: 'Orange', fortified: 'Starkvin',
};

function matchesCriteria(wine: SupplierWine, c: OpenCriteria): boolean {
  if (c.color && wine.color !== c.color) return false;
  if (c.country && wine.country !== c.country) return false;
  if (c.vintage_from && (wine.vintage ?? 0) < c.vintage_from) return false;
  if (c.organic && !wine.organic) return false;
  if (c.biodynamic && !wine.biodynamic) return false;
  if (c.grape && !(wine.grape || '').toLowerCase().includes(c.grape.toLowerCase())) return false;

  const regionTerm = c.appellation || c.region;
  if (regionTerm) {
    const t = regionTerm.toLowerCase();
    const hit =
      (wine.region || '').toLowerCase().includes(t) ||
      (wine.appellation || '').toLowerCase().includes(t) ||
      (wine.name || '').toLowerCase().includes(t);
    if (!hit) return false;
  }
  return true;
}

function describeCriteria(c: OpenCriteria): string {
  const parts: string[] = [];
  if (c.color) parts.push(COLOR_LABEL[c.color] || c.color);
  if (c.appellation) parts.push(c.appellation);
  else if (c.region) parts.push(c.region);
  if (c.country && !c.appellation && !c.region) parts.push(c.country);
  if (c.grape) parts.push(c.grape);
  return parts.join(' · ') || 'Öppen förfrågan';
}

interface LineState {
  supplierWineId: string;
  included: boolean;
  price: string;
  quantity: string;
}

export function OpenRequestResponse({ requestId, supplierId, restaurantName, openCriteria, alreadyResponded }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wines, setWines] = useState<SupplierWine[]>([]);
  const [lines, setLines] = useState<Map<string, LineState>>(new Map());
  const [showAll, setShowAll] = useState(false);
  const [leadTime, setLeadTime] = useState('14');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/suppliers/${supplierId}/wines?limit=500`);
        if (!res.ok) {
          setError('Kunde inte ladda din katalog');
          return;
        }
        const data = await res.json();
        const list: SupplierWine[] = data.wines || data.data || [];
        if (cancelled) return;
        setWines(list);
        const initial = new Map<string, LineState>();
        for (const w of list) {
          initial.set(w.id, {
            supplierWineId: w.id,
            included: false,
            price: w.price_ex_vat_sek ? String(Math.round(w.price_ex_vat_sek / 100)) : '',
            quantity: String(openCriteria.min_bottles || 12),
          });
        }
        setLines(initial);
      } catch (err: any) {
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supplierId, openCriteria.min_bottles]);

  const matching = useMemo(() => wines.filter(w => matchesCriteria(w, openCriteria)), [wines, openCriteria]);
  const shown = showAll ? wines : matching;

  function updateLine(id: string, patch: Partial<LineState>) {
    setLines(prev => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) next.set(id, { ...current, ...patch });
      return next;
    });
  }

  const includedLines = useMemo(
    () => [...lines.values()].filter(l => l.included && l.price && l.quantity),
    [lines]
  );

  async function handleSubmit() {
    if (includedLines.length === 0) {
      setSubmitError('Välj minst ett vin att lägga i offerten');
      return;
    }
    const totalBottles = includedLines.reduce((s, l) => s + parseInt(l.quantity || '0'), 0);
    if (!confirm(`Skicka offert med ${includedLines.length} viner (${totalBottles} flaskor) till ${restaurantName}?`)) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + parseInt(leadTime || '14'));

      const res = await fetch(`/api/quote-requests/${requestId}/offers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          deliveryDate: deliveryDate.toISOString().split('T')[0],
          leadTimeDays: parseInt(leadTime || '14'),
          notes: note || null,
          is_franco: false,
          shipping_cost_sek: null,
          shipping_notes: null,
          lines: includedLines.map(l => ({
            supplierWineId: l.supplierWineId,
            offeredPriceExVatSek: parseFloat(l.price),
            quantity: parseInt(l.quantity),
          })),
        }),
      });

      if (res.ok) {
        router.push('/supplier/offers?success=true');
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Kunde inte skicka offert');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Nätverksfel');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto text-slate-500">Laddar din katalog...</div>;
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-[#93092b] to-[#b41a42] rounded-2xl p-6 text-white mb-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide opacity-80">Öppen förfrågan</div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">{describeCriteria(openCriteria)}</h1>
            <p className="text-white/90 text-sm mt-2">från {restaurantName}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {openCriteria.max_price_ex_vat_sek && (
            <span className="px-3 py-1 rounded-full bg-white/20">Max {openCriteria.max_price_ex_vat_sek} kr/fl</span>
          )}
          {openCriteria.min_bottles && (
            <span className="px-3 py-1 rounded-full bg-white/20">Min {openCriteria.min_bottles} flaskor</span>
          )}
          {openCriteria.vintage_from && (
            <span className="px-3 py-1 rounded-full bg-white/20">Årgång {openCriteria.vintage_from}+</span>
          )}
          {openCriteria.organic && <span className="px-3 py-1 rounded-full bg-white/20">Ekologiskt</span>}
          {openCriteria.biodynamic && <span className="px-3 py-1 rounded-full bg-white/20">Biodynamiskt</span>}
        </div>
        {openCriteria.free_text && (
          <p className="mt-3 text-sm text-white/90 italic">&ldquo;{openCriteria.free_text}&rdquo;</p>
        )}
      </div>

      {alreadyResponded && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          Du har redan skickat en offert på denna förfrågan. Du kan skicka en ny om du vill uppdatera.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">
            Välj viner att föreslå
            <span className="text-slate-500 font-normal ml-2">
              ({matching.length} matchande i din katalog)
            </span>
          </h2>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-[#93092b] hover:underline"
          >
            {showAll ? 'Visa bara matchande' : 'Visa hela katalogen'}
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Wine className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p>Inga viner i din katalog matchar kriterierna.</p>
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 text-sm text-[#93092b] hover:underline"
            >
              Visa hela katalogen ändå
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(wine => {
              const line = lines.get(wine.id);
              if (!line) return null;
              const isMatch = matchesCriteria(wine, openCriteria);
              return (
                <div
                  key={wine.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    line.included ? 'border-[#93092b] bg-[#93092b]/5' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={line.included}
                      onChange={e => updateLine(wine.id, { included: e.target.checked })}
                      className="mt-1 w-4 h-4 rounded accent-[#93092b]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {wine.name}
                        {!isMatch && showAll && (
                          <span className="ml-2 text-xs text-amber-600">(matchar ej kriterier)</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {wine.producer} · {wine.country}
                        {wine.region && ` · ${wine.region}`}
                        {wine.appellation && ` · ${wine.appellation}`}
                        {wine.vintage && ` · ${wine.vintage}`}
                        {wine.grape && ` · ${wine.grape}`}
                      </div>
                    </div>
                    {line.included && (
                      <div className="flex gap-2 flex-shrink-0">
                        <div>
                          <input
                            type="number"
                            value={line.price}
                            onChange={e => updateLine(wine.id, { price: e.target.value })}
                            placeholder="Pris"
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                          />
                          <div className="text-xs text-slate-400 text-center">kr/fl</div>
                        </div>
                        <div>
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={e => updateLine(wine.id, { quantity: e.target.value })}
                            placeholder="Antal"
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-sm"
                          />
                          <div className="text-xs text-slate-400 text-center">fl</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Leveranstid (dagar)</label>
            <input
              type="number"
              value={leadTime}
              onChange={e => setLeadTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Meddelande (valfritt)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="t.ex. information om leveransvillkor, säsongsviner..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none"
          />
        </div>
      </div>

      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{submitError}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || includedLines.length === 0}
        className="w-full py-4 rounded-xl text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(to right, #93092b, #b41a42)' }}
      >
        <Send className="h-4 w-4" />
        {submitting
          ? 'Skickar...'
          : includedLines.length === 0
          ? 'Välj minst ett vin'
          : `Skicka offert (${includedLines.length} ${includedLines.length === 1 ? 'vin' : 'viner'})`}
      </button>
    </div>
  );
}
