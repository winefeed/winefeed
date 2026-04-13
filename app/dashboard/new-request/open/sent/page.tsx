'use client';

/**
 * Receipt page after a restaurant submits an open broadcast request.
 *
 * The submit endpoint puts the request in PENDING_REVIEW until an admin
 * approves and fans it out to suppliers. The previous redirect went
 * straight to /dashboard/my-requests/[id] which has no PENDING_REVIEW
 * state, so the restaurant got a confusing empty page. This receipt
 * page closes the loop with a clear "we're on it" message.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';

function ReceiptContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get('id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-2" style={{ background: 'linear-gradient(to right, #93092b, #f1b4b0, #93092b)' }} />
          <div className="p-8 sm:p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-5">
              <CheckCircle className="h-9 w-9 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Förfrågan inskickad!
            </h1>
            <p className="text-slate-600 leading-relaxed mb-8">
              Tack — vi har tagit emot din öppna förfrågan och granskar den nu. När den är godkänd skickar vi ut den till alla matchande leverantörer, och du får en bekräftelse via mail. Oftast inom samma dag.
            </p>

            <div className="text-left rounded-xl bg-slate-50 border border-slate-200 p-5 mb-8">
              <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Vad händer nu
              </h2>
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#93092b]/10 text-[#93092b] font-bold text-xs flex items-center justify-center">1</span>
                  <span>Vi granskar förfrågan (oftast inom någon timme på vardagar)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#93092b]/10 text-[#93092b] font-bold text-xs flex items-center justify-center">2</span>
                  <span>Den skickas ut till alla leverantörer med matchande viner i sin katalog</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#93092b]/10 text-[#93092b] font-bold text-xs flex items-center justify-center">3</span>
                  <span>Leverantörerna återkommer med konkreta vinförslag, pris och kvantitet</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#93092b]/10 text-[#93092b] font-bold text-xs flex items-center justify-center">4</span>
                  <span>Du jämför förslagen och accepterar de du gillar</span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/my-requests"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all"
                style={{ background: 'linear-gradient(to right, #93092b, #b41a42)' }}
              >
                Mina förfrågningar <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/new-request/open"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50"
              >
                Skicka en till
              </Link>
            </div>

            {requestId && (
              <p className="mt-6 text-xs text-slate-400">Referens: {requestId.slice(0, 8)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpenRequestSentPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Laddar...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}
