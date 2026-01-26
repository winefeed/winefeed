'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, FileText, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface ExpiringOffer {
  id: string;
  title: string;
  restaurant_name: string;
  expires_at: string;
  days_left: number;
  total_value?: number;
}

export function ExpiringOffersAlert() {
  const [offers, setOffers] = useState<ExpiringOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchExpiringOffers() {
      try {
        const res = await fetch('/api/supplier/expiring-offers');
        if (res.ok) {
          const data = await res.json();
          setOffers(data.offers || []);
        }
      } catch (error) {
        console.error('Failed to fetch expiring offers:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchExpiringOffers();
  }, []);

  if (loading || offers.length === 0) {
    return null;
  }

  const criticalOffers = offers.filter(o => o.days_left <= 2);
  const warningOffers = offers.filter(o => o.days_left > 2);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-100/50 transition-colors"
      >
        <div className="p-2 bg-amber-100 rounded-lg">
          <Clock className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-medium text-amber-800">
            {offers.length} {offers.length === 1 ? 'offert' : 'offerter'} löper ut snart
          </h3>
          <p className="text-sm text-amber-600">
            {criticalOffers.length > 0 && (
              <span className="text-red-600 font-medium">
                {criticalOffers.length} inom 2 dagar
              </span>
            )}
            {criticalOffers.length > 0 && warningOffers.length > 0 && ' • '}
            {warningOffers.length > 0 && `${warningOffers.length} inom 7 dagar`}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-amber-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-amber-600" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-amber-200">
          <div className="space-y-2 mt-3">
            {/* Critical first */}
            {criticalOffers.map((offer) => (
              <a
                key={offer.id}
                href={`/supplier/offers?id=${offer.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors border border-red-200"
              >
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-red-800 truncate">
                    {offer.title || 'Offert'} - {offer.restaurant_name}
                  </p>
                  <p className="text-sm text-red-600">
                    Löper ut {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true, locale: sv })}
                  </p>
                </div>
                <span className="text-sm font-bold text-red-600 flex-shrink-0">
                  {offer.days_left === 0 ? 'Idag!' : offer.days_left === 1 ? 'Imorgon' : `${offer.days_left} dagar`}
                </span>
              </a>
            ))}

            {/* Warning */}
            {warningOffers.map((offer) => (
              <a
                key={offer.id}
                href={`/supplier/offers?id=${offer.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-100/50 hover:bg-amber-100 transition-colors"
              >
                <FileText className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 truncate">
                    {offer.title || 'Offert'} - {offer.restaurant_name}
                  </p>
                  <p className="text-sm text-amber-600">
                    Löper ut {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true, locale: sv })}
                  </p>
                </div>
                <span className="text-sm font-medium text-amber-600 flex-shrink-0">
                  {offer.days_left} dagar
                </span>
              </a>
            ))}
          </div>

          <a
            href="/supplier/offers?filter=expiring"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Hantera offerter
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
