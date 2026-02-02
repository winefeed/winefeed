'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Info, MapPin, Clock, X } from 'lucide-react';
import { HelpTooltip, GLOSSARY } from '@/components/ui/help-tooltip';

export type DeliveryTime = 'this_week' | 'two_weeks' | 'flexible' | null;

interface RefinePanelProps {
  budget: number | null;
  quantity: number | null;
  onBudgetChange: (value: number | null) => void;
  onQuantityChange: (value: number | null) => void;
  deliveryCity?: string;
  onDeliveryCityChange?: (value: string) => void;
  deliveryTime?: DeliveryTime;
  onDeliveryTimeChange?: (value: DeliveryTime) => void;
  // Validation state
  showValidation?: boolean;
  // Last saved timestamp
  lastSaved?: Date | null;
}

// Quick select options
const BUDGET_OPTIONS = [100, 150, 200, 300, 500];
const QUANTITY_OPTIONS = [6, 12, 24, 48, 72];

const DELIVERY_TIME_OPTIONS: { value: DeliveryTime; label: string }[] = [
  { value: 'this_week', label: 'Denna vecka' },
  { value: 'two_weeks', label: '2 veckor' },
  { value: 'flexible', label: 'Flexibel' },
];

export function RefinePanel({
  budget,
  quantity,
  onBudgetChange,
  onQuantityChange,
  deliveryCity,
  onDeliveryCityChange,
  deliveryTime,
  onDeliveryTimeChange,
  showValidation = false,
  lastSaved,
}: RefinePanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customBudget, setCustomBudget] = useState('');
  const [customQuantity, setCustomQuantity] = useState('');
  const [editingCity, setEditingCity] = useState(false);
  const cityInputRef = useRef<HTMLInputElement>(null);

  // No longer required - these are optional refinements
  const _unused = showValidation; // Keep prop for backwards compatibility

  // Focus city input when editing
  useEffect(() => {
    if (editingCity && cityInputRef.current) {
      cityInputRef.current.focus();
    }
  }, [editingCity]);

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 10) return 'Just nu';
    if (diffSecs < 60) return `${diffSecs} sek sedan`;
    if (diffMins < 60) return `${diffMins} min sedan`;
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header notice */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">
            Förfina din sökning <span className="text-gray-400">(valfritt)</span>
          </p>
        </div>
        {lastSaved && (
          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
            Sparad {formatLastSaved(lastSaved)}
          </span>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Delivery City Chip (if set and not editing) */}
        {deliveryCity && !editingCity && onDeliveryCityChange && (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
              <MapPin className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-gray-700">{deliveryCity}</span>
              <button
                type="button"
                onClick={() => setEditingCity(true)}
                className="text-primary hover:text-primary/80 text-xs font-medium ml-1"
              >
                Ändra
              </button>
            </div>
          </div>
        )}

        {/* Delivery City Input (when editing or no city set) */}
        {editingCity && onDeliveryCityChange && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              ref={cityInputRef}
              type="text"
              value={deliveryCity || ''}
              onChange={(e) => onDeliveryCityChange(e.target.value)}
              placeholder="T.ex. Stockholm"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
              onBlur={() => {
                if (deliveryCity) setEditingCity(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deliveryCity) {
                  setEditingCity(false);
                }
              }}
            />
            {deliveryCity && (
              <button
                type="button"
                onClick={() => setEditingCity(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Budget */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              Budget per flaska
              <HelpTooltip content={GLOSSARY.exMoms} />
              {budget && <span className="text-green-600 ml-1">✓</span>}
            </label>
            {budget && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{budget} kr</span>
                <button
                  type="button"
                  onClick={() => {
                    onBudgetChange(null);
                    setCustomBudget('');
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Rensa
                </button>
              </div>
            )}
          </div>

          {/* Quick select chips */}
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onBudgetChange(opt);
                  setCustomBudget('');
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  budget === opt
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt} kr
              </button>
            ))}
            <input
              type="number"
              value={customBudget}
              onChange={(e) => {
                setCustomBudget(e.target.value);
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) {
                  onBudgetChange(val);
                }
              }}
              placeholder="Annat"
              className="w-20 px-3 py-1.5 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <p className="text-xs text-gray-500">SEK ex moms – hjälper leverantörer ge bättre förslag</p>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              Antal flaskor
              <HelpTooltip content="Totalt antal flaskor du vill beställa. Du kan justera per vin senare." />
              {quantity && <span className="text-green-600 ml-1">✓</span>}
            </label>
            {quantity && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{quantity} fl</span>
                <button
                  type="button"
                  onClick={() => {
                    onQuantityChange(null);
                    setCustomQuantity('');
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Rensa
                </button>
              </div>
            )}
          </div>

          {/* Quick select chips */}
          <div className="flex flex-wrap gap-2">
            {QUANTITY_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onQuantityChange(opt);
                  setCustomQuantity('');
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  quantity === opt
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt} fl
              </button>
            ))}
            <input
              type="number"
              value={customQuantity}
              onChange={(e) => {
                setCustomQuantity(e.target.value);
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) {
                  onQuantityChange(val);
                }
              }}
              placeholder="Annat"
              className="w-20 px-3 py-1.5 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

        </div>

        {/* Delivery Time Chips */}
        {onDeliveryTimeChange && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Önskad leveranstid
                <span className="text-gray-400 font-normal">(valfritt)</span>
              </label>
              {deliveryTime && (
                <button
                  type="button"
                  onClick={() => onDeliveryTimeChange(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Rensa
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onDeliveryTimeChange(deliveryTime === opt.value ? null : opt.value);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    deliveryTime === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced filters (collapsed) */}
        <div className="pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <span>Fler alternativ</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="pt-3 space-y-4">
              {/* Delivery city input (if not already shown) */}
              {!deliveryCity && onDeliveryCityChange && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Leveransort
                  </label>
                  <input
                    type="text"
                    value={deliveryCity || ''}
                    onChange={(e) => onDeliveryCityChange(e.target.value)}
                    placeholder="T.ex. Stockholm"
                    className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                  />
                </div>
              )}

              {/* Placeholder for more filters */}
              <p className="text-xs text-gray-400">
                Fler filter (land, druva, certifieringar) kommer snart
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
