'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Wine, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface LowStockWine {
  id: string;
  name: string;
  producer: string;
  stock_qty: number;
  moq: number;
}

export function LowStockAlert() {
  const [wines, setWines] = useState<LowStockWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchLowStock() {
      try {
        const res = await fetch('/api/supplier/notifications?type=low_stock');
        if (res.ok) {
          const data = await res.json();
          setWines(data.low_stock || []);
        }
      } catch (error) {
        console.error('Failed to fetch low stock:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLowStock();
  }, []);

  if (loading || wines.length === 0) {
    return null;
  }

  const criticalWines = wines.filter(w => w.stock_qty < 6);
  const warningWines = wines.filter(w => w.stock_qty >= 6);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-100/50 transition-colors"
      >
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-medium text-amber-800">
            Lågt lager på {wines.length} {wines.length === 1 ? 'vin' : 'viner'}
          </h3>
          <p className="text-sm text-amber-600">
            {criticalWines.length > 0 && (
              <span className="text-red-600 font-medium">
                {criticalWines.length} kritiskt lågt
              </span>
            )}
            {criticalWines.length > 0 && warningWines.length > 0 && ' • '}
            {warningWines.length > 0 && `${warningWines.length} under 12 flaskor`}
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
            {criticalWines.map((wine) => (
              <a
                key={wine.id}
                href={`/supplier/wines?id=${wine.id}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Wine className="h-4 w-4 text-red-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800 truncate">
                    {wine.producer} {wine.name}
                  </p>
                </div>
                <span className="text-sm font-bold text-red-600">
                  {wine.stock_qty} kvar
                </span>
              </a>
            ))}

            {/* Warning */}
            {warningWines.map((wine) => (
              <a
                key={wine.id}
                href={`/supplier/wines?id=${wine.id}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-amber-100/50 hover:bg-amber-100 transition-colors"
              >
                <Wine className="h-4 w-4 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 truncate">
                    {wine.producer} {wine.name}
                  </p>
                </div>
                <span className="text-sm font-medium text-amber-600">
                  {wine.stock_qty} kvar
                </span>
              </a>
            ))}
          </div>

          <a
            href="/supplier/wines?filter=low_stock"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Hantera lager
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
