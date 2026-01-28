'use client';

/**
 * Wine Offer Card Component
 *
 * Displays a wine offer with MOQ handling.
 * Shows wine details, price, and MOQ warning if applicable.
 */

import { useState } from 'react';
import { MoqWarning, MoqWarningCompact } from './MoqWarning';

export interface WineOffer {
  id: string;
  wine: {
    id: string;
    name: string;
    producer: string;
    region: string;
    vintage: string | null;
    grape: string;
    color: 'red' | 'white' | 'rose' | 'sparkling' | 'fortified' | 'orange';
    organic?: boolean;
    biodynamic?: boolean;
  };
  supplier: {
    id: string;
    name: string;
    type?: 'swedish_importer' | 'eu_producer' | 'eu_importer';
  };
  pricePerBottle: number;  // SEK
  moq: number;
  caseSize: number;
  requestedQuantity: number;
  adjustedQuantity?: number;
}

export interface WineOfferCardProps {
  offer: WineOffer;
  requestId: string;
  onAdjustQuantity?: (wineId: string, newQuantity: number) => Promise<void>;
  onSelect?: (offerId: string) => void;
  selected?: boolean;
  showActions?: boolean;
}

// Color labels in Swedish
const colorLabels: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  fortified: 'Starkvin',
  orange: 'Orange',
};

// Color badge styles
const colorStyles: Record<string, string> = {
  red: 'bg-red-100 text-red-800',
  white: 'bg-yellow-50 text-yellow-800',
  rose: 'bg-pink-100 text-pink-800',
  sparkling: 'bg-amber-100 text-amber-800',
  fortified: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export function WineOfferCard({
  offer,
  requestId,
  onAdjustQuantity,
  onSelect,
  selected = false,
  showActions = true,
}: WineOfferCardProps) {
  const [isAdjusting, setIsAdjusting] = useState(false);

  const { wine, supplier, pricePerBottle, moq, requestedQuantity, adjustedQuantity } = offer;
  const currentQuantity = adjustedQuantity || requestedQuantity;
  const meetsmoq = currentQuantity >= moq;

  const handleAdjust = async (newQuantity: number) => {
    if (!onAdjustQuantity) return;

    setIsAdjusting(true);
    try {
      await onAdjustQuantity(wine.id, newQuantity);
    } finally {
      setIsAdjusting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const totalPrice = pricePerBottle * currentQuantity;

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header: Wine name and badges */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {wine.name}
            {wine.vintage && wine.vintage !== 'NV' && (
              <span className="ml-2 text-gray-500">{wine.vintage}</span>
            )}
            {wine.vintage === 'NV' && (
              <span className="ml-2 text-sm text-gray-400">NV</span>
            )}
          </h3>

          {/* Producer and region */}
          <p className="mt-1 text-sm text-gray-600">
            {wine.producer} · {wine.region}
          </p>

          {/* Grape varieties */}
          <p className="mt-1 text-sm text-gray-500">{wine.grape}</p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              colorStyles[wine.color] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {colorLabels[wine.color] || wine.color}
          </span>
          {wine.organic && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Eko
            </span>
          )}
          {wine.biodynamic && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Biodynamisk
            </span>
          )}
        </div>
      </div>

      {/* Supplier info */}
      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
        <span>Leverantör:</span>
        <span className="font-medium text-gray-700">{supplier.name}</span>
        {supplier.type === 'eu_producer' && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
            EU-producent
          </span>
        )}
      </div>

      {/* Divider */}
      <hr className="my-4 border-gray-100" />

      {/* Pricing and quantity */}
      <div className="grid grid-cols-2 gap-4">
        {/* Price per bottle */}
        <div>
          <p className="text-sm text-gray-500">Pris per flaska</p>
          <p className="text-xl font-bold text-gray-900">{formatPrice(pricePerBottle)}</p>
        </div>

        {/* Quantity */}
        <div>
          <p className="text-sm text-gray-500">
            Antal
            {!meetsmoq && <MoqWarningCompact requestedQuantity={currentQuantity} moq={moq} />}
          </p>
          <p className="text-xl font-bold text-gray-900">
            {currentQuantity} st
            {adjustedQuantity && adjustedQuantity !== requestedQuantity && (
              <span className="ml-2 text-sm font-normal text-gray-400 line-through">
                ({requestedQuantity})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Total price */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-gray-600">Totalt</span>
        <span className="text-lg font-bold text-gray-900">{formatPrice(totalPrice)}</span>
      </div>

      {/* MOQ Warning */}
      {!meetsmoq && showActions && (
        <div className="mt-4">
          <MoqWarning
            requestedQuantity={currentQuantity}
            moq={moq}
            onAdjust={onAdjustQuantity ? handleAdjust : undefined}
            disabled={isAdjusting}
          />
        </div>
      )}

      {/* Actions */}
      {showActions && onSelect && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => onSelect(offer.id)}
            disabled={!meetsmoq}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              meetsmoq
                ? selected
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'cursor-not-allowed bg-gray-100 text-gray-400'
            }`}
          >
            {selected ? 'Vald' : 'Välj denna offert'}
          </button>
        </div>
      )}

      {/* MOQ info footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>
          Min. order: {moq} flaskor · {offer.caseSize} fl/kartong
        </span>
        {meetsmoq && (
          <span className="text-green-600">
            <svg className="mr-1 inline h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Minsta order OK
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact wine card for list views
 */
export function WineOfferCardCompact({
  offer,
  showMoqWarning = true,
}: {
  offer: WineOffer;
  showMoqWarning?: boolean;
}) {
  const { wine, supplier, pricePerBottle, moq, requestedQuantity, adjustedQuantity } = offer;
  const currentQuantity = adjustedQuantity || requestedQuantity;
  const meetsmoq = currentQuantity >= moq;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex-1">
        <p className="font-medium text-gray-900">
          {wine.name} {wine.vintage && wine.vintage !== 'NV' ? wine.vintage : ''}
        </p>
        <p className="text-sm text-gray-500">
          {wine.producer} · {supplier.name}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {showMoqWarning && !meetsmoq && (
          <MoqWarningCompact requestedQuantity={currentQuantity} moq={moq} />
        )}
        <div className="text-right">
          <p className="font-semibold text-gray-900">
            {new Intl.NumberFormat('sv-SE').format(pricePerBottle)} kr
          </p>
          <p className="text-sm text-gray-500">{currentQuantity} st</p>
        </div>
      </div>
    </div>
  );
}
