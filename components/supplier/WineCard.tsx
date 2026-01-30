'use client';

/**
 * WINE CARD COMPONENT
 *
 * Kompakt klickbart kort för att visa vininfo.
 * Används på leverantörsdashboard för "Senast tillagda viner".
 */

import { Wine } from 'lucide-react';

export interface SupplierWine {
  id: string;
  name: string;
  producer: string;
  vintage: string | null;
  region: string;
  country: string;
  grape: string;
  color: string;
  price_ex_vat_sek: number;
  stock_qty: number;
  moq: number;
  is_active: boolean;
  created_at?: string;
}

interface WineCardProps {
  wine: SupplierWine;
  onClick: () => void;
}

const colorConfig: Record<string, { label: string; bg: string; text: string }> = {
  red: { label: 'Rött', bg: 'bg-red-100', text: 'text-red-800' },
  white: { label: 'Vitt', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  rose: { label: 'Rosé', bg: 'bg-pink-100', text: 'text-pink-800' },
  sparkling: { label: 'Mousserande', bg: 'bg-amber-100', text: 'text-amber-800' },
  fortified: { label: 'Starkvin', bg: 'bg-purple-100', text: 'text-purple-800' },
  orange: { label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-800' },
};

export function WineCard({ wine, onClick }: WineCardProps) {
  const color = colorConfig[wine.color] || { label: wine.color, bg: 'bg-gray-100', text: 'text-gray-800' };
  const priceFormatted = (wine.price_ex_vat_sek / 100).toLocaleString('sv-SE');

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Wine icon */}
        <div className="p-2 bg-wine/10 rounded-lg flex-shrink-0">
          <Wine className="h-5 w-5 text-wine" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + vintage */}
          <h3 className="font-medium text-gray-900 truncate group-hover:text-wine transition-colors">
            {wine.name}
            {wine.vintage && wine.vintage !== 'NV' && (
              <span className="text-gray-500 ml-1">{wine.vintage}</span>
            )}
          </h3>

          {/* Producer */}
          <p className="text-sm text-gray-500 truncate">{wine.producer}</p>

          {/* Price + color badge */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium text-gray-900">
              {priceFormatted} kr
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
              {color.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
