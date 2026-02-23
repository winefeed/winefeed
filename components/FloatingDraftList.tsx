'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDraftList } from '@/lib/hooks/useDraftList';
import { formatPrice } from '@/lib/utils';
import {
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  X,
  Trash2,
  ArrowRight,
  Package,
} from 'lucide-react';

const COLOR_LABELS: Record<string, { label: string; color: string }> = {
  red: { label: 'Rött', color: 'bg-red-500' },
  white: { label: 'Vitt', color: 'bg-amber-200' },
  rose: { label: 'Rosé', color: 'bg-pink-300' },
  sparkling: { label: 'Mouss.', color: 'bg-yellow-300' },
  orange: { label: 'Orange', color: 'bg-orange-400' },
  fortified: { label: 'Stark', color: 'bg-amber-600' },
};

export function FloatingDraftList() {
  const router = useRouter();
  const draftList = useDraftList();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Calculate totals (including provorder fees)
  const totalValue = draftList.items.reduce(
    (sum, item) => sum + item.price_sek * item.quantity + (item.provorder ? (item.provorder_fee || 500) : 0),
    0
  );
  const totalBottles = draftList.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const provorderCount = draftList.items.filter(item => item.provorder).length;

  // Don't render if no items
  if (draftList.items.length === 0) {
    return null;
  }

  // Minimized state - just hide completely
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all"
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-white text-primary text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-primary">
          {draftList.count}
        </span>
      </button>
    );
  }

  return (
    <div className="hidden md:block fixed bottom-6 right-6 z-50">
      {/* Expanded view */}
      {isExpanded && (
        <div className="mb-3 bg-card border border-border rounded-xl shadow-2xl w-80 max-h-96 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-primary text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="font-medium">Min lista</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-primary-foreground/20 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Wine list */}
          <div className="max-h-56 overflow-y-auto divide-y divide-border">
            {draftList.items.slice(0, 5).map((item) => (
              <div
                key={item.wine_id}
                className="px-4 py-3 flex items-start gap-3"
              >
                {/* Color dot */}
                {item.color && COLOR_LABELS[item.color] && (
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${COLOR_LABELS[item.color].color}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.wine_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.producer}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} fl × {formatPrice(item.price_sek)}
                    </p>
                    {item.provorder && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                        +{item.provorder_fee || 500} kr
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => draftList.removeItem(item.wine_id)}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {draftList.items.length > 5 && (
              <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/30">
                +{draftList.items.length - 5} fler viner
              </div>
            )}
          </div>

          {/* Footer with totals and action */}
          <div className="px-4 py-3 bg-muted/30 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                {totalBottles} flaskor
              </span>
              <span className="text-sm font-bold text-foreground">
                {formatPrice(totalValue)}
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard/draft-list')}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              Visa hela listan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsed mini view */}
      <div
        className={`bg-primary text-primary-foreground rounded-xl shadow-lg cursor-pointer transition-all hover:shadow-xl ${
          isExpanded ? 'rounded-t-lg' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {draftList.count} vin{draftList.count !== 1 ? 'er' : ''} sparade
            </p>
            <p className="text-xs text-primary-foreground/80">
              {totalBottles} fl · {formatPrice(totalValue)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </div>
        </div>
      </div>

      {/* Hide button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
          setIsExpanded(false);
        }}
        className="absolute -top-2 -right-2 p-1 bg-muted border border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-sm"
        title="Minimera"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
