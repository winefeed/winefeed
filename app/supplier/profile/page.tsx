'use client';

/**
 * SUPPLIER PROFILE PAGE
 *
 * Shows supplier company information with inline editing
 */

import { useEffect, useState } from 'react';
import { Building2, Mail, Phone, Globe, FileText, MapPin, CheckCircle, XCircle, Package, Loader2, Save, Pencil, X, Wine, Sparkles } from 'lucide-react';

interface SupplierProfile {
  supplierId: string;
  supplierName: string;
  supplierType: string;
  orgNumber: string | null;
  licenseNumber: string | null;
  kontaktEmail: string | null;
  telefon: string | null;
  hemsida: string | null;
  isActive: boolean;
  minOrderBottles: number | null;
  provorderEnabled: boolean;
  provorderFeeSek: number;
  userEmail: string;
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importör',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importör',
};

export default function SupplierProfilePage() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // MOQ editing state
  const [editingMoq, setEditingMoq] = useState(false);
  const [moqValue, setMoqValue] = useState<string>('');
  const [savingMoq, setSavingMoq] = useState(false);
  const [moqSuccess, setMoqSuccess] = useState(false);

  // Contact editing state
  const [editingContact, setEditingContact] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  // Provorder state
  const [provorderEnabled, setProvorderEnabled] = useState(false);
  const [provorderFee, setProvorderFee] = useState('500');
  const [savingProvorder, setSavingProvorder] = useState(false);
  const [provorderSuccess, setProvorderSuccess] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/supplier/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setError('Kunde inte hämta företagsprofil');
        }
      } catch (err) {
        setError('Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  // Initialize MOQ value when profile loads
  useEffect(() => {
    if (profile?.minOrderBottles !== undefined) {
      setMoqValue(profile.minOrderBottles?.toString() || '');
    }
  }, [profile?.minOrderBottles]);

  // Initialize contact fields when profile loads
  useEffect(() => {
    if (profile) {
      setContactEmail(profile.kontaktEmail || '');
      setContactPhone(profile.telefon || '');
      setContactWebsite(profile.hemsida || '');
      setProvorderEnabled(profile.provorderEnabled || false);
      setProvorderFee(profile.provorderFeeSek?.toString() || '500');
    }
  }, [profile]);

  async function saveMoq() {
    if (!profile) return;

    setSavingMoq(true);
    setMoqSuccess(false);

    try {
      const value = moqValue.trim() === '' ? null : parseInt(moqValue, 10);

      if (value !== null && (isNaN(value) || value < 0)) {
        setError('Ange ett positivt heltal eller lämna tomt');
        setSavingMoq(false);
        return;
      }

      const res = await fetch('/api/supplier/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minOrderBottles: value }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, minOrderBottles: data.minOrderBottles });
        setEditingMoq(false);
        setMoqSuccess(true);
        setTimeout(() => setMoqSuccess(false), 3000);
      } else {
        const err = await res.json();
        setError(err.error || 'Kunde inte spara');
      }
    } catch (err) {
      setError('Ett fel uppstod vid sparande');
    } finally {
      setSavingMoq(false);
    }
  }

  async function saveContact() {
    if (!profile) return;

    setSavingContact(true);
    setContactSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kontaktEmail: contactEmail.trim() || null,
          telefon: contactPhone.trim() || null,
          hemsida: contactWebsite.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...profile,
          kontaktEmail: data.kontaktEmail,
          telefon: data.telefon,
          hemsida: data.hemsida,
        });
        setEditingContact(false);
        setContactSuccess(true);
        setTimeout(() => setContactSuccess(false), 3000);
      } else {
        const err = await res.json();
        setError(err.error || 'Kunde inte spara kontaktuppgifter');
      }
    } catch (err) {
      setError('Ett fel uppstod vid sparande');
    } finally {
      setSavingContact(false);
    }
  }

  function cancelContactEdit() {
    setEditingContact(false);
    setContactEmail(profile?.kontaktEmail || '');
    setContactPhone(profile?.telefon || '');
    setContactWebsite(profile?.hemsida || '');
  }

  async function saveProvorder(enabled: boolean, fee?: number) {
    if (!profile) return;

    setSavingProvorder(true);
    setProvorderSuccess(false);
    setError(null);

    try {
      const updates: any = { provorderEnabled: enabled };
      if (fee !== undefined) {
        updates.provorderFeeSek = fee;
      }

      const res = await fetch('/api/supplier/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...profile,
          provorderEnabled: data.provorderEnabled,
          provorderFeeSek: data.provorderFeeSek,
        });
        setProvorderEnabled(data.provorderEnabled);
        setProvorderFee(data.provorderFeeSek?.toString() || '500');
        setProvorderSuccess(true);
        setTimeout(() => setProvorderSuccess(false), 3000);
      } else {
        const err = await res.json();
        setError(err.error || 'Kunde inte spara provorder-inställningar');
      }
    } catch (err) {
      setError('Ett fel uppstod vid sparande');
    } finally {
      setSavingProvorder(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="bg-white rounded-lg border p-6">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded w-2/3"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Kunde inte ladda profil'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Företagsprofil</h1>
        <p className="text-gray-500 mt-1">
          Information om ditt företag i Winefeed
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Company Header */}
        <div className="bg-gradient-to-r from-[#7B1E1E] to-[#9B2C2C] p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{profile.supplierName}</h2>
              <p className="text-white/80 text-sm">
                {SUPPLIER_TYPE_LABELS[profile.supplierType] || profile.supplierType}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {profile.isActive ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-300" />
                  <span className="text-sm">Aktivt konto</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-300" />
                  <span className="text-sm">Inaktivt konto</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Företagsinformation
              </h3>

              <ProfileField
                icon={Building2}
                label="Organisationsnummer"
                value={profile.orgNumber}
              />

              <ProfileField
                icon={FileText}
                label="Licensnummer"
                value={profile.licenseNumber}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Kontaktuppgifter
                </h3>
                {!editingContact && (
                  <button
                    onClick={() => setEditingContact(true)}
                    className="flex items-center gap-1 text-sm text-[#7B1E1E] hover:underline"
                  >
                    <Pencil className="h-3 w-3" />
                    Redigera
                  </button>
                )}
                {contactSuccess && (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Sparat
                  </span>
                )}
              </div>

              {editingContact ? (
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Mail className="h-3 w-3" />
                      E-post
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="kontakt@foretag.se"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1E1E]/20 focus:border-[#7B1E1E]"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Phone className="h-3 w-3" />
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="08-123 456 78"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1E1E]/20 focus:border-[#7B1E1E]"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Globe className="h-3 w-3" />
                      Hemsida
                    </label>
                    <input
                      type="url"
                      value={contactWebsite}
                      onChange={(e) => setContactWebsite(e.target.value)}
                      placeholder="https://www.foretag.se"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1E1E]/20 focus:border-[#7B1E1E]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveContact}
                      disabled={savingContact}
                      className="flex-1 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg text-sm font-medium hover:bg-[#6B1818] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Spara
                    </button>
                    <button
                      onClick={cancelContactEdit}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ProfileField
                    icon={Mail}
                    label="E-post"
                    value={profile.kontaktEmail}
                    href={profile.kontaktEmail ? `mailto:${profile.kontaktEmail}` : undefined}
                  />

                  <ProfileField
                    icon={Phone}
                    label="Telefon"
                    value={profile.telefon}
                    href={profile.telefon ? `tel:${profile.telefon}` : undefined}
                  />

                  <ProfileField
                    icon={Globe}
                    label="Hemsida"
                    value={profile.hemsida}
                    href={profile.hemsida || undefined}
                    external
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Behöver du ändra företagsnamn, organisationsnummer eller licensnummer?{' '}
            <a
              href={`mailto:markus@esima.se?subject=Uppdatera företagsuppgifter: ${encodeURIComponent(profile.supplierName)}&body=Hej,%0A%0AJag vill uppdatera följande uppgifter för ${encodeURIComponent(profile.supplierName)}:%0A%0A`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7B1E1E] hover:underline font-medium"
            >
              Kontakta Winefeed
            </a>
          </p>
        </div>
      </div>

      {/* Order Settings */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Orderinställningar
        </h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Package className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Minsta totalorder (flaskor)</p>
              {editingMoq ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={moqValue}
                    onChange={(e) => setMoqValue(e.target.value)}
                    placeholder="t.ex. 90"
                    min="0"
                    className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1E1E]/20 focus:border-[#7B1E1E]"
                    autoFocus
                  />
                  <button
                    onClick={saveMoq}
                    disabled={savingMoq}
                    className="px-3 py-1.5 bg-[#7B1E1E] text-white rounded-lg text-sm font-medium hover:bg-[#6B1818] disabled:opacity-50 flex items-center gap-1"
                  >
                    {savingMoq ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Spara
                  </button>
                  <button
                    onClick={() => {
                      setEditingMoq(false);
                      setMoqValue(profile.minOrderBottles?.toString() || '');
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${profile.minOrderBottles ? 'text-gray-900' : 'text-gray-400'}`}>
                    {profile.minOrderBottles ? `${profile.minOrderBottles} flaskor` : 'Ej angivet'}
                  </p>
                  <button
                    onClick={() => setEditingMoq(true)}
                    className="text-[#7B1E1E] text-sm hover:underline"
                  >
                    Ändra
                  </button>
                  {moqSuccess && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Sparat
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Minsta totala beställning i antal flaskor. Kunden kan kombinera olika viner för att nå minimum.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Provorder Settings */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Provorder
              </h3>
            </div>
            {provorderSuccess && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                Sparat
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Aktivera provorder för att låta restauranger beställa mindre kvantiteter
            under din minsta order mot en fast avgift. Perfekt för nya kunder som vill testa dina viner.
          </p>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
            <div>
              <p className="font-medium text-gray-900">Aktivera provorder</p>
              <p className="text-sm text-gray-500">
                Tillåt beställningar under minsta order
              </p>
            </div>
            <button
              onClick={() => saveProvorder(!provorderEnabled)}
              disabled={savingProvorder}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                provorderEnabled ? 'bg-green-500' : 'bg-gray-300'
              } ${savingProvorder ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  provorderEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Fee setting (only shown when enabled) */}
          {provorderEnabled && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Wine className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Provorder-avgift (SEK)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={provorderFee}
                      onChange={(e) => setProvorderFee(e.target.value)}
                      placeholder="500"
                      min="0"
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                    <button
                      onClick={() => {
                        const fee = parseInt(provorderFee) || 500;
                        saveProvorder(true, fee);
                      }}
                      disabled={savingProvorder}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingProvorder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Spara
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Fast avgift som läggs på beställningar under minsta order
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="bg-amber-50 px-6 py-4 border-t border-amber-100">
          <div className="flex items-start gap-3">
            <Wine className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Hur fungerar provorder?</p>
              <p className="mt-1">
                När en restaurang vill beställa under din minsta order visas provorder
                som alternativ. Avgiften täcker extra kostnader för frakt, hantering och fakturering
                av småordrar.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Ditt konto
        </h3>
        <ProfileField
          icon={Mail}
          label="Inloggad som"
          value={profile.userEmail}
        />
      </div>
    </div>
  );
}

interface ProfileFieldProps {
  icon: React.ElementType;
  label: string;
  value: string | null;
  href?: string;
  external?: boolean;
}

function ProfileField({ icon: Icon, label, value, href, external }: ProfileFieldProps) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value || 'Ej angivet'}
        </p>
      </div>
    </div>
  );

  if (href && value) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
      >
        {content}
      </a>
    );
  }

  return content;
}
