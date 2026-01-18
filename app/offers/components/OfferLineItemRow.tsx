/**
 * OFFER LINE ITEM ROW
 *
 * Single editable wine row with Wine Check integration
 * Supports:
 * - Manual input (name, vintage, quantity, price)
 * - Wine Check verification (controlled mode)
 * - Match status badges
 * - Policy: NO PRICE DATA from Wine-Searcher
 */

'use client';

import { useState } from 'react';
import { OfferLineItem, WineCheckEnrichment, assertNoForbiddenFieldsInEnrichment, getMatchStatusLabel } from '@/lib/offer-types';
import { WineCheckPanel, WineCheckCandidate } from '@/app/components/wine-check';
import { getStatusColor } from '@/lib/design-system/status-colors';

interface OfferLineItemRowProps {
  lineItem: OfferLineItem;
  onUpdate: (lineItem: OfferLineItem) => void;
  onRemove: () => void;
}

export function OfferLineItemRow({ lineItem, onUpdate, onRemove }: OfferLineItemRowProps) {
  const [showWineCheck, setShowWineCheck] = useState(false);

  const handleInputChange = (field: keyof OfferLineItem, value: any) => {
    onUpdate({
      ...lineItem,
      [field]: value,
      updated_at: new Date().toISOString()
    });
  };

  const handleWineCheckSelect = (candidate: WineCheckCandidate) => {
    // Create enrichment from Wine Check candidate (allowlist only)
    const enrichment: WineCheckEnrichment = {
      canonical_name: candidate.name || null,
      producer: candidate.producer || null,
      country: null, // Not provided by Wine Check currently
      region: candidate.region || null,
      appellation: candidate.appellation || null,
      ws_id: null, // Not exposed in candidate yet (TODO: add if available)
      match_score: candidate.score || null,
      match_status: 'EXACT', // TODO: Get from result, not candidate
      checked_at: new Date().toISOString()
    };

    // SECURITY CHECK: Assert no forbidden fields
    try {
      assertNoForbiddenFieldsInEnrichment(enrichment);
    } catch (error) {
      console.error('Security violation in Wine Check enrichment:', error);
      alert('SECURITY ERROR: Forbidden data detected. Contact support.');
      return;
    }

    // Update line item with enrichment
    onUpdate({
      ...lineItem,
      enrichment,
      updated_at: new Date().toISOString()
    });

    // Close Wine Check panel
    setShowWineCheck(false);
  };

  const totalPrice = lineItem.unit_price ? lineItem.unit_price * lineItem.quantity : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Line Item Inputs */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-12 gap-3 items-start">
          {/* Wine Name */}
          <div className="col-span-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Vinnamn *
            </label>
            <input
              type="text"
              value={lineItem.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="T.ex. Château Margaux"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
          </div>

          {/* Vintage */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Årgång
            </label>
            <input
              type="number"
              value={lineItem.vintage || ''}
              onChange={(e) => handleInputChange('vintage', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="2020"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
          </div>

          {/* Quantity */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Antal
            </label>
            <input
              type="number"
              min="1"
              value={lineItem.quantity}
              onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
          </div>

          {/* Unit Price */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Á-pris (SEK)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={lineItem.unit_price || ''}
              onChange={(e) => handleInputChange('unit_price', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
          </div>

          {/* Total */}
          <div className="col-span-1 flex items-end h-full">
            <div className="text-sm font-semibold text-foreground">
              {totalPrice !== null ? `${totalPrice.toFixed(2)} kr` : '—'}
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-1 flex items-end justify-end h-full">
            <button
              onClick={onRemove}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Ta bort rad"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Wine Check Toggle Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWineCheck(!showWineCheck)}
            disabled={!lineItem.name.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {showWineCheck ? '✕ Stäng Wine Check' : '🔍 Wine Check'}
          </button>

          {/* Match Status Badge */}
          {lineItem.enrichment && lineItem.enrichment.match_status && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(lineItem.enrichment.match_status).badgeClass}`}>
                {getMatchStatusLabel(lineItem.enrichment.match_status)}
                {lineItem.enrichment.match_score !== null && ` (${lineItem.enrichment.match_score}%)`}
              </span>
            </div>
          )}
        </div>

        {/* Enrichment Display (if available) */}
        {lineItem.enrichment && (
          <div className="pt-3 border-t border-border text-xs space-y-1">
            <p className="font-medium text-muted-foreground">Verifierad data:</p>
            <div className="grid grid-cols-2 gap-2 text-foreground">
              {lineItem.enrichment.canonical_name && (
                <div>
                  <span className="text-muted-foreground">Namn: </span>
                  <span className="font-medium">{lineItem.enrichment.canonical_name}</span>
                </div>
              )}
              {lineItem.enrichment.producer && (
                <div>
                  <span className="text-muted-foreground">Producent: </span>
                  <span className="font-medium">{lineItem.enrichment.producer}</span>
                </div>
              )}
              {lineItem.enrichment.region && (
                <div>
                  <span className="text-muted-foreground">Region: </span>
                  <span className="font-medium">{lineItem.enrichment.region}</span>
                </div>
              )}
              {lineItem.enrichment.appellation && (
                <div>
                  <span className="text-muted-foreground">Appellation: </span>
                  <span className="font-medium">{lineItem.enrichment.appellation}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wine Check Panel (Controlled Mode) */}
      {showWineCheck && (
        <div className="border-t border-border p-4 bg-muted/20">
          <WineCheckPanel
            mode="controlled"
            initialName={lineItem.name}
            initialVintage={lineItem.vintage?.toString()}
            onSelectCandidate={handleWineCheckSelect}
            title="Verifiera vinnamn"
            description="Välj korrekt vin från kandidaterna nedan."
            compact={true}
          />
        </div>
      )}
    </div>
  );
}
