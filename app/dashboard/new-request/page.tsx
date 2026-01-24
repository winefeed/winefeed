'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RequestForm } from '@/components/request-form';
import { ChevronDown, ChevronUp, Globe2, TrendingUp, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NewRequestPage() {
  const router = useRouter();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleSuccess = (requestId: string) => {
    router.push(`/dashboard/results/${requestId}`);
  };

  const handleOpenMenu = () => {
    window.dispatchEvent(new Event('openMobileMenu'));
  };

  // Hide global hamburger menu on this page
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'hide-global-hamburger';
    style.textContent = `
      .fixed.top-4.left-4.z-50[aria-label="Open menu"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById('hide-global-hamburger');
      if (existingStyle) {
        existingStyle.remove();
      }
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
              Beställ vinoffert på 30 sekunder
            </h1>

            {/* Tagline */}
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-2">
              Winefeed ger dig marknadsgenomgång för smartare vinköp
            </p>

            <p className="text-sm sm:text-base text-white/75 max-w-xl mx-auto">
              Jämför priser från flera leverantörer automatiskt
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12 pb-12">
        {/* Form Card - Premium Glassmorphism */}
        <div className="relative group">
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 rounded-3xl opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500" style={{ background: 'linear-gradient(to right, #93092b, #f1b4b0)' }} />

          {/* Main Card */}
          <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
            {/* Subtle gradient header */}
            <div className="h-2" style={{ background: 'linear-gradient(to right, #93092b, #f1b4b0, #93092b)' }} />

            <div className="p-6 sm:p-8 lg:p-10">
              <RequestForm onSuccess={handleSuccess} />
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
                  Vi hanterar all regelefterlevnad.
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
                  Winefeed genomsöker marknaden och ger dig bästa möjliga priser
                  från verifierade leverantörer.
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
                      <div className="text-3xl mb-3">📝</div>
                      <h4 className="font-semibold text-gray-900 mb-2">Beskriv behov</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Fyll i vilka viner du söker, budget och antal flaskor
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 hover:shadow-md transition-all duration-300">
                      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                        2
                      </div>
                      <div className="text-3xl mb-3">🔍</div>
                      <h4 className="font-semibold text-gray-900 mb-2">Winefeed genomsöker</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Matchar automatiskt mot tillgängliga viner från leverantörer
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 hover:shadow-md transition-all duration-300">
                      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, #93092b, #b41a42)' }}>
                        3
                      </div>
                      <div className="text-3xl mb-3">💰</div>
                      <h4 className="font-semibold text-gray-900 mb-2">Jämför & välj</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Få tydlig prisöversikt och offert av leverantörer direkt
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
