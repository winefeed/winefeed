'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FreeTextEntry } from '@/components/rfq/FreeTextEntry';
import { ChevronDown, ChevronUp, Globe2, Megaphone, Menu } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function NewRequestPage() {
  const router = useRouter();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultDeliveryCity, setDefaultDeliveryCity] = useState('');
  const [catalogStats, setCatalogStats] = useState<{ total: number; directImport: number } | null>(null);

  // Fetch catalog stats (cached 1h)
  useEffect(() => {
    fetch('/api/catalog/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.total > 0) {
          setCatalogStats({ total: data.total, directImport: data.directImport });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch user's default delivery city from profile
  useEffect(() => {
    async function fetchDefaultCity() {
      try {
        const res = await fetch('/api/me/restaurant');
        if (res.ok) {
          const data = await res.json();
          if (data.city) {
            setDefaultDeliveryCity(data.city);
          }
        }
      } catch (err) {
        // Silently fail
      }
    }
    fetchDefaultCity();
  }, []);

  const handleOpenMenu = () => {
    window.dispatchEvent(new Event('openMobileMenu'));
  };

  // Detect if text contains specific order details (quantity, price, city)
  const looksLikeQuickOrder = (text: string): boolean => {
    if (!text) return false;
    const hasNumber = /\d+\s*(fl|flaskor|st|kartong)/i.test(text);
    const hasPrice = /\d+\s*(kr|sek|kronor)|under\s+\d+/i.test(text);
    return hasNumber || hasPrice;
  };

  const handleSubmit = async (data: { freeText: string; wineType: string; deliveryCity?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Smart routing: if text contains quantities/prices, use quick-order API for parsing
      if (looksLikeQuickOrder(data.freeText)) {
        const response = await fetch('/api/quick-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.freeText }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Något gick fel');
        }

        const result = await response.json();

        sessionStorage.setItem('latest-suggestions', JSON.stringify(result.suggestions));
        if (result.relaxed_message) {
          sessionStorage.setItem('latest-relaxed-message', result.relaxed_message);
        } else {
          sessionStorage.removeItem('latest-relaxed-message');
        }
        sessionStorage.setItem('rfq-draft', JSON.stringify({
          freeText: data.freeText,
          wineType: result.parsed?.wine_type || data.wineType,
          deliveryCity: result.parsed?.delivery_city || data.deliveryCity,
          budget: result.parsed?.budget_max || null,
          quantity: result.parsed?.quantity || null,
        }));

        if (result.preview_mode) {
        sessionStorage.setItem('preview-mode', '1');
      } else {
        sessionStorage.removeItem('preview-mode');
      }
      router.push(`/dashboard/results/${result.request_id}`);
        return;
      }

      // Standard search flow
      const requestData = {
        description: data.freeText || undefined,
        fritext: data.freeText || undefined,
        color: data.wineType !== 'all' ? data.wineType : undefined,
        leverans_ort: data.deliveryCity || undefined,
      };

      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Något gick fel');
      }

      const result = await response.json();

      sessionStorage.setItem('rfq-draft', JSON.stringify({
        freeText: data.freeText,
        wineType: data.wineType,
        deliveryCity: data.deliveryCity,
        budget: null,
        quantity: null,
      }));

      sessionStorage.setItem('latest-suggestions', JSON.stringify(result.suggestions));
      if (result.relaxed_message) {
        sessionStorage.setItem('latest-relaxed-message', result.relaxed_message);
      } else {
        sessionStorage.removeItem('latest-relaxed-message');
      }
      sessionStorage.setItem('latest-search-params', JSON.stringify({
        freeText: data.freeText,
        color: data.wineType,
        deliveryCity: data.deliveryCity,
      }));

      if (result.preview_mode) {
        sessionStorage.setItem('preview-mode', '1');
      } else {
        sessionStorage.removeItem('preview-mode');
      }
      router.push(`/dashboard/results/${result.request_id}`);
    } catch (err: any) {
      console.error('Error fetching suggestions:', err);
      setError(err.message || 'Något gick fel. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  };

  // Hide global hamburger menu on this page (this page has its own menu button)
  useEffect(() => {
    document.documentElement.setAttribute('data-hide-global-menu', 'true');
    return () => {
      document.documentElement.removeAttribute('data-hide-global-menu');
    };
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      {/* Hero Header with Gradient */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42, #93092b)' }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />

        {/* Glassmorphism Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
          {/* Mobile Menu Button - Integrated in header */}
          <button
            onClick={handleOpenMenu}
            className="absolute top-4 left-4 lg:hidden p-2.5 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors z-[60] shadow-lg"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          <div className="text-center">
            {/* Icon Badge */}
            <div className="hidden sm:inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 ring-1 ring-white/30 shadow-lg">
              <span className="text-3xl sm:text-4xl">🍷</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Hitta rätt vin
            </h1>

            {/* Tagline */}
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">
              Beskriv vad du söker så hittar vi matchande viner
            </p>

            {/* Catalog stats — builds trust by showing catalog size */}
            {catalogStats && (
              <p className="mt-3 text-sm text-white/70">
                Vi söker i <strong className="text-white">{catalogStats.total.toLocaleString('sv-SE')}</strong> viner just nu
                {catalogStats.directImport > 0 && (
                  <> — varav {catalogStats.directImport.toLocaleString('sv-SE')} från direktimport</>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Wave Divider — hidden on mobile for tighter layout */}
        <div className="relative hidden sm:block h-8">
          <svg className="absolute bottom-0 w-full h-8" preserveAspectRatio="none" viewBox="0 0 1440 54">
            <path fill="white" d="M0,32L120,37.3C240,43,480,53,720,48C960,43,1200,21,1320,10.7L1440,0L1440,54L1320,54C1200,54,960,54,720,54C480,54,240,54,120,54L0,54Z"></path>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-8 pb-12">
        {/* Form Card */}
        <div className="relative">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
            {/* Subtle gradient header */}
            <div className="h-2" style={{ background: 'linear-gradient(to right, #93092b, #f1b4b0, #93092b)' }} />

            <div className="p-6 sm:p-8">
              <FreeTextEntry
                onSubmit={handleSubmit}
                isLoading={isLoading}
                defaultDeliveryCity={defaultDeliveryCity}
              />

              {error && (
                <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Cards Grid — hidden on mobile */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-4 sm:gap-6 mt-8">
          {/* EU Wine Card */}
          <div className="group relative overflow-hidden rounded-2xl border p-5 sm:p-6 hover:shadow-lg transition-all duration-300 touch-manipulation" style={{ background: 'linear-gradient(to bottom right, #fef5f5, #fff9f9)', borderColor: '#f1b4b0' }}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                <Globe2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1 text-base sm:text-lg">
                  Direktleverans från EU
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Beställ direkt från franska, italienska och spanska producenter.
                </p>
              </div>
            </div>
          </div>

          {/* Broadcast / Open Request Card */}
          <Link
            href="/dashboard/new-request/open"
            className="group relative overflow-hidden rounded-2xl border p-5 sm:p-6 hover:shadow-lg transition-all duration-300 touch-manipulation block"
            style={{ background: 'linear-gradient(to bottom right, #fffbf5, #fffef9)', borderColor: '#f2e2b6' }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                <Megaphone className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1 text-base sm:text-lg">
                  Sök hos flera importörer
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Beskriv en kategori — t.ex. Chablis under 200 kr — och låt leverantörer tävla om affären.
                </p>
                <span className="inline-block mt-2 text-xs font-medium" style={{ color: '#93092b' }}>
                  Öppen förfrågan →
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* How It Works - Condensed on mobile, collapsible on desktop */}
        <div className="mt-6 sm:mt-8">
          {/* Mobile: always-visible condensed version */}
          <div className="sm:hidden bg-white rounded-2xl shadow-sm border border-gray-200/60 p-4">
            <h3 className="font-semibold text-gray-900 text-base mb-3 text-center">Så fungerar det</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>1</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Beskriv fritt</p>
                  <p className="text-xs text-gray-600">Skriv vad du söker med egna ord</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>2</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Se förslag</p>
                  <p className="text-xs text-gray-600">Få matchande viner direkt</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>3</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Skicka förfrågan</p>
                  <p className="text-xs text-gray-600">Välj viner och skicka för offert</p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: collapsible detailed version */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-shadow duration-300">
              <button
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="w-full flex items-center justify-center p-5 sm:p-6 hover:bg-gray-50/50 transition-colors touch-manipulation min-h-[60px] relative"
              >
                <span className="font-semibold text-gray-900 text-base sm:text-lg">
                  Så fungerar det
                </span>
                <div className="absolute right-5">
                  {showHowItWorks ? (
                    <ChevronUp className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500" />
                  )}
                </div>
              </button>

              <div
                className={cn(
                  'grid transition-all duration-300 ease-in-out',
                  showHowItWorks
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                )}
              >
                <div className="overflow-hidden">
                  <div className="p-5 sm:p-6 pt-0 border-t border-gray-100">
                    <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                      {/* Step 1 */}
                      <div className="relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 hover:shadow-md transition-all duration-300">
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                          1
                        </div>
                        <div className="text-3xl mb-3">💬</div>
                        <h4 className="font-semibold text-gray-900 mb-2">Beskriv fritt</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Skriv vad du söker med egna ord - &quot;italienskt till lamm&quot;
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div className="relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 hover:shadow-md transition-all duration-300">
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                          2
                        </div>
                        <div className="text-3xl mb-3">🔍</div>
                        <h4 className="font-semibold text-gray-900 mb-2">Se förslag</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Få matchande viner direkt - förfina med budget och antal
                        </p>
                      </div>

                      {/* Step 3 */}
                      <div className="relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 hover:shadow-md transition-all duration-300">
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                          3
                        </div>
                        <div className="text-3xl mb-3">📨</div>
                        <h4 className="font-semibold text-gray-900 mb-2">Skicka förfrågan</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Välj viner och skicka till leverantörer för offert
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
