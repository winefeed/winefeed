'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDraftList } from '@/lib/hooks/useDraftList';
import { DraftWineItem } from '@/lib/draft-storage';
import { formatPrice } from '@/lib/utils';
import {
  ArrowLeft,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingCart,
  Send,
  Clock
} from 'lucide-react';

const COLOR_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  red: { label: 'Rött', bg: 'bg-red-100', text: 'text-red-700' },
  white: { label: 'Vitt', bg: 'bg-amber-50', text: 'text-amber-700' },
  rose: { label: 'Rosé', bg: 'bg-pink-100', text: 'text-pink-700' },
  sparkling: { label: 'Mousserande', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  orange: { label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700' },
  fortified: { label: 'Starkvin', bg: 'bg-amber-200', text: 'text-amber-800' },
};

export default function DraftListPage() {
  const router = useRouter();
  const draftList = useDraftList();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const groupedItems = draftList.getGroupedBySupplier();

  // Calculate total value
  const totalValue = draftList.items.reduce((sum, item) => sum + (item.price_sek * item.quantity), 0);
  const totalBottles = draftList.items.reduce((sum, item) => sum + item.quantity, 0);

  // Check if any items are below MOQ
  const itemsBelowMoq = draftList.items.filter(item => item.moq > 0 && item.quantity < item.moq);
  const hasAnyBelowMoq = itemsBelowMoq.length > 0;

  // Calculate minimum purchase value (if all MOQs were met)
  const minPurchaseValue = draftList.items.reduce((sum, item) => {
    const effectiveQty = item.moq > 0 ? Math.max(item.quantity, item.moq) : item.quantity;
    return sum + (item.price_sek * effectiveQty);
  }, 0);

  // Set quantity to MOQ for a wine
  const setQuantityToMoq = (wineId: string, moq: number) => {
    draftList.updateQuantity(wineId, moq);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate days since created
  const daysSinceCreated = () => {
    if (!draftList.createdAt) return 0;
    const created = new Date(draftList.createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleQuantityChange = (wineId: string, delta: number) => {
    const item = draftList.items.find(i => i.wine_id === wineId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      draftList.updateQuantity(wineId, newQuantity);
    }
  };

  const handleClearList = () => {
    draftList.clear();
    setShowClearConfirm(false);
  };

  if (draftList.items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
        {/* Header */}
        <header className="bg-primary text-primary-foreground shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-primary-foreground/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-6 w-6" />
                <div>
                  <h1 className="text-xl font-bold">Min lista</h1>
                  <p className="text-sm text-primary-foreground/80">Sparade viner</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Din lista är tom</h2>
            <p className="text-muted-foreground mb-6">
              Spara viner från sökresultaten för att samla dem här
            </p>
            <button
              onClick={() => router.push('/dashboard/new-request')}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
            >
              Sök efter viner
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-primary-foreground/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-6 w-6" />
                <div>
                  <h1 className="text-xl font-bold">Min lista</h1>
                  <p className="text-sm text-primary-foreground/80">
                    {draftList.count} vin{draftList.count !== 1 ? 'er' : ''} sparade
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 bg-primary-foreground/20 text-primary-foreground rounded-lg hover:bg-primary-foreground/30 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Rensa lista
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stale Warning */}
        {draftList.isStale && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Din lista är över 7 dagar gammal</p>
                <p className="text-sm text-amber-700 mt-1">
                  Priserna och lagerstatus kan ha ändrats. Överväg att göra en ny sökning.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className={`mb-6 p-6 bg-card border rounded-2xl shadow-lg ${hasAnyBelowMoq ? 'border-orange-300' : 'border-border'}`}>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{draftList.count}</p>
              <p className="text-sm text-muted-foreground">Viner</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{totalBottles}</p>
              <p className="text-sm text-muted-foreground">Flaskor totalt</p>
            </div>
            <div className="text-center">
              {hasAnyBelowMoq ? (
                <>
                  <p className="text-2xl font-bold text-orange-600 line-through">{formatPrice(totalValue)}</p>
                  <p className="text-sm text-muted-foreground">Under min. order</p>
                  <p className="text-lg font-bold text-foreground mt-1">{formatPrice(minPurchaseValue)}</p>
                  <p className="text-xs text-muted-foreground">Min. köp</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-foreground">{formatPrice(totalValue)}</p>
                  <p className="text-sm text-muted-foreground">Uppskattat värde</p>
                </>
              )}
            </div>
          </div>
          {hasAnyBelowMoq && (
            <div className="mt-4 pt-4 border-t border-orange-200 bg-orange-50 -mx-6 -mb-6 px-6 pb-4 rounded-b-2xl">
              <p className="text-sm text-orange-800 font-medium text-center">
                ⚠️ {itemsBelowMoq.length} vin{itemsBelowMoq.length > 1 ? 'er' : ''} under minsta order – justera antal nedan
              </p>
            </div>
          )}
          {!hasAnyBelowMoq && draftList.createdAt && (
            <div className="mt-4 pt-4 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Skapad {formatDate(draftList.createdAt)} ({daysSinceCreated()} dagar sedan)
                {draftList.updatedAt !== draftList.createdAt && (
                  <> · Uppdaterad {formatDate(draftList.updatedAt)}</>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Grouped by Supplier */}
        <div className="space-y-6">
          {Array.from(groupedItems.entries()).map(([supplierId, group]) => (
            <div key={supplierId} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Supplier Header */}
              <div className={`px-6 py-4 border-b ${group.meets_moq ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <h3 className="font-bold text-foreground">{group.supplier_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.items.length} vin{group.items.length !== 1 ? 'er' : ''} · {group.total_quantity} flaskor
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    group.meets_moq
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {group.meets_moq ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Minsta order uppfylld
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        Under minsta order
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Wine Items */}
              <div className="divide-y divide-border">
                {group.items.map((item) => (
                  <WineItem
                    key={item.wine_id}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onRemove={() => draftList.removeItem(item.wine_id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {hasAnyBelowMoq && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl max-w-md text-center">
              <p className="text-sm text-orange-800 font-medium mb-2">
                ⚠️ {itemsBelowMoq.length} vin{itemsBelowMoq.length > 1 ? 'er' : ''} är under minsta order
              </p>
              <p className="text-xs text-orange-700">
                Justera antal ovan eller skicka ändå – leverantören kan välja att acceptera eller föreslå alternativ.
              </p>
            </div>
          )}
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard/new-request')}
              className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-colors font-medium"
            >
              Fortsätt söka
            </button>
            <button
              onClick={() => {
                // TODO: Create quote request from draft list
                alert('Funktion kommer snart!');
              }}
              className={`px-8 py-3 rounded-xl transition-colors font-medium flex items-center gap-2 shadow-lg ${
                hasAnyBelowMoq
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              <Send className="h-4 w-4" />
              {hasAnyBelowMoq
                ? `Skicka ändå (${draftList.count} viner)`
                : `Skicka förfrågan (${draftList.count} viner)`
              }
            </button>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Rensa listan?</h3>
                <p className="text-muted-foreground mb-6">
                  Alla {draftList.count} sparade viner kommer att tas bort. Detta går inte att ångra.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-6 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handleClearList}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Ja, rensa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Wine Item Component
function WineItem({
  item,
  onQuantityChange,
  onRemove
}: {
  item: DraftWineItem;
  onQuantityChange: (wineId: string, delta: number) => void;
  onRemove: () => void;
}) {
  const isBelowMoq = item.moq > 0 && item.quantity < item.moq;

  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        {/* Wine Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground truncate">{item.wine_name}</h4>
            {item.vintage && (
              <span className="text-muted-foreground">{item.vintage}</span>
            )}
            {item.color && COLOR_LABELS[item.color] && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${COLOR_LABELS[item.color].bg} ${COLOR_LABELS[item.color].text}`}>
                {COLOR_LABELS[item.color].label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {item.producer} · {item.country}
            {item.region && ` · ${item.region}`}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>{formatPrice(item.price_sek)}/fl</span>
            {item.moq > 0 && (
              <span className={isBelowMoq ? 'text-orange-600 font-medium' : ''}>
                Min. order: {item.moq} fl
              </span>
            )}
            {item.stock !== undefined && item.stock !== null && (
              <span className={item.stock > 0 ? 'text-green-600' : 'text-orange-500'}>
                {item.stock > 0 ? `${item.stock} i lager` : 'Beställningsvara'}
              </span>
            )}
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantityChange(item.wine_id, -1)}
              disabled={item.quantity <= 1}
              className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className={`w-12 text-center font-medium ${isBelowMoq ? 'text-orange-600' : ''}`}>
              {item.quantity}
            </span>
            <button
              onClick={() => onQuantityChange(item.wine_id, 1)}
              className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-medium text-foreground">
            {formatPrice(item.price_sek * item.quantity)}
          </p>
        </div>

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Minimum Order Warning */}
      {isBelowMoq && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Behöver {item.moq - item.quantity} fler flaskor för att nå minsta order
          </p>
        </div>
      )}
    </div>
  );
}
