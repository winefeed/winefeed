'use client';

/**
 * Restaurant license verification page.
 *
 * Shown when a restaurant tries to send a request but hasn't completed
 * the serveringstillstånd verification step yet. Collects municipality,
 * case number, valid-until date, and intyg. Admin reviews manually and
 * sets license_verified_at.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileCheck, AlertTriangle, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

interface RestaurantStatus {
  name?: string;
  license_municipality?: string | null;
  license_case_number?: string | null;
  license_valid_until?: string | null;
  license_verified_at?: string | null;
  serving_license_file_url?: string | null;
}

export default function VerifieringPage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [municipality, setMunicipality] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [attested, setAttested] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me/restaurant');
        if (res.ok) {
          const data = await res.json();
          setRestaurant(data);
          if (data.license_municipality) setMunicipality(data.license_municipality);
          if (data.license_case_number) setCaseNumber(data.license_case_number);
          if (data.license_valid_until) setValidUntil(data.license_valid_until.split('T')[0]);
          if (data.license_municipality && data.license_case_number) setAttested(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!municipality.trim() || !caseNumber.trim()) {
      setError('Fyll i kommun och diarienummer');
      return;
    }
    if (!attested) {
      setError('Du måste intyga att tillståndet är giltigt');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/me/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_municipality: municipality.trim(),
          license_case_number: caseNumber.trim(),
          license_valid_until: validUntil || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Kunde inte spara');
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Nätverksfel');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/me/restaurant/license', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Uppladdning misslyckades');
        return;
      }
      const data = await res.json();
      setRestaurant(prev => prev ? { ...prev, serving_license_file_url: data.url } : prev);
    } catch (err: any) {
      setError(err.message || 'Uppladdning misslyckades');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Laddar...</div>;
  }

  const alreadyVerified = !!restaurant?.license_verified_at;
  const pendingReview = !!(restaurant?.license_municipality && restaurant?.license_case_number) && !alreadyVerified;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => router.push('/dashboard/overview')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka till dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="h-2" style={{ background: 'linear-gradient(to right, #722F37, #b41a42, #722F37)' }} />
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#722F37]/10 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-[#722F37]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Verifiera serveringstillstånd</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Winefeed förmedlar kontakt mellan restauranger och importörer enligt alkohollagen.
                  Vi måste därför verifiera att din restaurang har giltigt serveringstillstånd innan
                  du kan skicka förfrågningar.
                </p>
              </div>
            </div>

            {alreadyVerified && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">Verifierad</p>
                  <p className="text-sm text-green-800">
                    Din restaurang är godkänd och du kan skicka förfrågningar. Uppdatera gärna
                    uppgifterna om tillståndet förnyas.
                  </p>
                </div>
              </div>
            )}

            {pendingReview && !alreadyVerified && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Väntar på granskning</p>
                  <p className="text-sm text-amber-800">
                    Vi har fått dina uppgifter och granskar dem. Oftast klart inom en timme på vardagar.
                    Du får ett mail när det är klart.
                  </p>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-800">
                    Tack — vi har fått dina uppgifter och återkommer när de är granskade.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kommun som utfärdat tillståndet
                </label>
                <input
                  type="text"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  placeholder="t.ex. Stockholm"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Diarienummer
                </label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="t.ex. SÄR 2024/1234"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                />
                <p className="text-xs text-slate-500 mt-1">Står på kommunens beslut.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Giltigt t.o.m.
                  <span className="ml-2 text-xs font-normal text-slate-400">(valfritt)</span>
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ladda upp beslut (PDF eller bild)
                  <span className="ml-2 text-xs font-normal text-slate-400">(valfritt men påskyndar granskningen)</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#722F37]/10 file:text-[#722F37] hover:file:bg-[#722F37]/20"
                />
                {uploading && <p className="text-xs text-slate-500 mt-1">Laddar upp...</p>}
                {restaurant?.serving_license_file_url && !uploading && (
                  <p className="text-xs text-green-700 mt-1 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Fil uppladdad</p>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-[#722F37]"
                />
                <label className="text-sm text-amber-900 leading-snug">
                  <span className="font-medium block mb-1">
                    Jag intygar att uppgifterna är korrekta och att tillståndet är giltigt
                  </span>
                  <span className="text-xs text-amber-800">
                    enligt alkohollagen (2010:1622) 8 kap. Felaktigt intygande är straffbart.
                  </span>
                </label>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #722F37, #8B3A42)' }}
              >
                {saving ? 'Sparar...' : 'Skicka för granskning'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
