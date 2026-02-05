/**
 * IOR ADD PRODUCT
 *
 * Form to add a new product to a producer's catalog.
 * v1: Tight scope - only essential fields.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wine, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const wineTypes = [
  { value: 'RED', label: 'Rött' },
  { value: 'WHITE', label: 'Vitt' },
  { value: 'ROSE', label: 'Rosé' },
  { value: 'SPARKLING', label: 'Mousserande' },
  { value: 'DESSERT', label: 'Dessertvin' },
  { value: 'FORTIFIED', label: 'Starkvin' },
];

const bottleSizes = [
  { value: 375, label: '375 ml (halvflaska)' },
  { value: 750, label: '750 ml (standard)' },
  { value: 1500, label: '1500 ml (magnum)' },
  { value: 3000, label: '3000 ml (dubbel magnum)' },
];

const currentYear = new Date().getFullYear();
const vintageYears = Array.from({ length: 50 }, (_, i) => currentYear - i);

interface FormData {
  name: string;
  vintage: string;
  wineType: string;
  bottleSizeMl: number;
  appellation: string;
  grapeVarieties: string;
  alcoholPct: string;
  caseSize: string;
  isActive: boolean;
}

export default function NewProductPage() {
  const params = useParams();
  const router = useRouter();
  const producerId = params.id as string;

  const [producerName, setProducerName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    vintage: '',
    wineType: 'RED',
    bottleSizeMl: 750,
    appellation: '',
    grapeVarieties: '',
    alcoholPct: '',
    caseSize: '6',
    isActive: true,
  });

  // Fetch producer name for context
  useEffect(() => {
    async function fetchProducer() {
      try {
        const response = await fetch(`/api/ior/producers/${producerId}`);
        if (response.ok) {
          const data = await response.json();
          setProducerName(data.producer?.name || '');
        }
      } catch (err) {
        console.error('Failed to fetch producer:', err);
      }
    }
    fetchProducer();
  }, [producerId]);

  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setError('Produktnamn är obligatoriskt');
      return;
    }
    if (!formData.vintage) {
      setError('Årgång är obligatoriskt');
      return;
    }
    if (!formData.wineType) {
      setError('Vintyp är obligatoriskt');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/ior/producers/${producerId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          vintage: parseInt(formData.vintage, 10),
          wine_type: formData.wineType,
          bottle_size_ml: formData.bottleSizeMl,
          appellation: formData.appellation.trim() || null,
          grape_varieties: formData.grapeVarieties.trim()
            ? formData.grapeVarieties.split(',').map(g => g.trim()).filter(Boolean)
            : null,
          alcohol_pct: formData.alcoholPct ? parseFloat(formData.alcoholPct) : null,
          case_size: parseInt(formData.caseSize, 10) || 6,
          is_active: formData.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kunde inte skapa produkt');
      }

      // Redirect back to catalog tab
      router.push(`/ior/producers/${producerId}?tab=catalog`);
    } catch (err) {
      console.error('Create product error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href={`/ior/producers/${producerId}?tab=catalog`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till katalog
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-wine/10 rounded-lg">
          <Wine className="h-6 w-6 text-wine" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Lägg till produkt</h1>
          {producerName && (
            <p className="text-sm text-gray-500 mt-1">
              {producerName}
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white border rounded-lg divide-y">
          {/* Basic Info */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Produktinformation</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Produktnamn <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="t.ex. Château Margaux Premier Grand Cru Classé"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Vintage & Type row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Vintage */}
                <div>
                  <label htmlFor="vintage" className="block text-sm font-medium text-gray-700 mb-1">
                    Årgång <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="vintage"
                    value={formData.vintage}
                    onChange={(e) => handleChange('vintage', e.target.value)}
                    className={cn(
                      'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white',
                      'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
                    )}
                  >
                    <option value="">Välj årgång...</option>
                    <option value="0">NV (Non-Vintage)</option>
                    {vintageYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Wine Type */}
                <div>
                  <label htmlFor="wineType" className="block text-sm font-medium text-gray-700 mb-1">
                    Vintyp <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="wineType"
                    value={formData.wineType}
                    onChange={(e) => handleChange('wineType', e.target.value)}
                    className={cn(
                      'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white',
                      'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
                    )}
                  >
                    {wineTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bottle size & Case size row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bottle Size */}
                <div>
                  <label htmlFor="bottleSize" className="block text-sm font-medium text-gray-700 mb-1">
                    Flaskstorlek <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="bottleSize"
                    value={formData.bottleSizeMl}
                    onChange={(e) => handleChange('bottleSizeMl', parseInt(e.target.value, 10))}
                    className={cn(
                      'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white',
                      'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
                    )}
                  >
                    {bottleSizes.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Case Size */}
                <div>
                  <label htmlFor="caseSize" className="block text-sm font-medium text-gray-700 mb-1">
                    Kartongstorlek
                  </label>
                  <select
                    id="caseSize"
                    value={formData.caseSize}
                    onChange={(e) => handleChange('caseSize', e.target.value)}
                    className={cn(
                      'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white',
                      'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
                    )}
                  >
                    <option value="1">1 flaska</option>
                    <option value="3">3 flaskor</option>
                    <option value="6">6 flaskor</option>
                    <option value="12">12 flaskor</option>
                    <option value="24">24 flaskor</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Details */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Ytterligare detaljer</h2>

            <div className="space-y-4">
              {/* Appellation */}
              <div>
                <label htmlFor="appellation" className="block text-sm font-medium text-gray-700 mb-1">
                  Appellation
                </label>
                <input
                  id="appellation"
                  type="text"
                  value={formData.appellation}
                  onChange={(e) => handleChange('appellation', e.target.value)}
                  placeholder="t.ex. Margaux AOC"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Grape Varieties */}
              <div>
                <label htmlFor="grapeVarieties" className="block text-sm font-medium text-gray-700 mb-1">
                  Druvor
                </label>
                <input
                  id="grapeVarieties"
                  type="text"
                  value={formData.grapeVarieties}
                  onChange={(e) => handleChange('grapeVarieties', e.target.value)}
                  placeholder="t.ex. Cabernet Sauvignon, Merlot, Petit Verdot"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
                <p className="text-xs text-gray-400 mt-1">Separera med komma</p>
              </div>

              {/* Alcohol */}
              <div className="w-1/2">
                <label htmlFor="alcoholPct" className="block text-sm font-medium text-gray-700 mb-1">
                  Alkoholhalt (%)
                </label>
                <input
                  id="alcoholPct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.alcoholPct}
                  onChange={(e) => handleChange('alcoholPct', e.target.value)}
                  placeholder="t.ex. 13.5"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Active status */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-wine focus:ring-wine h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Aktiv produkt (visas i katalogen)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors',
              saving
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-wine text-white hover:bg-wine/90'
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Lägg till produkt
              </>
            )}
          </button>

          <Link
            href={`/ior/producers/${producerId}?tab=catalog`}
            className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
          >
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  );
}
