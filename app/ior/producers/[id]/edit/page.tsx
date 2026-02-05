/**
 * IOR EDIT PRODUCER
 *
 * Form to edit an existing producer.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Save, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const countries = [
  'France',
  'Italy',
  'Spain',
  'Germany',
  'Portugal',
  'Argentina',
  'Chile',
  'Australia',
  'New Zealand',
  'South Africa',
  'USA',
  'Austria',
  'Greece',
  'Hungary',
  'Slovenia',
  'Croatia',
];

const regions: Record<string, string[]> = {
  France: ['Bordeaux', 'Burgundy', 'Champagne', 'Loire Valley', 'Rhône Valley', 'Alsace', 'Provence', 'Languedoc'],
  Italy: ['Tuscany', 'Piedmont', 'Veneto', 'Sicily', 'Lombardy', 'Trentino-Alto Adige', 'Friuli-Venezia Giulia'],
  Spain: ['Rioja', 'Ribera del Duero', 'Priorat', 'Rías Baixas', 'Jerez', 'Catalonia'],
  Germany: ['Mosel', 'Rheingau', 'Pfalz', 'Baden', 'Franken'],
  Portugal: ['Douro', 'Alentejo', 'Vinho Verde', 'Dão', 'Bairrada'],
  Argentina: ['Mendoza', 'Salta', 'Patagonia', 'San Juan'],
  Chile: ['Maipo Valley', 'Colchagua Valley', 'Casablanca Valley', 'Maule Valley'],
  Australia: ['Barossa Valley', 'McLaren Vale', 'Hunter Valley', 'Margaret River', 'Yarra Valley'],
  'New Zealand': ['Marlborough', 'Central Otago', 'Hawke\'s Bay', 'Martinborough'],
  'South Africa': ['Stellenbosch', 'Franschhoek', 'Swartland', 'Walker Bay'],
  USA: ['Napa Valley', 'Sonoma', 'Willamette Valley', 'Finger Lakes', 'Washington State'],
  Austria: ['Wachau', 'Burgenland', 'Kamptal', 'Kremstal'],
  Greece: ['Santorini', 'Nemea', 'Naoussa', 'Crete'],
  Hungary: ['Tokaj', 'Eger', 'Villány'],
  Slovenia: ['Goriška Brda', 'Vipava Valley', 'Štajerska'],
  Croatia: ['Istria', 'Dalmatia', 'Slavonia'],
};

interface FormData {
  name: string;
  country: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  notes: string;
  isActive: boolean;
}

export default function EditProducerPage() {
  const params = useParams();
  const router = useRouter();
  const producerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    country: '',
    region: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    notes: '',
    isActive: true,
  });

  const availableRegions = formData.country ? regions[formData.country] || [] : [];

  // Load existing producer data
  useEffect(() => {
    async function fetchProducer() {
      try {
        const response = await fetch(`/api/ior/producers/${producerId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Producenten hittades inte');
          }
          throw new Error('Kunde inte ladda producent');
        }
        const data = await response.json();
        const p = data.producer;

        setFormData({
          name: p.name || '',
          country: p.country || '',
          region: p.region || '',
          contactName: p.contactName || '',
          contactEmail: p.contactEmail || '',
          contactPhone: p.contactPhone || '',
          websiteUrl: p.websiteUrl || '',
          notes: p.notes || '',
          isActive: p.isActive ?? true,
        });
      } catch (err) {
        console.error('Fetch error:', err);
        setLoadError(err instanceof Error ? err.message : 'Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    fetchProducer();
  }, [producerId]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Reset region if country changes
      if (field === 'country' && prev.country !== value) {
        updated.region = '';
      }
      return updated;
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Namn är obligatoriskt');
      return;
    }
    if (!formData.country) {
      setError('Land är obligatoriskt');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/ior/producers/${producerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          country: formData.country,
          region: formData.region || null,
          contact_name: formData.contactName.trim() || null,
          contact_email: formData.contactEmail.trim() || null,
          contact_phone: formData.contactPhone.trim() || null,
          website_url: formData.websiteUrl.trim() || null,
          notes: formData.notes.trim() || null,
          is_active: formData.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kunde inte uppdatera producent');
      }

      router.push(`/ior/producers/${producerId}`);
    } catch (err) {
      console.error('Update producer error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="max-w-2xl bg-white border rounded-lg p-6">
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">{loadError}</p>
          <Link
            href="/ior/producers"
            className="inline-flex items-center gap-2 mt-4 text-wine hover:text-wine/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till producenter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href={`/ior/producers/${producerId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till producent
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-wine/10 rounded-lg">
          <Building2 className="h-6 w-6 text-wine" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Redigera producent</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formData.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white border rounded-lg divide-y">
          {/* Basic Info */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Grunduppgifter</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Producentnamn <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="t.ex. Domaine de la Romanée-Conti"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Country */}
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                  Land <span className="text-red-500">*</span>
                </label>
                <select
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
                  )}
                >
                  <option value="">Välj land...</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
                  Region
                </label>
                <select
                  id="region"
                  value={formData.region}
                  onChange={(e) => handleChange('region', e.target.value)}
                  disabled={!formData.country}
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'disabled:bg-gray-100 disabled:text-gray-400'
                  )}
                >
                  <option value="">{formData.country ? 'Välj region...' : 'Välj land först'}</option>
                  {availableRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active status */}
              <div className="flex items-center gap-3">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-wine focus:ring-wine h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Aktiv producent
                </label>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Kontaktuppgifter</h2>

            <div className="space-y-4">
              {/* Contact Name */}
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
                  Kontaktperson
                </label>
                <input
                  id="contactName"
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  placeholder="t.ex. Jean Dupont"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Contact Email */}
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  E-post
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="t.ex. contact@domaine.fr"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="t.ex. +33 1 23 45 67 89"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Website */}
              <div>
                <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Webbplats
                </label>
                <input
                  id="websiteUrl"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => handleChange('websiteUrl', e.target.value)}
                  placeholder="t.ex. https://www.domaine.fr"
                  className={cn(
                    'w-full px-4 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Anteckningar</h2>

            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              placeholder="Interna anteckningar om producenten..."
              className={cn(
                'w-full px-4 py-3 border border-gray-300 rounded-lg resize-none',
                'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                'placeholder:text-gray-400'
              )}
            />
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
                Spara ändringar
              </>
            )}
          </button>

          <Link
            href={`/ior/producers/${producerId}`}
            className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
          >
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  );
}
