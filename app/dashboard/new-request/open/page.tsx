'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Megaphone, ArrowLeft, ChevronDown, ChevronUp, Copy, X } from 'lucide-react';

const COLOR_OPTIONS = [
  { value: '', label: 'Alla färger' },
  { value: 'red', label: 'Rött' },
  { value: 'white', label: 'Vitt' },
  { value: 'rose', label: 'Rosé' },
  { value: 'sparkling', label: 'Mousserande' },
  { value: 'orange', label: 'Orange' },
  { value: 'fortified', label: 'Starkvin' },
];

interface Suggestion {
  label: string;
  color?: string;
  appellation?: string;
  country?: string;
  grape?: string;
  maxPrice?: string;
  minBottles?: string;
  organic?: boolean;
  biodynamic?: boolean;
  freeText?: string;
}

const SUGGESTIONS: Suggestion[] = [
  // Stil/funktionsorienterade (sommelier-perspektiv)
  {
    label: 'Fruktigt rött för glasvin, max 90 kr',
    color: 'red',
    maxPrice: '90',
    freeText: 'Fruktigt och lättdrucket, gärna låg tanninstruktur — för glasförsäljning',
  },
  {
    label: 'Naturvin, Frankrike, lågt ingrepp, 120–160 kr',
    color: 'red',
    country: 'Frankrike',
    maxPrice: '160',
    freeText: 'Naturvin med lågt ingrepp, gärna ofiltrerat med karaktär',
    organic: true,
  },
  {
    label: 'Elegant Pinot Noir för finare meny, max 250 kr',
    color: 'red',
    grape: 'Pinot Noir',
    maxPrice: '250',
    freeText: 'Elegant och balanserad, gärna med finesse snarare än kraft',
  },
  // Kategori/regionsorienterade (konkreta beställningar)
  {
    label: 'Klassisk Chablis eller Bourgogne blanc, 12 fl',
    color: 'white',
    appellation: 'Chablis',
    country: 'Frankrike',
    minBottles: '12',
    maxPrice: '200',
  },
  {
    label: 'Mousserande till brunch, 60 fl, max 140 kr',
    color: 'sparkling',
    minBottles: '60',
    maxPrice: '140',
    freeText: 'Crémant, Prosecco eller likvärdig — fräscht och festligt',
  },
  {
    label: 'Italienskt rött för pasta, 24 fl, max 110 kr',
    color: 'red',
    country: 'Italien',
    minBottles: '24',
    maxPrice: '110',
    freeText: 'Chianti, Barbera, Montepulciano eller liknande — vardagsrött med syra och jordighet',
  },
];

function NewOpenRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get('from');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [color, setColor] = useState('');
  const [appellation, setAppellation] = useState('');
  const [country, setCountry] = useState('');
  const [grape, setGrape] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBottles, setMinBottles] = useState('');
  const [vintageFrom, setVintageFrom] = useState('');
  const [organic, setOrganic] = useState(false);
  const [biodynamic, setBiodynamic] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pre-fill from an earlier open request when ?from=<id> is set. Fetches
  // the source request and copies its open_criteria into form state. If
  // the source doesn't exist or isn't an open request, we silently fall
  // through to an empty form + an error banner.
  const [duplicatedFrom, setDuplicatedFrom] = useState<{ id: string; createdAt: string } | null>(null);
  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/requests/${fromId}/status`);
        if (!res.ok) {
          setError('Kunde inte hämta den tidigare förfrågan du vill duplicera');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.request_type !== 'open' || !data.open_criteria) {
          setError('Bara öppna förfrågningar kan dupliceras');
          return;
        }
        const c = data.open_criteria;
        if (c.color) setColor(c.color);
        if (c.appellation) setAppellation(c.appellation);
        if (c.country) setCountry(c.country);
        if (c.grape) setGrape(c.grape);
        if (c.max_price_ex_vat_sek) setMaxPrice(String(c.max_price_ex_vat_sek));
        if (c.min_bottles) setMinBottles(String(c.min_bottles));
        if (c.vintage_from) setVintageFrom(String(c.vintage_from));
        if (c.organic) setOrganic(true);
        if (c.biodynamic) setBiodynamic(true);
        if (c.free_text) setFreeText(c.free_text);
        // Auto-expand advanced if any advanced field is pre-filled,
        // otherwise the user can't see what they're about to submit.
        if (c.vintage_from || c.organic || c.biodynamic || c.free_text) {
          setShowAdvanced(true);
        }
        setDuplicatedFrom({ id: data.id, createdAt: data.created_at });
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Nätverksfel');
      }
    })();
    return () => { cancelled = true; };
  }, [fromId]);

  function clearForm() {
    setColor('');
    setAppellation('');
    setCountry('');
    setGrape('');
    setMaxPrice('');
    setMinBottles('');
    setVintageFrom('');
    setOrganic(false);
    setBiodynamic(false);
    setFreeText('');
    setShowAdvanced(false);
    setDuplicatedFrom(null);
    setError(null);
    // Drop the ?from param so a refresh doesn't re-hydrate
    router.replace('/dashboard/new-request/open');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const criteria: Record<string, unknown> = {};
    if (color) criteria.color = color;
    if (appellation.trim()) criteria.appellation = appellation.trim();
    if (country.trim()) criteria.country = country.trim();
    if (grape.trim()) criteria.grape = grape.trim();
    if (maxPrice) criteria.max_price_ex_vat_sek = Number(maxPrice);
    if (minBottles) criteria.min_bottles = Number(minBottles);
    if (vintageFrom) criteria.vintage_from = Number(vintageFrom);
    if (organic) criteria.organic = true;
    if (biodynamic) criteria.biodynamic = true;
    if (freeText.trim()) criteria.free_text = freeText.trim();

    const hasMatchable = !!(criteria.color || criteria.appellation || criteria.country || criteria.grape);
    if (!hasMatchable) {
      setError('Ange minst ett av färg, appellation, land eller druva');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/requests/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Något gick fel');
        setLoading(false);
        return;
      }

      router.push(`/dashboard/new-request/open/sent?id=${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Nätverksfel');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42, #93092b)' }}>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Tillbaka
          </button>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Öppen förfrågan
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-16">
        {duplicatedFrom && (
          <div className="mb-4 relative rounded-xl border border-[#93092b]/20 bg-[#93092b]/5 p-4 flex items-start gap-3">
            <Copy className="h-4 w-4 text-[#93092b] flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-slate-700">
              <strong>Baserad på din tidigare förfrågan</strong> från{' '}
              {new Date(duplicatedFrom.createdAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}
              . Redigera fritt och skicka som en ny.
              <button
                type="button"
                onClick={clearForm}
                className="ml-3 text-xs font-medium text-[#93092b] hover:underline"
              >
                Rensa fält
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDuplicatedFrom(null)}
              aria-label="Dölj"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="h-2" style={{ background: 'linear-gradient(to right, #93092b, #f1b4b0, #93092b)' }} />
          <div className="p-6 sm:p-8 space-y-6">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Snabbval</label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => {
                      setColor(s.color || '');
                      setAppellation(s.appellation || '');
                      setCountry(s.country || '');
                      setGrape(s.grape || '');
                      setMaxPrice(s.maxPrice || '');
                      setMinBottles(s.minBottles || '');
                      setVintageFrom('');
                      setOrganic(!!s.organic);
                      setBiodynamic(!!s.biodynamic);
                      setFreeText(s.freeText || '');
                    }}
                    className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#93092b]/5 hover:border-[#93092b]/30 hover:text-[#93092b] transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Klicka på ett förslag för att fylla i formen — justera sedan som du vill.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Färg</label>
              <select
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
              >
                {COLOR_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Appellation eller region
              </label>
              <input
                type="text"
                value={appellation}
                onChange={e => setAppellation(e.target.value)}
                placeholder="t.ex. Chablis, Barolo, Rioja"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Mer specifikt matchar bättre</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Land</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="t.ex. Frankrike"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Druva</label>
                <input
                  type="text"
                  value={grape}
                  onChange={e => setGrape(e.target.value)}
                  placeholder="t.ex. Chardonnay"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max pris (kr/flaska ex moms)
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  placeholder="t.ex. 200"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Antal flaskor (min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minBottles}
                  onChange={e => setMinBottles(e.target.value)}
                  placeholder="t.ex. 12"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-[#93092b] hover:text-[#b41a42]"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Avancerat (årgång, ekologiskt, fritext)
            </button>

            {showAdvanced && (
              <div className="space-y-6 -mt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Årgång (tidigast)
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2030"
                    value={vintageFrom}
                    onChange={e => setVintageFrom(e.target.value)}
                    placeholder="t.ex. 2020"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent"
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={organic}
                      onChange={e => setOrganic(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#93092b]"
                    />
                    <span className="text-sm text-slate-700">Ekologiskt</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={biodynamic}
                      onChange={e => setBiodynamic(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#93092b]"
                    />
                    <span className="text-sm text-slate-700">Biodynamiskt</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fritext (valfritt)
                  </label>
                  <textarea
                    value={freeText}
                    onChange={e => setFreeText(e.target.value)}
                    rows={3}
                    placeholder="Önskemål som inte passar i fälten ovan — stil, tillfälle, särskilda krav..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#93092b] focus:border-transparent resize-none"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 border border-red-200 bg-red-50 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-900">
                Öppna förfrågningar granskas av Winefeed innan de skickas ut till leverantörer. Du får en bekräftelse när förfrågan är godkänd — oftast samma dag.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-semibold text-base disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(to right, #93092b, #b41a42)' }}
            >
              {loading ? 'Skickar...' : 'Skicka för granskning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewOpenRequestPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Laddar...</div>}>
      <NewOpenRequestForm />
    </Suspense>
  );
}
