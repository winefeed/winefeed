'use client';

/**
 * SUPPLIER PROFILE PAGE
 *
 * Shows supplier company information
 * Read-only for now, editing can be added later
 */

import { useEffect, useState } from 'react';
import { Building2, Mail, Phone, Globe, FileText, MapPin, CheckCircle, XCircle } from 'lucide-react';

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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Kontaktuppgifter
              </h3>

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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Behöver du uppdatera dina uppgifter?{' '}
            <a
              href={`mailto:markus@vinkoll.se?subject=Uppdatera företagsuppgifter: ${encodeURIComponent(profile.supplierName)}&body=Hej,%0A%0AJag vill uppdatera följande uppgifter för ${encodeURIComponent(profile.supplierName)}:%0A%0A`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7B1E1E] hover:underline font-medium"
            >
              Kontakta Winefeed
            </a>
          </p>
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
