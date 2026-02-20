'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FreeTextEntry } from '@/components/rfq/FreeTextEntry';
import { ChevronDown, ChevronUp, Globe2, TrendingUp, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NewRequestPage() {
  const router = useRouter();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultDeliveryCity, setDefaultDeliveryCity] = useState('');

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

  const handleSubmit = async (data: { freeText: string; wineType: string; deliveryCity?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Build request for suggestions API
      // Note: We don't require budget/quantity here - just get initial suggestions
      const requestData = {
        description: data.freeText || undefined,
        fritext: data.freeText || undefined,
        color: data.wineType !== 'all' ? data.wineType : undefined,
        leverans_ort: data.deliveryCity || undefined,
        // Set reasonable defaults for initial search (these can be refined later)
        budget_max: 500, // Default max to get a broad range
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

      // Store the draft data for the results page
      sessionStorage.setItem('rfq-draft', JSON.stringify({
        freeText: data.freeText,
        wineType: data.wineType,
        deliveryCity: data.deliveryCity,
        budget: null, // Will be set on results page
        quantity: null, // Will be set on results page
      }));

      // Store suggestions for display
      sessionStorage.setItem('latest-suggestions', JSON.stringify(result.suggestions));
      sessionStorage.setItem('latest-search-params', JSON.stringify({
        freeText: data.freeText,
        color: data.wineType,
        deliveryCity: data.deliveryCity,
      }));

      // Navigate to results
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

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
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
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 ring-1 ring-white/30 shadow-lg">
              <span className="text-3xl sm:text-4xl">🍷</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Hitta rätt vin
            </h1>

            {/* Tagline */}
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">
              Beskriv vad du söker så hittar vi matchande viner
            </p>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="relative h-8 sm:h-12">
          <svg className="absolute bottom-0 w-full h-8 sm:h-12" preserveAspectRatio="none" viewBox="0 0 1440 54">
            <path fill="white" d="M0,32L120,37.3C240,43,480,53,720,48C960,43,1200,21,1320,10.7L1440,0L1440,54L1320,54C1200,54,960,54,720,54C480,54,240,54,120,54L0,54Z"></path>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12 pb-12">
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

        {/* Feature Cards Grid */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mt-8">
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

          {/* Smart Matching Card */}
          <div className="group relative overflow-hidden rounded-2xl border p-5 sm:p-6 hover:shadow-lg transition-all duration-300 touch-manipulation" style={{ background: 'linear-gradient(to bottom right, #fffbf5, #fffef9)', borderColor: '#f2e2b6' }}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1 text-base sm:text-lg">
                  Smart prisöversikt
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Jämför priser från flera leverantörer automatiskt.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works - Modern Collapsible */}
        <div className="mt-8">
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
  );
}
