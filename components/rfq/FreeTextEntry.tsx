'use client';

import { useState, useEffect } from 'react';
import { Search, Wine, MapPin, Sparkles } from 'lucide-react';

// Wine type chips — matches database enum (wine_color)
const WINE_TYPES = [
  { value: 'all', label: 'Alla typer', dotColor: 'bg-gray-400' },
  { value: 'red', label: 'Rött', dotColor: 'bg-red-600' },
  { value: 'white', label: 'Vitt', dotColor: 'bg-amber-200' },
  { value: 'sparkling', label: 'Mousserande', dotColor: 'bg-amber-400' },
  { value: 'rose', label: 'Rosé', dotColor: 'bg-pink-400' },
  { value: 'orange', label: 'Orange', dotColor: 'bg-orange-500' },
  { value: 'alcohol_free', label: 'Alkoholfritt', dotColor: 'bg-teal-500' },
] as const;

interface FreeTextEntryProps {
  onSubmit: (data: {
    freeText: string;
    wineType: string;
    deliveryCity?: string;
  }) => void;
  isLoading?: boolean;
  defaultDeliveryCity?: string;
}

export function FreeTextEntry({ onSubmit, isLoading, defaultDeliveryCity }: FreeTextEntryProps) {
  const [freeText, setFreeText] = useState('');
  const [wineType, setWineType] = useState('all');
  const [deliveryCity, setDeliveryCity] = useState(defaultDeliveryCity || '');
  const [showDelivery, setShowDelivery] = useState(false);

  // Prefill delivery city from profile
  useEffect(() => {
    if (defaultDeliveryCity) {
      setDeliveryCity(defaultDeliveryCity);
    }
  }, [defaultDeliveryCity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      freeText: freeText.trim(),
      wineType,
      deliveryCity: deliveryCity.trim() || undefined,
    });
  };

  const placeholderText = 'Beskriv vad du söker... t.ex. Italienskt rött till lamm';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Main free-text input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Search className="h-5 w-5" />
        </div>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={placeholderText}
          className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none min-h-[48px]"
          rows={1}
        />
      </div>

      {/* Wine type chips */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Wine className="h-4 w-4" />
          Vintyp
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 sm:overflow-visible sm:flex-wrap sm:mx-0 sm:px-0">
          {WINE_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setWineType(type.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                wineType === type.value
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${type.dotColor}`} />
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery city (optional, collapsible) */}
      <div className="space-y-2">
        {!showDelivery && !deliveryCity ? (
          <button
            type="button"
            onClick={() => setShowDelivery(true)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <MapPin className="h-4 w-4" />
            + Lägg till leveransort
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={deliveryCity}
              onChange={(e) => setDeliveryCity(e.target.value)}
              placeholder="T.ex. Stockholm, Malmö"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
            {deliveryCity && (
              <button
                type="button"
                onClick={() => {
                  setDeliveryCity('');
                  setShowDelivery(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 bg-primary text-white rounded-2xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        {isLoading ? (
          <>
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Söker viner...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Visa förslag
          </>
        )}
      </button>

    </form>
  );
}
