'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Zap, Crown, Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

interface PricingTier {
  name: string;
  tier: 'free' | 'pro' | 'premium';
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
  buttonVariant: 'outline' | 'primary' | 'premium';
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    tier: 'free',
    price: '0 kr',
    priceNote: '/månad',
    description: 'Kom igång gratis',
    features: [
      'Max 10 viner i sortimentet',
      'Max 5 leads per månad',
      'Max 10 offerter per månad',
      'Grundläggande profil',
      'Self-service support',
    ],
    buttonText: 'Nuvarande plan',
    buttonVariant: 'outline',
  },
  {
    name: 'Pro',
    tier: 'pro',
    price: '990 kr',
    priceNote: '/månad',
    description: 'För aktiva leverantörer',
    features: [
      'Obegränsat antal viner',
      'Obegränsade leads',
      'Obegränsade offerter',
      'Analys & statistik',
      'Utökad profil',
      'Prioriterad sökning',
      'E-post support',
    ],
    highlighted: true,
    buttonText: 'Uppgradera till Pro',
    buttonVariant: 'primary',
  },
  {
    name: 'Premium',
    tier: 'premium',
    price: '2 490 kr',
    priceNote: '/månad',
    description: 'Maximal synlighet',
    features: [
      'Allt i Pro',
      'Konkurrentanalys',
      'Videoprofil',
      'Högsta sökprioritet',
      'Dedikerad support',
      'Beta-funktioner först',
    ],
    buttonText: 'Uppgradera till Premium',
    buttonVariant: 'premium',
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: 'pro' | 'premium') => {
    setLoading(tier);
    setError(null);

    try {
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Ett fel uppstod'));
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Välj rätt plan för din verksamhet
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Börja gratis och uppgradera när du vill. Alla betalningar hanteras säkert via Stripe.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.tier}
              className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${
                tier.highlighted
                  ? 'ring-2 ring-[#7B1E1E] scale-105'
                  : 'border border-gray-200'
              }`}
            >
              {/* Highlighted badge */}
              {tier.highlighted && (
                <div className="absolute top-0 right-0 bg-[#7B1E1E] text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
                  Populärast
                </div>
              )}

              <div className="p-8">
                {/* Tier icon */}
                <div className="mb-4">
                  {tier.tier === 'free' && (
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Check className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                  {tier.tier === 'pro' && (
                    <div className="w-12 h-12 bg-[#7B1E1E]/10 rounded-full flex items-center justify-center">
                      <Zap className="w-6 h-6 text-[#7B1E1E]" />
                    </div>
                  )}
                  {tier.tier === 'premium' && (
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Crown className="w-6 h-6 text-amber-600" />
                    </div>
                  )}
                </div>

                {/* Tier name & price */}
                <h2 className="text-2xl font-bold text-gray-900">{tier.name}</h2>
                <p className="text-gray-500 mb-4">{tier.description}</p>

                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-gray-500 ml-1">{tier.priceNote}</span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => {
                    if (tier.tier !== 'free') {
                      handleUpgrade(tier.tier);
                    }
                  }}
                  disabled={tier.tier === 'free' || loading !== null}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    tier.buttonVariant === 'outline'
                      ? 'border-2 border-gray-300 text-gray-500 cursor-not-allowed'
                      : tier.buttonVariant === 'primary'
                      ? 'bg-[#7B1E1E] text-white hover:bg-[#6B1818] disabled:opacity-50'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 disabled:opacity-50'
                  }`}
                >
                  {loading === tier.tier ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Laddar...
                    </span>
                  ) : (
                    tier.buttonText
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ / Info */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Vanliga frågor
          </h3>
          <div className="max-w-2xl mx-auto text-left space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900">Kan jag byta plan när som helst?</h4>
              <p className="text-gray-600 mt-1">
                Ja! Du kan uppgradera eller nedgradera din plan när som helst. Ändringar träder i kraft omedelbart.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900">Vad händer om jag når min gräns?</h4>
              <p className="text-gray-600 mt-1">
                Du får en notifikation och kan välja att uppgradera för att fortsätta. Dina befintliga data påverkas inte.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900">Hur fungerar betalningen?</h4>
              <p className="text-gray-600 mt-1">
                Vi använder Stripe för säker betalning. Du kan betala med kort och faktureras månadsvis.
              </p>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.back()}
            className="text-[#7B1E1E] hover:underline"
          >
            ← Tillbaka
          </button>
        </div>
      </div>
    </div>
  );
}
