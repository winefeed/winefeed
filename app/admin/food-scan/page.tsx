/**
 * ADMIN FOOD SCAN PAGE
 *
 * /admin/food-scan
 *
 * 3 tabs:
 * 1. Skanna restaurang — search Wolt, trigger scan, see results
 * 2. Förslag — pending pairing suggestions with approve/reject
 * 3. Historik — past scan results
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ScanLine,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface WoltVenue {
  slug: string;
  name: string;
  city: string;
  address?: string;
}

interface DishAnalysis {
  dish_name: string;
  dish_name_original: string;
  matched: boolean;
  match_key?: string;
  colors: string[];
  regions: string[];
  grapes: string[];
  confidence: number;
  method: string;
}

interface ScanResult {
  restaurant_name: string;
  wolt_slug?: string;
  city?: string;
  total_dishes: number;
  matched_dishes: number;
  unmatched_dishes: number;
  dishes: DishAnalysis[];
}

interface Suggestion {
  id: string;
  dish_name: string;
  dish_name_original: string | null;
  source: string;
  source_detail: string | null;
  suggested_colors: string[];
  suggested_regions: string[];
  suggested_grapes: string[];
  confidence: number;
  categorization_method: string | null;
  status: string;
  approved_colors: string[];
  approved_regions: string[];
  approved_grapes: string[];
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface ScanHistoryItem {
  id: string;
  restaurant_name: string;
  wolt_slug: string | null;
  city: string | null;
  scan_source: string;
  total_dishes: number;
  matched_dishes: number;
  unmatched_dishes: number;
  scanned_at: string;
}

type Tab = 'scan' | 'suggestions' | 'history';

// ============================================================================
// Page Component (outside to avoid re-render issues)
// ============================================================================

const TABS: { key: Tab; label: string }[] = [
  { key: 'scan', label: 'Skanna restaurang' },
  { key: 'suggestions', label: 'Förslag' },
  { key: 'history', label: 'Historik' },
];

export default function FoodScanPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scan');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6" />
          Matscan
        </h1>
        <p className="text-gray-500 mt-1">
          Skanna restaurangmenyer, granska matpairings, bevaka trender
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#722F37] text-[#722F37]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'scan' && <ScanTab />}
      {activeTab === 'suggestions' && <SuggestionsTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

// ============================================================================
// Tab 1: Scan Restaurant
// ============================================================================

function ScanTab() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('stockholm');
  const [venues, setVenues] = useState<WoltVenue[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setVenues([]);
    setScanResult(null);

    try {
      const res = await fetch(`/api/admin/food-scan/search?q=${encodeURIComponent(query)}&city=${city}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setVenues(data.venues || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }, [query, city]);

  const handleScan = useCallback(async (venue: WoltVenue) => {
    setScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await fetch('/api/admin/food-scan/restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wolt_slug: venue.slug,
          restaurant_name: venue.name,
          city: venue.city,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setScanResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Search form */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Restaurangnamn..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]"
        />
        <select
          value={city}
          onChange={e => setCity(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="stockholm">Stockholm</option>
          <option value="göteborg">Göteborg</option>
          <option value="malmö">Malmö</option>
          <option value="uppsala">Uppsala</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-2 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center gap-2"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Sök
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Venue results */}
      {venues.length > 0 && (
        <div className="border rounded-lg divide-y">
          {venues.map(venue => (
            <div key={venue.slug} className="flex items-center justify-between p-3 hover:bg-gray-50">
              <div>
                <div className="font-medium text-sm">{venue.name}</div>
                {venue.address && <div className="text-xs text-gray-500">{venue.address}</div>}
              </div>
              <button
                onClick={() => handleScan(venue)}
                disabled={scanning}
                className="px-3 py-1.5 bg-[#722F37] text-white rounded text-xs font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center gap-1"
              >
                {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
                Skanna meny
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Scan result */}
      {scanResult && <ScanResultView result={scanResult} />}
    </div>
  );
}

function ScanResultView({ result }: { result: ScanResult }) {
  const matchRate = result.total_dishes > 0
    ? Math.round((result.matched_dishes / result.total_dishes) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{result.restaurant_name}</h3>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <div className="text-2xl font-bold">{result.total_dishes}</div>
          <div className="text-xs text-gray-500">Totalt</div>
        </div>
        <div className="p-4 bg-emerald-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-emerald-700">{result.matched_dishes}</div>
          <div className="text-xs text-gray-500">Matchade</div>
        </div>
        <div className="p-4 bg-amber-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-amber-700">{result.unmatched_dishes}</div>
          <div className="text-xs text-gray-500">Omatchade</div>
        </div>
      </div>

      {/* Match rate bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Matchgrad</span>
          <span>{matchRate}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${matchRate}%` }}
          />
        </div>
      </div>

      {/* Dish list */}
      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {result.dishes.map((dish, i) => (
          <div
            key={i}
            className={`px-3 py-2 text-sm flex items-center justify-between ${
              dish.matched ? 'bg-emerald-50' : 'bg-amber-50'
            }`}
          >
            <div>
              <span className="font-medium">{dish.dish_name_original}</span>
              {dish.match_key && (
                <span className="ml-2 text-xs text-gray-500">
                  → {dish.match_key} ({dish.method})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {dish.matched ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-600" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Tab 2: Suggestions
// ============================================================================

function SuggestionsTab() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColors, setEditColors] = useState('');
  const [editRegions, setEditRegions] = useState('');
  const [editGrapes, setEditGrapes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/food-scan/suggestions?status=pending&sort=occurrence_count');
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const startEdit = (s: Suggestion) => {
    setEditingId(s.id);
    setEditColors(s.suggested_colors.join(', '));
    setEditRegions(s.suggested_regions.join(', '));
    setEditGrapes(s.suggested_grapes.join(', '));
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const colors = editColors.split(',').map(s => s.trim()).filter(Boolean);
      const regions = editRegions.split(',').map(s => s.trim()).filter(Boolean);
      const grapes = editGrapes.split(',').map(s => s.trim()).filter(Boolean);

      const res = await fetch(`/api/admin/food-scan/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approved_colors: colors, approved_regions: regions, approved_grapes: grapes }),
      });

      if (!res.ok) throw new Error('Approve failed');

      setSuggestions(prev => prev.filter(s => s.id !== id));
      setEditingId(null);
      showToast('Godkänd!');
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/food-scan/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (!res.ok) throw new Error('Reject failed');

      setSuggestions(prev => prev.filter(s => s.id !== id));
      showToast('Avvisad');
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Inga väntande förslag. Skanna en restaurang för att generera nya.
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      {toast && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="text-sm text-gray-500 mb-4">
        {suggestions.length} väntande förslag
      </div>

      <div className="border rounded-lg divide-y">
        {suggestions.map(s => (
          <div key={s.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm">{s.dish_name_original || s.dish_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.occurrence_count}x | {s.source} | {s.categorization_method || 'okänd metod'}
                  {s.source_detail && ` | ${s.source_detail}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingId !== s.id && (
                  <>
                    <button
                      onClick={() => startEdit(s)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
                    >
                      Granska
                    </button>
                    <button
                      onClick={() => handleReject(s.id)}
                      disabled={actionLoading === s.id}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 disabled:opacity-50"
                    >
                      Avvisa
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inline edit */}
            {editingId === s.id && (
              <div className="mt-3 space-y-2 bg-gray-50 p-3 rounded-lg">
                <div>
                  <label className="text-xs font-medium text-gray-600">Färger (komma-separerade)</label>
                  <input
                    type="text"
                    value={editColors}
                    onChange={e => setEditColors(e.target.value)}
                    placeholder="red, white"
                    className="w-full px-2 py-1.5 border rounded text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Regioner</label>
                  <input
                    type="text"
                    value={editRegions}
                    onChange={e => setEditRegions(e.target.value)}
                    placeholder="bourgogne, toscana"
                    className="w-full px-2 py-1.5 border rounded text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Druvor</label>
                  <input
                    type="text"
                    value={editGrapes}
                    onChange={e => setEditGrapes(e.target.value)}
                    placeholder="Pinot Noir, Chardonnay"
                    className="w-full px-2 py-1.5 border rounded text-sm mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleApprove(s.id)}
                    disabled={actionLoading === s.id}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {actionLoading === s.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Godkänn
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Tab 3: History
// ============================================================================

function HistoryTab() {
  const [results, setResults] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/food-scan/results');
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Inga skanningar ännu.
      </div>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {results.map(r => {
        const matchRate = r.total_dishes > 0
          ? Math.round((r.matched_dishes / r.total_dishes) * 100)
          : 0;

        return (
          <div key={r.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
            <div>
              <div className="font-medium text-sm">{r.restaurant_name}</div>
              <div className="text-xs text-gray-500">
                {new Date(r.scanned_at).toLocaleDateString('sv-SE')} | {r.scan_source}
                {r.city && ` | ${r.city}`}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">{r.total_dishes} rätter</span>
              <span className={matchRate >= 70 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                {matchRate}% match
              </span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
