'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface OrderInfo {
  wine_name: string;
  vintage: number | null;
  reference_code: string;
  quantity: number;
  response_price_sek: number | null;
  response_quantity: number | null;
  can_confirm: boolean;
  already_confirmed: boolean;
}

type PageState = 'loading' | 'form' | 'already_confirmed' | 'submitted' | 'expired' | 'error';

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

export default function ImporterConfirmPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(`/api/access/importer/confirm/${token}`);
        if (res.status === 401) {
          setState('expired');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const data: OrderInfo = await res.json();
        setOrderInfo(data);
        setState(data.already_confirmed ? 'already_confirmed' : 'form');
      } catch {
        setState('error');
      }
    }
    loadInfo();
  }, [token]);

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/access/importer/confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401) {
        setState('expired');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_confirmed') {
          setState('already_confirmed');
          return;
        }
        setSubmitError(data.message || 'Något gick fel');
        return;
      }

      setState('submitted');
    } catch {
      setSubmitError('Kunde inte bekräfta. Försök igen.');
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
            Denna länk är inte längre giltig. Om du behöver bekräfta beställningen, kontakta oss på{' '}
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

  if (state === 'already_confirmed') {
    return (
      <PageWrapper>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#10004;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Redan bekräftad</h2>
          <p className="text-gray-600 text-sm">
            Denna beställning har redan bekräftats. Tack!
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
            Beställningen är bekräftad.
            <br />
            Vi meddelar kunden att allt är klart.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // Form state
  const oi = orderInfo!;
  const vintageStr = oi.vintage && !oi.wine_name.includes(String(oi.vintage)) ? ` ${oi.vintage}` : '';

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Order info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Bekräfta mottagen beställning</h2>
          <p className="text-sm text-gray-500 mb-4">En kund har beställt via Vinkoll. Bekräfta att ni har mottagit beställningen.</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-center mb-2">
              <div className="text-xs text-amber-700 uppercase tracking-wider font-medium">Referenskod</div>
              <div className="text-lg font-bold text-amber-900 tracking-wider">{oi.reference_code}</div>
            </div>
            <div><span className="text-gray-500">Vin:</span> <strong>{oi.wine_name}{vintageStr}</strong></div>
            <div><span className="text-gray-500">Antal:</span> {oi.quantity} flaskor</div>
            {oi.response_price_sek && <div><span className="text-gray-500">Pris:</span> {oi.response_price_sek} kr/fl</div>}
          </div>
        </div>

        {/* Confirm button */}
        <div className="space-y-3">
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
              {submitError}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Bekräftar...' : 'Bekräfta mottagen beställning'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Genom att klicka bekräftar ni att beställningen har mottagits och kommer att behandlas.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
