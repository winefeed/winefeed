'use client';

/**
 * WINE DETAIL MODAL
 *
 * Modal för att visa fullständig vininfo och möjlighet att redigera.
 */

import { useState } from 'react';
import { X, Wine, MapPin, Grape, Package, Tag, Edit2, Save, Loader2 } from 'lucide-react';
import type { SupplierWine } from './WineCard';

interface WineDetailModalProps {
  wine: SupplierWine;
  onClose: () => void;
  onUpdate?: (wine: SupplierWine) => void;
  supplierId?: string;
}

const colorConfig: Record<string, { label: string; bg: string; text: string }> = {
  red: { label: 'Rött', bg: 'bg-red-100', text: 'text-red-800' },
  white: { label: 'Vitt', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  rose: { label: 'Rosé', bg: 'bg-pink-100', text: 'text-pink-800' },
  sparkling: { label: 'Mousserande', bg: 'bg-amber-100', text: 'text-amber-800' },
  fortified: { label: 'Starkvin', bg: 'bg-purple-100', text: 'text-purple-800' },
  orange: { label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-800' },
};

export function WineDetailModal({ wine, onClose, onUpdate, supplierId }: WineDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedWine, setEditedWine] = useState(wine);
  const [error, setError] = useState<string | null>(null);

  const color = colorConfig[wine.color] || { label: wine.color, bg: 'bg-gray-100', text: 'text-gray-800' };
  const priceFormatted = (wine.price_ex_vat_sek / 100).toLocaleString('sv-SE');

  const handleSave = async () => {
    if (!supplierId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedWine.name,
          producer: editedWine.producer,
          vintage: editedWine.vintage,
          region: editedWine.region,
          country: editedWine.country,
          grape: editedWine.grape,
          color: editedWine.color,
          price_ex_vat_sek: editedWine.price_ex_vat_sek,
          stock_qty: editedWine.stock_qty,
          moq: editedWine.moq,
          is_active: editedWine.is_active,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate?.(updated.wine || editedWine);
        setIsEditing(false);
      } else {
        const err = await response.json();
        setError(err.error || 'Kunde inte spara ändringar');
      }
    } catch (e) {
      setError('Ett fel uppstod');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-wine/10 rounded-lg">
              <Wine className="h-5 w-5 text-wine" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Vindetaljer</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Wine name & vintage */}
          <div>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vinnamn</label>
                  <input
                    type="text"
                    value={editedWine.name}
                    onChange={(e) => setEditedWine({ ...editedWine, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wine/20 focus:border-wine"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Producent</label>
                    <input
                      type="text"
                      value={editedWine.producer}
                      onChange={(e) => setEditedWine({ ...editedWine, producer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wine/20 focus:border-wine"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Årgång</label>
                    <input
                      type="text"
                      value={editedWine.vintage || ''}
                      onChange={(e) => setEditedWine({ ...editedWine, vintage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wine/20 focus:border-wine"
                      placeholder="t.ex. 2021"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900">
                  {wine.name}
                  {wine.vintage && wine.vintage !== 'NV' && (
                    <span className="text-gray-500 font-normal ml-2">{wine.vintage}</span>
                  )}
                </h3>
                <p className="text-gray-600 mt-1">{wine.producer}</p>
              </>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Region */}
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Region</p>
                {isEditing ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={editedWine.region}
                      onChange={(e) => setEditedWine({ ...editedWine, region: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-wine/20 focus:border-wine"
                      placeholder="Region"
                    />
                  </div>
                ) : (
                  <p className="font-medium text-gray-900">{wine.region}, {wine.country}</p>
                )}
              </div>
            </div>

            {/* Grape */}
            <div className="flex items-start gap-3">
              <Grape className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Druva</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedWine.grape}
                    onChange={(e) => setEditedWine({ ...editedWine, grape: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded mt-1 focus:ring-2 focus:ring-wine/20 focus:border-wine"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{wine.grape || '-'}</p>
                )}
              </div>
            </div>

            {/* Color */}
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">
                <div className={`h-3 w-3 rounded-full ${color.bg}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Färg</p>
                {isEditing ? (
                  <select
                    value={editedWine.color}
                    onChange={(e) => setEditedWine({ ...editedWine, color: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded mt-1 focus:ring-2 focus:ring-wine/20 focus:border-wine"
                  >
                    <option value="red">Rött</option>
                    <option value="white">Vitt</option>
                    <option value="rose">Rosé</option>
                    <option value="sparkling">Mousserande</option>
                    <option value="orange">Orange</option>
                    <option value="fortified">Starkvin</option>
                  </select>
                ) : (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                    {color.label}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Pris (ex moms)</p>
                {isEditing ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={editedWine.price_ex_vat_sek / 100}
                      onChange={(e) => setEditedWine({ ...editedWine, price_ex_vat_sek: parseFloat(e.target.value) * 100 })}
                      className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-wine/20 focus:border-wine"
                    />
                    <span className="text-sm text-gray-500">kr</span>
                  </div>
                ) : (
                  <p className="font-medium text-gray-900">{priceFormatted} kr</p>
                )}
              </div>
            </div>

            {/* Stock */}
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Lagersaldo</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editedWine.stock_qty}
                    onChange={(e) => setEditedWine({ ...editedWine, stock_qty: parseInt(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded mt-1 focus:ring-2 focus:ring-wine/20 focus:border-wine"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{wine.stock_qty} st</p>
                )}
              </div>
            </div>

            {/* MOQ */}
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Min. order</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editedWine.moq}
                    onChange={(e) => setEditedWine({ ...editedWine, moq: parseInt(e.target.value) || 1 })}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded mt-1 focus:ring-2 focus:ring-wine/20 focus:border-wine"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{wine.moq} st</p>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={editedWine.is_active}
                    onChange={(e) => setEditedWine({ ...editedWine, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-wine focus:ring-wine"
                  />
                  <span className="text-sm text-gray-700">Aktiv</span>
                </label>
              ) : (
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    wine.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {wine.is_active ? 'Aktiv' : 'Inaktiv'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setEditedWine(wine);
                  setIsEditing(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine/90 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Spara
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Stäng
              </button>
              {supplierId && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine/90 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                  Redigera
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
