/**
 * COMPLIANCE EDIT PANEL
 *
 * Side panel for editing compliance fields on order lines.
 * Supports both single line and batch editing.
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { MissingField, checkOrderLineCompliance } from './ComplianceStatusBadge';
import { getErrorMessage } from '@/lib/utils';

export interface OrderLineComplianceData {
  id: string;
  wine_name: string;
  producer?: string;
  vintage?: string;
  country?: string;
  gtin?: string | null;
  lwin?: string | null;
  abv?: number | null;
  volume_ml?: number | null;
  packaging_type?: string | null;
}

interface ComplianceEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lines: OrderLineComplianceData[];
  onSave: (updates: Array<{ lineId: string; data: Partial<OrderLineComplianceData> }>) => Promise<void>;
  title?: string;
}

const PACKAGING_OPTIONS = [
  { value: 'bottle', label: 'Flaska' },
  { value: 'bag_in_box', label: 'Bag-in-Box' },
  { value: 'can', label: 'Burk' },
  { value: 'tetra', label: 'Tetra' },
  { value: 'keg', label: 'Fat' },
];

const COMMON_VOLUMES = [187, 375, 500, 750, 1000, 1500, 3000, 5000];

export function ComplianceEditPanel({
  isOpen,
  onClose,
  lines,
  onSave,
  title = 'Redigera compliance-data',
}: ComplianceEditPanelProps) {
  const [editedLines, setEditedLines] = useState<Map<string, Partial<OrderLineComplianceData>>>(new Map());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setEditedLines(new Map());
      setExpandedLines(new Set(lines.filter(l => {
        const compliance = checkOrderLineCompliance(l);
        return compliance.status !== 'OK';
      }).map(l => l.id)));
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, lines]);

  const updateLine = (lineId: string, field: string, value: string | number | null) => {
    setEditedLines(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(lineId) || {};
      newMap.set(lineId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const getLineValue = (line: OrderLineComplianceData, field: keyof OrderLineComplianceData) => {
    const edited = editedLines.get(line.id);
    if (edited && field in edited) {
      return edited[field];
    }
    return line[field];
  };

  const handleSave = async () => {
    if (editedLines.size === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updates = Array.from(editedLines.entries()).map(([lineId, data]) => ({
        lineId,
        data,
      }));

      await onSave(updates);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(getErrorMessage(err, 'Kunde inte spara ändringar'));
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (lineId: string) => {
    setExpandedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  const hasChanges = editedLines.size > 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{lines.length} rad(er)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              Ändringar sparade!
            </div>
          )}

          <div className="space-y-4">
            {lines.map((line) => {
              const compliance = checkOrderLineCompliance({
                gtin: getLineValue(line, 'gtin') as string | undefined,
                lwin: getLineValue(line, 'lwin') as string | undefined,
                abv: getLineValue(line, 'abv') as number | undefined,
                volume_ml: getLineValue(line, 'volume_ml') as number | undefined,
                country: getLineValue(line, 'country') as string | undefined,
                packaging_type: getLineValue(line, 'packaging_type') as string | undefined,
              });

              const isExpanded = expandedLines.has(line.id);
              const hasLineChanges = editedLines.has(line.id);

              return (
                <div
                  key={line.id}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    compliance.status === 'OK'
                      ? 'border-green-200 bg-green-50/50'
                      : compliance.status === 'BLOCKED'
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  {/* Line Header */}
                  <button
                    onClick={() => toggleExpand(line.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{line.wine_name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {line.producer} · {line.vintage || 'NV'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {hasLineChanges && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Ändrad
                        </span>
                      )}
                      {compliance.status === 'OK' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          {compliance.missingFields.filter(f => f.severity === 'required').length} saknas
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Form */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-white space-y-3">
                      {/* GTIN */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          GTIN / EAN-kod
                          {!getLineValue(line, 'gtin') && !getLineValue(line, 'lwin') && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={(getLineValue(line, 'gtin') as string) || ''}
                          onChange={(e) => updateLine(line.id, 'gtin', e.target.value || null)}
                          placeholder="13-siffrig streckkod"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* LWIN */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          LWIN
                          {!getLineValue(line, 'gtin') && !getLineValue(line, 'lwin') && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={(getLineValue(line, 'lwin') as string) || ''}
                          onChange={(e) => updateLine(line.id, 'lwin', e.target.value || null)}
                          placeholder="Liv-ex Wine ID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* ABV & Volume row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            ABV %
                            {!getLineValue(line, 'abv') && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={(getLineValue(line, 'abv') as number) || ''}
                            onChange={(e) => updateLine(line.id, 'abv', e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="13.5"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Volym (ml)
                            {!getLineValue(line, 'volume_ml') && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <select
                            value={(getLineValue(line, 'volume_ml') as number) || ''}
                            onChange={(e) => updateLine(line.id, 'volume_ml', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Välj...</option>
                            {COMMON_VOLUMES.map(v => (
                              <option key={v} value={v}>{v} ml</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Country */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Ursprungsland
                          {!getLineValue(line, 'country') && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={(getLineValue(line, 'country') as string) || ''}
                          onChange={(e) => updateLine(line.id, 'country', e.target.value || null)}
                          placeholder="t.ex. France"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Packaging Type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Förpackningstyp
                        </label>
                        <select
                          value={(getLineValue(line, 'packaging_type') as string) || ''}
                          onChange={(e) => updateLine(line.id, 'packaging_type', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Välj...</option>
                          {PACKAGING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Spara ändringar
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
