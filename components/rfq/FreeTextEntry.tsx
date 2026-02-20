'use client';

import { useState, useEffect } from 'react';
import { Search, Wine, MapPin, Sparkles } from 'lucide-react';

// Wine type chips — matches database enum (wine_color)
const WINE_TYPES = [
  { value: 'all', label: 'Alla typer', emoji: '🍇' },
  { value: 'red', label: 'Rött', emoji: '🍷' },
  { value: 'white', label: 'Vitt', emoji: '🥂' },
  { value: 'sparkling', label: 'Mousserande', emoji: '🍾' },
  { value: 'rose', label: 'Rosé', emoji: '🌸' },
  { value: 'orange', label: 'Orange', emoji: '🍊' },
  { value: 'alcohol_free', label: 'Alkoholfritt', emoji: '🫧' },
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

  const placeholderExamples = [
    'Italienskt rött till lammkött',
    'Champagne för nyårsfest',
    'Eleganta vita viner under 200kr',
    'Naturvin från Frankrike',
    'Alkoholfritt vin till dessert',
  ];

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderExamples.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
          placeholder={`Beskriv vad du söker... t.ex. "${placeholderExamples[placeholderIndex]}"`}
          className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none min-h-[100px]"
          rows={3}
        />
        {freeText && (
          <div className="absolute right-3 bottom-3">
            <span className="text-xs text-gray-400">{freeText.length} tecken</span>
          </div>
        )}
      </div>

      {/* Wine type chips */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Wine className="h-4 w-4" />
          Vintyp (valfritt)
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
              <span className="mr-1">{type.emoji}</span>
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

      {/* Helper text */}
      <p className="text-center text-sm text-gray-500">
        Du kan förfina budget och antal i nästa steg
      </p>
    </form>
  );
}
