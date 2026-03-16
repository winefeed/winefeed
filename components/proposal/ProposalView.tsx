'use client';

/**
 * PROPOSAL VIEW - Public wine proposal display
 *
 * Shows matched wines for a restaurant with interest toggle + contact form.
 * Winefeed branding. No prices shown.
 */

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Wine, Leaf, Sparkles, Check, Send, ChevronDown, Truck } from 'lucide-react';
import type { ProposalData, ProposalWine } from '@/app/vinforslag/[id]/page';

interface ProposalViewProps {
  proposal: ProposalData;
  sig: string;
}

const COLOR_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  fortified: 'Starkvin',
  orange: 'Orange',
  spirit: 'Sprit',
};

const COLOR_STYLES: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  white: 'bg-yellow-100 text-yellow-700',
  rose: 'bg-pink-100 text-pink-700',
  sparkling: 'bg-blue-100 text-blue-700',
  fortified: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  spirit: 'bg-violet-100 text-violet-700',
};

function getDeliveryLabel(type: string): string {
  switch (type) {
    case 'SWEDISH_IMPORTER':
      return 'Leverans från Sverige';
    case 'EU_PRODUCER':
    case 'EU_IMPORTER':
      return 'Import från EU';
    default:
      return '';
  }
}

export default function ProposalView({ proposal, sig }: ProposalViewProps) {
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const supplierCount = new Set(proposal.wines.map((w) => w.supplier_name)).size;

  function toggleInterest(wineId: string) {
    setInterestedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wineId)) {
        next.delete(wineId);
      } else {
        next.add(wineId);
      }
      return next;
    });
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (!contactName.trim() || !contactEmail.trim()) {
      setSubmitError('Namn och e-post krävs.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/vinforslag/${proposal.id}/respond?s=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim().toLowerCase(),
          message: contactMessage.trim() || null,
          interested_wine_ids: Array.from(interestedIds),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Något gick fel');
      }

      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Kunde inte skicka. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#722F37] to-[#8B3A42]">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 leading-tight">
                Vinförslag till {proposal.restaurant_name}
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">
                {proposal.wines.length} viner från {supplierCount} leverantör
                {supplierCount !== 1 ? 'er' : ''}
              </p>
            </div>
            <Image
              src="/winefeed-logo-white.svg"
              alt="Winefeed"
              width={240}
              height={51}
              className="w-[100px] sm:w-[240px] h-auto flex-shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Optional message */}
      {proposal.message && (
        <div className="max-w-6xl mx-auto px-4 pt-4 sm:pt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
            <p className="text-sm text-gray-700 whitespace-pre-line">{proposal.message}</p>
          </div>
        </div>
      )}

      {/* Wine Grid */}
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 pb-6 sm:pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposal.wines.map((wine) => (
            <WineCard
              key={wine.id}
              wine={wine}
              interested={interestedIds.has(wine.id)}
              expanded={expandedDescs.has(wine.id)}
              onToggleInterest={() => toggleInterest(wine.id)}
              onToggleExpand={() =>
                setExpandedDescs((prev) => {
                  const next = new Set(prev);
                  next.has(wine.id) ? next.delete(wine.id) : next.add(wine.id);
                  return next;
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <div ref={formRef} className="max-w-2xl mx-auto px-4 pb-24 sm:pb-12">
        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-5 sm:p-6 text-center">
            <Check className="h-8 w-8 text-green-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800 mb-1">Tack för ditt intresse!</h3>
            <p className="text-sm text-green-700">
              Vi återkommer med mer information om de viner du markerat.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Intresserad?</h2>
            <p className="text-sm text-gray-600 mb-4 sm:mb-5">
              Markera viner ovan och fyll i formuläret så kontaktar vi dig.
              {interestedIds.size > 0 && (
                <span className="font-medium text-[#722F37]">
                  {' '}
                  {interestedIds.size} vin{interestedIds.size !== 1 ? 'er' : ''} markerade.
                </span>
              )}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Namn *
                </label>
                <input
                  id="name"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ditt namn"
                  autoComplete="name"
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 focus:border-[#722F37]"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-post *
                </label>
                <input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="din@restaurang.se"
                  autoComplete="email"
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 focus:border-[#722F37]"
                  required
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Meddelande
                </label>
                <textarea
                  id="message"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="T.ex. önskemål, frågor, eller hur stor volym ni tänker er..."
                  rows={3}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 focus:border-[#722F37] resize-none"
                />
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#722F37] text-white rounded-lg font-medium hover:bg-[#8B3A42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {submitting ? (
                  'Skickar...'
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Skicka intresseanmälan
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sticky CTA Bar */}
      {!submitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 py-3 z-10" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600 hidden sm:block">
              {interestedIds.size > 0
                ? `${interestedIds.size} vin${interestedIds.size !== 1 ? 'er' : ''} markerade`
                : 'Markera viner du gillar och skicka en intresseanmälan'}
            </p>
            <button
              onClick={scrollToForm}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-[#722F37] text-white rounded-lg font-medium hover:bg-[#8B3A42] transition-colors text-sm whitespace-nowrap sm:ml-auto"
            >
              <ChevronDown className="h-4 w-4" />
              Skicka intresse
              {interestedIds.size > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {interestedIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Powered by */}
      <div className="py-4 flex items-center justify-center gap-1.5">
        <span className="text-xs text-gray-400">Powered by</span>
        <a
          href="https://winefeed.se"
          className="opacity-50 hover:opacity-80 transition-opacity"
        >
          <Image src="/winefeed-logo-light.svg" alt="Winefeed" width={80} height={20} />
        </a>
      </div>
    </div>
  );
}

// ─── Wine Card ────────────────────────────────────────────────

interface WineCardProps {
  wine: ProposalWine;
  interested: boolean;
  expanded: boolean;
  onToggleInterest: () => void;
  onToggleExpand: () => void;
}

function WineCard({ wine, interested, expanded, onToggleInterest, onToggleExpand }: WineCardProps) {
  const deliveryLabel = getDeliveryLabel(wine.supplier_type);

  return (
    <div
      className={`bg-white rounded-lg border p-4 sm:p-5 transition-colors flex flex-col ${
        interested ? 'border-[#722F37] ring-1 ring-[#722F37]/20' : 'border-gray-200'
      }`}
    >
      {/* Color badge */}
      {wine.color && (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${
            COLOR_STYLES[wine.color] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {COLOR_LABELS[wine.color] || wine.color}
        </span>
      )}

      {/* Wine name + vintage */}
      <h3 className="font-semibold text-gray-900 mb-1">
        {wine.name}
        {!!wine.vintage && !wine.name.includes(String(wine.vintage)) && (
          <span className="text-gray-500 font-normal ml-1">{wine.vintage}</span>
        )}
      </h3>

      {/* Producer */}
      <p className="text-sm text-gray-600 mb-2">{wine.producer}</p>

      {/* Region + Country */}
      <p className="text-sm text-gray-500 mb-3">
        {[wine.region, wine.country].filter(Boolean).join(', ')}
        {wine.appellation && (
          <span className="block text-xs text-gray-400 mt-0.5">{wine.appellation}</span>
        )}
      </p>

      {/* Grape */}
      {wine.grape && (
        <p className="text-xs text-gray-500 mb-2">
          <span className="font-medium">Druva:</span> {wine.grape}
        </p>
      )}

      {/* Alcohol + Bottle Size */}
      <div className="flex gap-3 text-xs text-gray-400 mb-3">
        {!!wine.alcohol_pct && <span>{wine.alcohol_pct}%</span>}
        {!!wine.bottle_size_ml && <span>{wine.bottle_size_ml} ml</span>}
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap mb-3">
        {wine.organic && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
            <Leaf className="h-3 w-3" />
            Ekologisk
          </span>
        )}
        {wine.biodynamic && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">
            <Sparkles className="h-3 w-3" />
            Biodynamisk
          </span>
        )}
      </div>

      {/* Delivery info */}
      {deliveryLabel && (
        <p className="inline-flex items-center gap-1 text-xs text-gray-500 mb-3">
          <Truck className="h-3 w-3" />
          {deliveryLabel}
          {wine.supplier_type !== 'SWEDISH_IMPORTER' && wine.supplier_name && (
            <span> via {wine.supplier_name}</span>
          )}
        </p>
      )}

      {/* Description (expandable) */}
      {wine.description && (
        <div className="mb-3">
          <p className={`text-sm text-gray-600 ${expanded ? '' : 'line-clamp-3'}`}>
            {wine.description}
          </p>
          {wine.description.length > 150 && (
            <button
              onClick={onToggleExpand}
              className="text-xs text-[#722F37] hover:underline mt-1"
            >
              {expanded ? 'Visa mindre' : 'Läs mer'}
            </button>
          )}
        </div>
      )}

      {/* Reason (why this wine was matched) */}
      {wine.reason && (
        <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-gray-200 pl-2">
          {wine.reason}
        </p>
      )}

      {/* Interest toggle */}
      <button
        onClick={onToggleInterest}
        className={`w-full mt-auto pt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors active:scale-[0.98] ${
          interested
            ? 'bg-[#722F37] text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {interested ? (
          <>
            <Check className="h-4 w-4" />
            Intresserad
          </>
        ) : (
          'Markera intresse'
        )}
      </button>
    </div>
  );
}
