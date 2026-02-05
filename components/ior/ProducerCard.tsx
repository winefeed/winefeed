/**
 * PRODUCER CARD
 *
 * Netflix-style card for displaying a producer in the dashboard carousel.
 * Shows logo, name, country, and badge counts.
 */

'use client';

import Link from 'next/link';
import { Wine, MessageSquare, AlertTriangle, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProducerCardProps {
  id: string;
  name: string;
  country: string;
  region?: string;
  logoUrl?: string;
  productCount?: number;
  openCasesCount?: number;
  overdueCasesCount?: number;
  isActive?: boolean;
  lastActivityAt?: string;
}

// Country flag emoji mapping (common wine countries)
const countryFlags: Record<string, string> = {
  France: '🇫🇷',
  Italy: '🇮🇹',
  Spain: '🇪🇸',
  Germany: '🇩🇪',
  Portugal: '🇵🇹',
  Argentina: '🇦🇷',
  Chile: '🇨🇱',
  Australia: '🇦🇺',
  'New Zealand': '🇳🇿',
  'South Africa': '🇿🇦',
  USA: '🇺🇸',
  Austria: '🇦🇹',
  Greece: '🇬🇷',
  Hungary: '🇭🇺',
  Slovenia: '🇸🇮',
  Croatia: '🇭🇷',
};

export function ProducerCard({
  id,
  name,
  country,
  region,
  logoUrl,
  productCount = 0,
  openCasesCount = 0,
  overdueCasesCount = 0,
  isActive = true,
  lastActivityAt,
}: ProducerCardProps) {
  const hasOverdue = overdueCasesCount > 0;
  const flag = countryFlags[country] || '🍷';

  return (
    <Link
      href={`/ior/producers/${id}`}
      className={cn(
        'block bg-white border rounded-lg overflow-hidden transition-all',
        'hover:shadow-md hover:border-wine/30',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2',
        !isActive && 'opacity-60'
      )}
    >
      {/* Logo/Header area */}
      <div className="h-24 bg-gradient-to-br from-wine/5 to-wine/10 flex items-center justify-center relative">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className="h-16 w-auto object-contain"
          />
        ) : (
          <div className="text-4xl">{flag}</div>
        )}

        {/* Overdue indicator */}
        {hasOverdue && (
          <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {overdueCasesCount}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 truncate" title={name}>
          {name}
        </h3>

        <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {region ? `${region}, ${country}` : country}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-3 mt-3 text-xs">
          <span className="flex items-center gap-1 text-gray-600">
            <Wine className="h-3.5 w-3.5" />
            <span>{productCount}</span>
          </span>

          <span className={cn(
            'flex items-center gap-1',
            openCasesCount > 0
              ? hasOverdue ? 'text-red-600' : 'text-amber-600'
              : 'text-gray-400'
          )}>
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{openCasesCount}</span>
          </span>

          {hasOverdue && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{overdueCasesCount}</span>
            </span>
          )}
        </div>

        {/* Last activity */}
        {lastActivityAt && (
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(lastActivityAt), {
                addSuffix: true,
                locale: sv,
              })}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
