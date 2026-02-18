'use client';

/**
 * WINE DETAIL PANEL - Expandable detail view for wine catalog
 *
 * Shows and allows editing of extended wine fields:
 * description, appellation, alcohol_pct, bottle_size_ml,
 * color, organic, biodynamic, sku, case_size
 *
 * Uses save-on-blur pattern matching the inline editing in wines page.
 */

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';

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
];

const BOTTLE_SIZES = [
  { value: 375, label: '375 ml (halv)' },
  { value: 500, label: '500 ml' },
  { value: 750, label: '750 ml (standard)' },
  { value: 1500, label: '1500 ml (magnum)' },
];

export default function WineDetailPanel({ wine, supplierId, onSave, onError }: WineDetailPanelProps) {
  const [savingField, setSavingField] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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
    if (newValue === originalValue) return;
    saveField(field, newValue);
  };

  const handleToggle = (field: string, currentValue: boolean | null) => {
    saveField(field, !currentValue);
  };

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Beskrivning
              {savingField === 'description' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
            </label>
            <textarea
              ref={descriptionRef}
              defaultValue={wine.description || ''}
              onBlur={(e) => handleBlur('description', e.target.value || null, wine.description || null)}
              rows={4}
              maxLength={2000}
              placeholder="Smakprofil, vinifiering, matförslag..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">
              {descriptionRef.current?.value.length || wine.description?.length || 0}/2000
            </p>
          </div>

          {/* Appellation */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Appellation
              {savingField === 'appellation' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
            </label>
            <input
              type="text"
              defaultValue={wine.appellation || ''}
              onBlur={(e) => handleBlur('appellation', e.target.value || null, wine.appellation || null)}
              maxLength={200}
              placeholder="T.ex. Barolo DOCG, Saint-Émilion Grand Cru"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Row: Alcohol + Bottle Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Alkoholhalt (%)
                {savingField === 'alcohol_pct' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Flaskstorlek
                {savingField === 'bottle_size_ml' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
              </label>
              <select
                defaultValue={wine.bottle_size_ml ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  saveField('bottle_size_ml', val);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine bg-white"
              >
                <option value="">Välj...</option>
                {BOTTLE_SIZES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Color + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Färg
                {savingField === 'color' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
              </label>
              <select
                defaultValue={wine.color || ''}
                onChange={(e) => saveField('color', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine bg-white"
              >
                <option value="">Välj...</option>
                {COLOR_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                SKU / Artikelnummer
                {savingField === 'sku' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
              </label>
              <input
                type="text"
                defaultValue={wine.sku || ''}
                onBlur={(e) => handleBlur('sku', e.target.value || null, wine.sku || null)}
                maxLength={100}
                placeholder="T.ex. BRA-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
              />
            </div>
          </div>

          {/* Case Size */}
          <div className="w-1/2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Kartongstorlek (flaskor)
              {savingField === 'case_size' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
            />
          </div>

          {/* Toggles: Organic + Biodynamic */}
          <div className="flex gap-6">
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
              {savingField === 'organic' && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
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
              {savingField === 'biodynamic' && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
