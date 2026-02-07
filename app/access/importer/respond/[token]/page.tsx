'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface WineInfo {
  wine_name: string;
  wine_type: string | null;
  vintage: number | null;
  grape: string | null;
  region: string | null;
  country: string | null;
  quantity: number;
  price_sek: number | null;
  consumer_message: string | null;
  can_respond: boolean;
  already_responded: boolean;
}

type PageState = 'loading' | 'form' | 'already_responded' | 'submitted' | 'expired' | 'error';

const WINE_TYPE_SV: Record<string, string> = {
  red: 'Rött', white: 'Vitt', rose: 'Rosé', sparkling: 'Mousserande', orange: 'Orange', fortified: 'Starkvin',
};

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 text-center py-4 px-4 flex items-center justify-center">
        <img src="/vinkoll-logo.png" alt="Vinkoll" className="h-10" />
      </div>
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-lg w-full p-6">
          {children}
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 py-4">
        Vinkoll - Hitta ditt nästa favoritvin
      </div>
    </div>
  );
}

export default function ImporterRespondPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [wineInfo, setWineInfo] = useState<WineInfo | null>(null);

  // Form state
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [priceSek, setPriceSek] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(`/api/access/importer/respond/${token}`);
        if (res.status === 401) {
          setState('expired');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const data: WineInfo = await res.json();
        setWineInfo(data);
        setState(data.already_responded ? 'already_responded' : 'form');
      } catch {
        setState('error');
      }
    }
    loadInfo();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (accepted === null) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/access/importer/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accepted,
          price_sek: accepted && priceSek ? parseFloat(priceSek) : undefined,
          quantity: accepted && quantity ? parseInt(quantity) : undefined,
          delivery_days: accepted && deliveryDays ? parseInt(deliveryDays) : undefined,
          note: note.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        setState('expired');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.message || 'Något gick fel');
        return;
      }

      setState('submitted');
    } catch {
      setSubmitError('Kunde inte skicka svaret. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') {
    return (
      <PageWrapper>
        <div className="text-center py-8 text-gray-500">Laddar...</div>
      </PageWrapper>
    );
  }

  if (state === 'expired') {
    return (
      <PageWrapper>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#9201;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Länken har gått ut</h2>
          <p className="text-gray-600 text-sm">
            Denna länk är inte längre giltig. Om du behöver svara på förfrågan, kontakta oss på{' '}
            <a href="mailto:info@vinkoll.se" className="text-[#722F37] underline">info@vinkoll.se</a>.
          </p>
        </div>
      </PageWrapper>
    );
  }

  if (state === 'error') {
    return (
      <PageWrapper>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#9888;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Något gick fel</h2>
          <p className="text-gray-600 text-sm">
            Försök ladda om sidan. Om problemet kvarstår, kontakta{' '}
            <a href="mailto:info@vinkoll.se" className="text-[#722F37] underline">info@vinkoll.se</a>.
          </p>
        </div>
      </PageWrapper>
    );
  }

  if (state === 'already_responded') {
    return (
      <PageWrapper>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#10004;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Redan besvarad</h2>
          <p className="text-gray-600 text-sm">
            Denna förfrågan har redan besvarats. Tack för ditt svar!
          </p>
        </div>
      </PageWrapper>
    );
  }

  if (state === 'submitted') {
    return (
      <PageWrapper>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#127881;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tack!</h2>
          <p className="text-gray-600 text-sm">
            Ditt svar har skickats till Vinkoll.
            <br />
            Vi återkommer om det finns fler förfrågningar.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // Form state
  const wi = wineInfo!;

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Wine info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Vinförfrågan</h2>
          <p className="text-sm text-gray-500 mb-4">En kund har visat intresse för detta vin via Vinkoll.</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm">
            <div><span className="text-gray-500">Vin:</span> <strong>{wi.wine_name}</strong>{wi.vintage && !wi.wine_name.includes(String(wi.vintage)) ? ` ${wi.vintage}` : ''}</div>
            {wi.wine_type && <div><span className="text-gray-500">Typ:</span> {WINE_TYPE_SV[wi.wine_type] || wi.wine_type}</div>}
            {wi.grape && <div><span className="text-gray-500">Druva:</span> {wi.grape}</div>}
            {wi.region && <div><span className="text-gray-500">Region:</span> {wi.region}{wi.country ? `, ${wi.country}` : ''}</div>}
            <div><span className="text-gray-500">Önskat antal:</span> {wi.quantity} flaskor</div>
            {wi.price_sek && <div><span className="text-gray-500">Angivet pris:</span> {wi.price_sek} kr/fl</div>}
            {wi.consumer_message && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-gray-500">Meddelande:</span> {wi.consumer_message}
              </div>
            )}
          </div>
        </div>

        {/* Response form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kan ni leverera?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAccepted(true)}
                className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  accepted === true
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Ja, kan leverera
              </button>
              <button
                type="button"
                onClick={() => setAccepted(false)}
                className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  accepted === false
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Nej, kan ej leverera
              </button>
            </div>
          </div>

          {accepted === true && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pris per flaska (kr)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceSek}
                  onChange={(e) => setPriceSek(e.target.value)}
                  placeholder="t.ex. 189"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tillgängligt antal</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="t.ex. 12"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beräknad leveranstid (dagar)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  placeholder="t.ex. 5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kommentar <span className="text-gray-400">(valfritt)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={accepted === false ? 'Anledning (valfritt)' : 'Övrig information (valfritt)'}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37] resize-none"
            />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={accepted === null || submitting}
            className="w-full py-3 bg-[#722F37] text-white rounded-lg font-medium text-sm hover:bg-[#5c2630] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Skickar...' : 'Skicka svar'}
          </button>
        </form>
      </div>
    </PageWrapper>
  );
}
