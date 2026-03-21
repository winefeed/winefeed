'use client';

/**
 * WINE DETAIL PANEL - Expandable detail view for wine catalog
 *
 * All-in-one editing panel for supplier wines.
 * Uses save-on-blur pattern for text/number fields,
 * immediate save for selects/toggles.
 */

import { useState, useRef, useEffect } from 'react';
import { Loader2, Star } from 'lucide-react';

interface SupplierWine {
  id: string;
  name: string;
  producer: string;
  vintage: string | null;
  region: string;
  country: string;
  grape: string;
  color: string;
  price_ex_vat_sek: number;
  stock_qty: number;
  moq: number;
  status: 'ACTIVE' | 'TEMPORARILY_UNAVAILABLE' | 'END_OF_VINTAGE';
  is_active: boolean;
  notes?: string | null;
  description?: string | null;
  appellation?: string | null;
  alcohol_pct?: number | null;
  bottle_size_ml?: number | null;
  organic?: boolean | null;
  biodynamic?: boolean | null;
  sku?: string | null;
  case_size?: number | null;
}

interface WineDetailPanelProps {
  wine: SupplierWine;
  supplierId: string;
  onSave: (updatedWine: SupplierWine) => void;
  onError: (message: string) => void;
}

const COLOR_OPTIONS = [
  { value: 'red', label: 'Rött' },
  { value: 'white', label: 'Vitt' },
  { value: 'rose', label: 'Rosé' },
  { value: 'sparkling', label: 'Mousserande' },
  { value: 'fortified', label: 'Starkvin' },
  { value: 'orange', label: 'Orange' },
  { value: 'spirit', label: 'Sprit' },
];

const BOTTLE_SIZES = [
  { value: 375, label: '375 ml (halv)' },
  { value: 500, label: '500 ml' },
  { value: 700, label: '700 ml (sprit)' },
  { value: 750, label: '750 ml (standard)' },
  { value: 1500, label: '1500 ml (magnum)' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Tillgängligt' },
  { value: 'TEMPORARILY_UNAVAILABLE', label: 'Tillfälligt slut' },
  { value: 'END_OF_VINTAGE', label: 'Årgången slut' },
];

interface FoodSuggestion {
  food: string;
  score: number;
  isGoldenPair: boolean;
  reason?: string;
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block text-xs font-medium text-gray-500 mb-1';

function SavingIndicator({ field, savingField }: { field: string; savingField: string | null }) {
  if (savingField !== field) return null;
  return <Loader2 className="inline h-3 w-3 animate-spin ml-1" />;
}

interface SimilarWineItem {
  wine: {
    id: string;
    name: string;
    producer: string;
    country: string;
    region?: string;
    grape?: string;
    color?: string;
    vintage?: number;
    price_ex_vat_sek: number;
    supplier_id: string;
    supplier_name: string;
  };
  similarity: number;
  reasons: string[];
}

export default function WineDetailPanel({ wine, supplierId, onSave, onError }: WineDetailPanelProps) {
  const [savingField, setSavingField] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [foodSuggestions, setFoodSuggestions] = useState<FoodSuggestion[]>([]);
  const [foodLoading, setFoodLoading] = useState(true);
  const [similarWines, setSimilarWines] = useState<SimilarWineItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFoodLoading(true);
    fetch(`/api/suppliers/${supplierId}/wines/${wine.id}/food-suggestions`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.suggestions) {
          setFoodSuggestions(data.suggestions);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFoodLoading(false);
      });
    return () => { cancelled = true; };
  }, [supplierId, wine.id]);

  useEffect(() => {
    let cancelled = false;
    setSimilarLoading(true);
    fetch(`/api/suppliers/${supplierId}/wines/${wine.id}/similar?same_supplier=true`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.similar) {
          setSimilarWines(data.similar.filter((s: SimilarWineItem) => s.similarity >= 40));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });
    return () => { cancelled = true; };
  }, [supplierId, wine.id]);

  const saveField = async (field: string, value: string | number | boolean | null) => {
    setSavingField(field);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const { wine: updatedWine } = await response.json();
        onSave({ ...wine, ...updatedWine });
      } else {
        const err = await response.json();
        onError(err.error || 'Kunde inte spara');
      }
    } catch {
      onError('Ändringar kunde inte sparas');
    } finally {
      setSavingField(null);
    }
  };

  const handleBlur = (field: string, newValue: string | number | null, originalValue: string | number | null) => {
    if (String(newValue ?? '') === String(originalValue ?? '')) return;
    saveField(field, newValue);
  };

  const handleToggle = (field: string, currentValue: boolean | null) => {
    saveField(field, !currentValue);
  };

  return (
    <div className="p-5 bg-gray-50 border-t border-gray-200">
      <div className="max-w-5xl space-y-6">

        {/* === GRUNDINFO === */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Grundinfo</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Namn */}
            <div className="col-span-2">
              <label className={labelClass}>
                Vinnamn
                <SavingIndicator field="name" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.name}
                onBlur={(e) => handleBlur('name', e.target.value, wine.name)}
                className={inputClass}
              />
            </div>

            {/* Producent */}
            <div>
              <label className={labelClass}>
                Producent
                <SavingIndicator field="producer" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.producer}
                onBlur={(e) => handleBlur('producer', e.target.value, wine.producer)}
                className={inputClass}
              />
            </div>

            {/* Årgång */}
            <div>
              <label className={labelClass}>
                Årgång
                <SavingIndicator field="vintage" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.vintage || ''}
                onBlur={(e) => handleBlur('vintage', e.target.value || null, wine.vintage || null)}
                placeholder="2022"
                className={inputClass}
              />
            </div>

            {/* Region */}
            <div>
              <label className={labelClass}>
                Region
                <SavingIndicator field="region" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.region}
                onBlur={(e) => handleBlur('region', e.target.value, wine.region)}
                className={inputClass}
              />
            </div>

            {/* Land */}
            <div>
              <label className={labelClass}>
                Land
                <SavingIndicator field="country" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.country}
                onBlur={(e) => handleBlur('country', e.target.value, wine.country)}
                className={inputClass}
              />
            </div>

            {/* Druva */}
            <div>
              <label className={labelClass}>
                Druva
                <SavingIndicator field="grape" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.grape}
                onBlur={(e) => handleBlur('grape', e.target.value, wine.grape)}
                placeholder="Nebbiolo, Sangiovese..."
                className={inputClass}
              />
            </div>

            {/* Appellation */}
            <div>
              <label className={labelClass}>
                Appellation
                <SavingIndicator field="appellation" savingField={savingField} />
              </label>
              <input
                type="text"
                defaultValue={wine.appellation || ''}
                onBlur={(e) => handleBlur('appellation', e.target.value || null, wine.appellation || null)}
                maxLength={200}
                placeholder="Barolo DOCG"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* === PRIS & LAGER === */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pris & lager</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Pris */}
            <div>
              <label className={labelClass}>
                Pris ex moms (kr)
                <SavingIndicator field="price_ex_vat_sek" savingField={savingField} />
              </label>
              <input
                type="text"
                inputMode="numeric"
                defaultValue={wine.price_ex_vat_sek}
                onBlur={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  if (val !== null && val > 0) handleBlur('price_ex_vat_sek', val, wine.price_ex_vat_sek);
                }}
                className={inputClass}
              />
            </div>

            {/* MOQ */}
            <div>
              <label className={labelClass}>
                MOQ (flaskor)
                <SavingIndicator field="moq" savingField={savingField} />
              </label>
              <input
                type="text"
                inputMode="numeric"
                defaultValue={wine.moq}
                onBlur={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  if (val !== null && val > 0) handleBlur('moq', val, wine.moq);
                }}
                className={inputClass}
              />
            </div>

            {/* Lager */}
            <div>
              <label className={labelClass}>
                Lager (flaskor)
                <SavingIndicator field="stock_qty" savingField={savingField} />
              </label>
              <input
                type="text"
                inputMode="numeric"
                defaultValue={wine.stock_qty}
                onBlur={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : 0;
                  handleBlur('stock_qty', val, wine.stock_qty);
                }}
                className={inputClass}
              />
            </div>

            {/* Kartongstorlek */}
            <div>
              <label className={labelClass}>
                Kartongstorlek
                <SavingIndicator field="case_size" savingField={savingField} />
              </label>
              <input
                type="text"
                inputMode="numeric"
                defaultValue={wine.case_size ?? ''}
                onBlur={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  handleBlur('case_size', val, wine.case_size ?? null);
                }}
                placeholder="6"
                className={inputClass}
              />
            </div>

            {/* Status */}
            <div>
              <label className={labelClass}>
                Status
                <SavingIndicator field="status" savingField={savingField} />
              </label>
              <select
                defaultValue={wine.status}
                onChange={(e) => saveField('status', e.target.value)}
                className={selectClass}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* === DETALJER === */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Detaljer</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Description + Notes */}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>
                  Beskrivning
                  <SavingIndicator field="description" savingField={savingField} />
                </label>
                <textarea
                  ref={descriptionRef}
                  defaultValue={wine.description || ''}
                  onBlur={(e) => handleBlur('description', e.target.value || null, wine.description || null)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Smakprofil, vinifiering, matförslag..."
                  className={`${inputClass} resize-none`}
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">
                  {descriptionRef.current?.value.length || wine.description?.length || 0}/2000
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Anteckningar (visas för restauranger)
                  <SavingIndicator field="notes" savingField={savingField} />
                </label>
                <input
                  type="text"
                  defaultValue={wine.notes || ''}
                  onBlur={(e) => handleBlur('notes', e.target.value || null, wine.notes || null)}
                  maxLength={140}
                  placeholder="Kort info, t.ex. &quot;Nyhet 2026&quot;"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Right: Color, Alcohol, Bottle, SKU, Toggles */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Färg
                    <SavingIndicator field="color" savingField={savingField} />
                  </label>
                  <select
                    defaultValue={wine.color || ''}
                    onChange={(e) => saveField('color', e.target.value || null)}
                    className={selectClass}
                  >
                    <option value="">Välj...</option>
                    {COLOR_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    Alkoholhalt (%)
                    <SavingIndicator field="alcohol_pct" savingField={savingField} />
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={wine.alcohol_pct ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : null;
                      handleBlur('alcohol_pct', val, wine.alcohol_pct ?? null);
                    }}
                    placeholder="13.5"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Flaskstorlek
                    <SavingIndicator field="bottle_size_ml" savingField={savingField} />
                  </label>
                  <select
                    defaultValue={wine.bottle_size_ml ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      saveField('bottle_size_ml', val);
                    }}
                    className={selectClass}
                  >
                    <option value="">Välj...</option>
                    {BOTTLE_SIZES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    SKU / Artikelnummer
                    <SavingIndicator field="sku" savingField={savingField} />
                  </label>
                  <input
                    type="text"
                    defaultValue={wine.sku || ''}
                    onBlur={(e) => handleBlur('sku', e.target.value || null, wine.sku || null)}
                    maxLength={100}
                    placeholder="BRA-001"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => handleToggle('organic', wine.organic ?? false)}
                    disabled={savingField === 'organic'}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      wine.organic ? 'bg-green-500' : 'bg-gray-300'
                    } ${savingField === 'organic' ? 'opacity-50' : ''}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      wine.organic ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <span className="text-sm text-gray-700">Ekologisk</span>
                  <SavingIndicator field="organic" savingField={savingField} />
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => handleToggle('biodynamic', wine.biodynamic ?? false)}
                    disabled={savingField === 'biodynamic'}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      wine.biodynamic ? 'bg-green-500' : 'bg-gray-300'
                    } ${savingField === 'biodynamic' ? 'opacity-50' : ''}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      wine.biodynamic ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <span className="text-sm text-gray-700">Biodynamisk</span>
                  <SavingIndicator field="biodynamic" savingField={savingField} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* === MATFORSLAG === */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Matforslag</h4>
          {foodLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Laddar matforslag...</span>
            </div>
          ) : foodSuggestions.length === 0 ? (
            <p className="text-sm text-gray-400">Inga matforslag tillgangliga. Lagg till druva, farg och region for battre forslag.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {foodSuggestions.map((suggestion) => (
                <span
                  key={suggestion.food}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    suggestion.isGoldenPair
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                  title={suggestion.reason || `Matchpoang: ${suggestion.score}`}
                >
                  {suggestion.isGoldenPair && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                  {suggestion.food}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* === LIKNANDE VINER I KATALOGEN === */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Liknande viner i katalogen</h4>
          {similarLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Laddar liknande viner...</span>
            </div>
          ) : similarWines.length === 0 ? (
            <p className="text-sm text-gray-400">Inga tillrackligt liknande viner hittades i din katalog.</p>
          ) : (
            <div className="space-y-1.5">
              {similarWines.slice(0, 5).map((sw) => (
                <div key={sw.wine.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{sw.wine.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {sw.wine.producer} {sw.wine.vintage ? `${sw.wine.vintage}` : ''} — {sw.wine.grape || ''}
                    </p>
                    {sw.reasons.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">{sw.reasons.join(' · ')}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-800">{sw.wine.price_ex_vat_sek} kr</p>
                    <p className="text-xs text-gray-400">{sw.similarity}% match</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
