/**
 * READINESS PACK BUTTON - UI Stub
 *
 * Shows "Create Readiness Pack" button ONLY when:
 * 1. Feature flag is enabled (FEATURE_PRODUCER_READINESS_PACKS=true)
 * 2. Request status is in ACCEPTED state (besvarad, meddelad, slutford)
 * 3. No existing pack for this request
 *
 * POLICY (displayed in UI):
 * - This is a SERVICE to help producers deliver materials
 * - Does NOT affect request acceptance or priority
 * - Only available AFTER IOR has accepted the request
 *
 * Feature flag: FEATURE_PRODUCER_READINESS_PACKS (default: false)
 */

'use client';

import { useState, useMemo } from 'react';
import { Package, Check, Loader2, AlertCircle, Info, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ReadinessPackLanguage,
  READINESS_PACK_LANGUAGES,
  getScopeLabels,
} from '@/lib/readiness-pack-types';

// ============================================
// TYPES
// ============================================

interface ReadinessPackButtonProps {
  requestId: string;
  requestStatus: string;
  existingPackId?: string | null;
  existingPackStatus?: string | null;
  onPackCreated?: (packId: string) => void;
  className?: string;
}

interface ScopeItem {
  key: string;
  label: string;
  checked: boolean;
}

// ============================================
// CONSTANTS
// ============================================

// Statuses where pack creation is allowed
const ACCEPTED_STATUSES = ['besvarad', 'meddelad', 'slutford'];

// Default checked keys
const DEFAULT_CHECKED_KEYS = ['product_sheet', 'price_list'];

function buildScopeItems(lang: ReadinessPackLanguage): ScopeItem[] {
  const labels = getScopeLabels(lang);
  return (Object.keys(labels) as Array<keyof typeof labels>).map(key => ({
    key,
    label: labels[key],
    checked: DEFAULT_CHECKED_KEYS.includes(key),
  }));
}

// ============================================
// FEATURE FLAG CHECK
// ============================================

// In production, this would be from env or API
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PRODUCER_READINESS_PACKS === 'true';

// ============================================
// COMPONENT
// ============================================

export function ReadinessPackButton({
  requestId,
  requestStatus,
  existingPackId,
  existingPackStatus,
  onPackCreated,
  className,
}: ReadinessPackButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [language, setLanguage] = useState<ReadinessPackLanguage>('en');
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set(DEFAULT_CHECKED_KEYS));
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeItems = useMemo(() => {
    const labels = getScopeLabels(language);
    return (Object.keys(labels) as Array<keyof typeof labels>).map(key => ({
      key,
      label: labels[key],
      checked: checkedKeys.has(key),
    }));
  }, [language, checkedKeys]);

  // Feature flag check - render nothing if disabled
  if (!FEATURE_ENABLED) {
    return null;
  }

  // Only show for accepted requests
  const isAccepted = ACCEPTED_STATUSES.includes(requestStatus);
  if (!isAccepted) {
    return null;
  }

  // If pack already exists, show status badge instead
  if (existingPackId) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Package className="h-4 w-4 text-purple-600" />
        <span className="text-sm text-purple-700">
          Readiness Pack: {existingPackStatus || 'DRAFT'}
        </span>
      </div>
    );
  }

  const toggleScope = (key: string) => {
    setCheckedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      // Build scope object
      const scope: Record<string, boolean> = {};
      scopeItems.forEach(item => {
        if (item.checked) {
          scope[item.key] = true;
        }
      });

      const response = await fetch('/api/admin/readiness-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_request_id: requestId,
          scope,
          notes: notes || undefined,
          payer: 'IOR', // MVP: IOR always pays
          language,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || data.error || 'Failed to create pack');
      }

      const { pack } = await response.json();
      setShowModal(false);
      onPackCreated?.(pack.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setShowModal(true)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium',
          'bg-purple-50 text-purple-700 border border-purple-200 rounded-lg',
          'hover:bg-purple-100 hover:border-purple-300 transition-colors',
          className
        )}
      >
        <Package className="h-4 w-4" />
        Skapa Readiness Pack
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Skapa Readiness Pack
                  </h2>
                  <p className="text-sm text-gray-500">
                    Hjälp producenten leverera nödvändigt material
                  </p>
                </div>
              </div>

              {/* Policy notice */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  <strong>Obs:</strong> Detta är en servicetjänst som{' '}
                  <strong>inte påverkar</strong> vilka förfrågningar som accepteras.
                  Readiness Packs erbjuds endast efter att förfrågan godkänts.
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Language selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Språk till producenten
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value as ReadinessPackLanguage)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none"
                  >
                    {READINESS_PACK_LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scope selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Välj vad som ska ingå
                </label>
                <div className="space-y-2">
                  {scopeItems.map(item => (
                    <label
                      key={item.key}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        item.checked
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleScope(item.key)}
                        className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-900">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anteckningar (valfritt)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="T.ex. specifika krav eller deadlines..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Payer info */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Betalare:</strong> IOR (du) &mdash; avgiftsfritt i piloten
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !scopeItems.some(i => i.checked)}
                className={cn(
                  'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                  'bg-purple-600 hover:bg-purple-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center gap-2'
                )}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Skapar...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Skapa pack
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// EXPORT DEFAULT FOR LAZY LOADING
// ============================================

export default ReadinessPackButton;
