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

// When supplier toggles "show full catalogue", we still respect the
// hard color filter — going from 5 wines to 200 wines mixed colors
// is overwhelming and most proposals stay color-correct anyway.
function matchesCriteriaRelaxed(wine: SupplierWine, c: OpenCriteria): boolean {
  if (c.color && wine.color !== c.color) return false;
  return true;
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

        // Restore draft from localStorage if present so the supplier
        // doesn't lose work when they close the tab mid-edit.
        const draftKey = `open-offer-draft-${requestId}`;
        let draft: Record<string, LineState> | null = null;
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(draftKey);
            if (raw) draft = JSON.parse(raw);
          } catch {}
        }

        const initial = new Map<string, LineState>();
        for (const w of list) {
          const fromDraft = draft?.[w.id];
          initial.set(w.id, fromDraft || {
            supplierWineId: w.id,
            included: false,
            price: '',
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
  }, [supplierId, openCriteria.min_bottles, requestId]);

  // Persist draft on every line change
  useEffect(() => {
    if (loading) return;
    if (lines.size === 0) return;
    const draftKey = `open-offer-draft-${requestId}`;
    try {
      const obj = Object.fromEntries(lines.entries());
      localStorage.setItem(draftKey, JSON.stringify(obj));
    } catch {}
  }, [lines, requestId, loading]);

  const matching = useMemo(() => wines.filter(w => matchesCriteria(w, openCriteria)), [wines, openCriteria]);
  // Relaxed list when supplier wants to see more — keeps color filter
  // so they don't drown in irrelevant wines.
  const relaxed = useMemo(() => wines.filter(w => matchesCriteriaRelaxed(w, openCriteria)), [wines, openCriteria]);
  const shown = showAll ? relaxed : matching;

  function updateLine(id: string, patch: Partial<LineState>) {
    setLines(prev => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) next.set(id, { ...current, ...patch });
      return next;
    });
  }

  // Effective price = supplier's typed price if set, otherwise catalog price
  // (öre → kr). Lets supplier check a wine and ship the offer at catalog
  // price without re-typing.
  const wineMap = useMemo(() => new Map(wines.map(w => [w.id, w])), [wines]);
  function effectivePrice(line: LineState): number {
    if (line.price) return parseFloat(line.price) || 0;
    const w = wineMap.get(line.supplierWineId);
    return w?.price_ex_vat_sek ? Math.round(w.price_ex_vat_sek / 100) : 0;
  }

  const includedLines = useMemo(
    () => [...lines.values()].filter(l => {
      if (!l.included || !l.quantity) return false;
      return effectivePrice(l) > 0;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, wineMap]
  );

  const totals = useMemo(() => {
    const bottles = includedLines.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
    const value = includedLines.reduce(
      (s, l) => s + effectivePrice(l) * (parseInt(l.quantity) || 0),
      0
    );
    return { bottles, value };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includedLines]);

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
            offeredPriceExVatSek: effectivePrice(l),
            quantity: parseInt(l.quantity),
          })),
        }),
      });

      if (res.ok) {
        // Clear draft now that the offer is in
        try { localStorage.removeItem(`open-offer-draft-${requestId}`); } catch {}
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
    <div className="p-6 pb-32 max-w-4xl mx-auto">
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
                            placeholder={wine.price_ex_vat_sek ? String(Math.round(wine.price_ex_vat_sek / 100)) : 'Pris'}
                            title="Lämna tomt = ditt katalogpris. Sänkt pris ger bättre konkurrens."
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                          />
                          <div className="text-xs text-slate-400 text-center">kr/fl ex moms</div>
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

      {/* Sticky totals bar — gives the supplier the one number they
          actually care about (total ex moms) without scrolling back up
          to do mental math. Hidden when nothing is selected. */}
      {includedLines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-4 text-sm">
              <div>
                <span className="text-slate-500">Valda viner: </span>
                <span className="font-semibold text-slate-900">{includedLines.length}</span>
              </div>
              <div>
                <span className="text-slate-500">Flaskor: </span>
                <span className="font-semibold text-slate-900">{totals.bottles}</span>
              </div>
              <div>
                <span className="text-slate-500">Totalt: </span>
                <span className="font-semibold text-[#93092b] text-base">
                  {totals.value.toLocaleString('sv-SE')} kr
                </span>
                <span className="text-xs text-slate-400 ml-1">ex moms</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
              style={{ background: '#93092b' }}
            >
              {submitting ? 'Skickar...' : 'Skicka offert'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
