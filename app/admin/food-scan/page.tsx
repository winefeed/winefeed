/**
 * ADMIN — MATCHA MENYN
 *
 * /admin/food-scan
 *
 * 3 tabs:
 * 1. Ny analys — search Wolt or upload PDF, trigger scan, see results + CTA
 * 2. Vinförslag — merged history + outreach: generate, review, send wine recommendations
 * 3. Pairings — pending pairing suggestions with approve/reject (advanced)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ScanLine,
  CheckCircle2,
  XCircle,
  Loader2,
  UtensilsCrossed,
  Wine,
  Send,
  Mail,
  Upload,
  FileUp,
  X,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';

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
  id?: string;
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

interface RecommendedWine {
  wineId: string;
  name: string;
  producer: string;
  grape: string | null;
  vintage: number | null;
  priceExVat: number;
  color: string | null;
  reason: string;
  matchedDishes?: string[];
}

interface RecommendationHistoryItem {
  id: string;
  restaurant_name: string;
  status: string;
  sent_at: string | null;
  recipient_email: string | null;
  dominant_styles: string[];
  recommended_wines: RecommendedWine[];
  email_subject: string | null;
  created_at: string;
}

type Tab = 'scan' | 'vinforslag' | 'pairings';

// ============================================================================
// Page Component
// ============================================================================

const TABS: { key: Tab; label: string }[] = [
  { key: 'scan', label: 'Ny analys' },
  { key: 'vinforslag', label: 'Vinförslag' },
  { key: 'pairings', label: 'Pairings' },
];

export default function FoodScanPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scan');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6" />
          Matcha menyn
        </h1>
        <p className="text-gray-500 mt-1">
          Analysera restaurangmenyer och föreslå viner från era importörer
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

      {activeTab === 'scan' && (
        <ScanTab onNavigateToVinforslag={() => setActiveTab('vinforslag')} />
      )}
      {activeTab === 'vinforslag' && <VinforslagTab />}
      {activeTab === 'pairings' && <PairingsTab />}
    </div>
  );
}

// ============================================================================
// Tab 1: Ny analys (Wolt search + PDF upload + scan result with CTA)
// ============================================================================

function ScanTab({ onNavigateToVinforslag }: { onNavigateToVinforslag: () => void }) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [venues, setVenues] = useState<WoltVenue[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfRestaurantName, setPdfRestaurantName] = useState('');
  const [scanningPdf, setScanningPdf] = useState(false);

  // CTA state
  const [generating, setGenerating] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setPdfFile(acceptedFiles[0]);
      }
    },
    onDropRejected: (rejections) => {
      const r = rejections[0];
      if (r?.errors[0]?.code === 'file-too-large') {
        setError('Filen är för stor. Max 10 MB.');
      } else {
        setError('Bara PDF-filer stöds.');
      }
    },
  });

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

  const handlePdfScan = useCallback(async () => {
    if (!pdfFile || !pdfRestaurantName.trim()) return;
    setScanningPdf(true);
    setError(null);
    setScanResult(null);

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('restaurant_name', pdfRestaurantName.trim());

      const res = await fetch('/api/admin/food-scan/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'PDF-analys misslyckades');
      setScanResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanningPdf(false);
    }
  }, [pdfFile, pdfRestaurantName]);

  const handleGenerateRecommendation = useCallback(async (scanId: string) => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/food-scan/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_result_id: scanId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Kunde inte generera vinförslag');
      onNavigateToVinforslag();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [onNavigateToVinforslag]);

  const isLoading = searching || scanning || scanningPdf;

  return (
    <div className="space-y-6">
      {/* Wolt search form */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Sök restaurang på Wolt..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]"
        />
        <select
          value={city}
          onChange={e => setCity(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Alla</option>
          <option value="stockholm">Stockholm</option>
          <option value="göteborg">Göteborg</option>
          <option value="malmö">Malmö</option>
          <option value="uppsala">Uppsala</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-4 py-2 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center gap-2"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Sök
        </button>
      </div>

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
                disabled={isLoading}
                className="px-3 py-1.5 bg-[#722F37] text-white rounded text-xs font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center gap-1"
              >
                {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
                Analysera meny
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-gray-500">eller ladda upp meny-PDF</span>
        </div>
      </div>

      {/* PDF upload section */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Restaurangnamn</label>
          <input
            type="text"
            value={pdfRestaurantName}
            onChange={e => setPdfRestaurantName(e.target.value)}
            placeholder="t.ex. Restaurang Natur"
            className="w-full px-3 py-2 border rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#722F37]"
          />
        </div>

        {pdfFile ? (
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <FileUp className="h-4 w-4 text-[#722F37]" />
            <span className="text-sm text-gray-700 truncate flex-1">{pdfFile.name}</span>
            <span className="text-xs text-gray-400">{(pdfFile.size / 1024).toFixed(0)} KB</span>
            <button
              onClick={() => setPdfFile(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isDragActive
                ? 'border-[#722F37] bg-[#722F37]/5'
                : 'border-gray-200 hover:border-[#722F37]/40 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className={`h-8 w-8 ${isDragActive ? 'text-[#722F37]' : 'text-gray-400'}`} />
            {isDragActive ? (
              <p className="text-sm text-[#722F37] font-medium">Släpp PDF här...</p>
            ) : (
              <>
                <p className="text-sm text-gray-600">Dra och släpp en PDF här, eller klicka för att välja</p>
                <p className="text-xs text-gray-400">Max 10 MB</p>
              </>
            )}
          </div>
        )}

        <button
          onClick={handlePdfScan}
          disabled={isLoading || !pdfRestaurantName.trim() || !pdfFile}
          className="px-4 py-2 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center gap-2"
        >
          {scanningPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {scanningPdf ? 'Analyserar PDF...' : 'Analysera PDF'}
        </button>

        {/* Validation hints */}
        {pdfFile && !pdfRestaurantName.trim() && (
          <p className="text-xs text-amber-600">Fyll i restaurangnamn ovan för att fortsätta.</p>
        )}
        {!pdfFile && pdfRestaurantName.trim() && (
          <p className="text-xs text-gray-400">Ladda upp en PDF-meny för att fortsätta.</p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Scan result + CTA */}
      {scanResult && (
        <ScanResultView
          result={scanResult}
          onGenerateRecommendation={scanResult.id ? () => handleGenerateRecommendation(scanResult.id!) : undefined}
          generating={generating}
        />
      )}
    </div>
  );
}

function ScanResultView({
  result,
  onGenerateRecommendation,
  generating,
}: {
  result: ScanResult;
  onGenerateRecommendation?: () => void;
  generating?: boolean;
}) {
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

      {/* CTA: Generate wine recommendation */}
      {onGenerateRecommendation && matchRate >= 30 && (
        <button
          onClick={onGenerateRecommendation}
          disabled={generating}
          className="w-full px-4 py-3 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wine className="h-4 w-4" />
          )}
          {generating ? 'Genererar vinförslag...' : 'Generera vinförslag'}
          {!generating && <ChevronRight className="h-4 w-4" />}
        </button>
      )}
      {onGenerateRecommendation && matchRate < 30 && (
        <p className="text-sm text-amber-600 text-center">
          Matchgraden är för låg för vinförslag. Ladda upp en mer detaljerad meny.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Tab 2: Vinförslag (merged History + Outreach)
// ============================================================================

function VinforslagTab() {
  // Recommendations state
  const [recommendations, setRecommendations] = useState<RecommendationHistoryItem[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const recRes = await fetch('/api/admin/food-scan/recommend').then(r => r.json()).catch(() => ({ recommendations: [] }));
    setRecommendations(recRes.recommendations || []);
    setLoadingRecs(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (recId: string) => {
    if (!confirm('Radera detta vinförslag?')) return;
    try {
      const res = await fetch(`/api/admin/food-scan/recommend/${recId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Radering misslyckades');
      setRecommendations(prev => prev.filter(r => r.id !== recId));
      showToast('Vinförslag raderat');
    } catch (err: any) {
      showToast(`Fel: ${err.message}`);
    }
  };

  const startSend = (rec: RecommendationHistoryItem) => {
    setExpandedId(rec.id);
    setEditSubject(rec.email_subject || '');
    setEditRecipient(rec.recipient_email || '');
  };

  const handleSend = async (recId: string) => {
    if (!editRecipient.trim()) {
      showToast('Ange mottagarens email');
      return;
    }
    setSendingId(recId);
    try {
      const res = await fetch('/api/admin/food-scan/recommend/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation_id: recId,
          recipient_email: editRecipient.trim(),
          subject: editSubject.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Skickandet misslyckades');
      showToast('Email skickad!');
      setExpandedId(null);
      fetchAll();
    } catch (err: any) {
      showToast(`Fel: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  const loading = loadingRecs;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Wine className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Inga vinförslag ännu.</p>
        <p className="text-sm mt-1">Gå till &quot;Ny analys&quot; och analysera en restaurangmeny för att komma igång.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed top-4 right-4 bg-[#722F37] text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Recommendations (ready to review & send) */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Vinförslag ({recommendations.length})
          </h3>
          {recommendations.map(rec => {
            const wines: RecommendedWine[] = Array.isArray(rec.recommended_wines) ? rec.recommended_wines : [];
            const isExpanded = expandedId === rec.id;

            return (
              <div key={rec.id} className="border rounded-lg overflow-hidden">
                {/* Header row */}
                <div className="p-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">{rec.restaurant_name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(rec.created_at).toLocaleDateString('sv-SE')} | {wines.length} viner
                      {rec.dominant_styles?.length > 0 && ` | ${rec.dominant_styles.join(', ')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.status === 'sent' ? (
                      <button
                        onClick={() => isExpanded ? setExpandedId(null) : setExpandedId(rec.id)}
                        className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium flex items-center gap-1 hover:bg-emerald-200 transition-colors"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Skickad {rec.sent_at ? new Date(rec.sent_at).toLocaleDateString('sv-SE') : ''}
                        {rec.recipient_email && <span className="text-emerald-500 ml-1">→ {rec.recipient_email}</span>}
                      </button>
                    ) : rec.status === 'failed' ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        Misslyckad
                      </span>
                    ) : (
                      <button
                        onClick={() => isExpanded ? setExpandedId(null) : startSend(rec)}
                        className="px-3 py-1.5 bg-[#722F37] text-white rounded text-xs font-medium hover:bg-[#5a252c] flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" />
                        {isExpanded ? 'Stäng' : 'Granska & skicka'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Radera vinförslag"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: wine cards + send form (only for drafts) */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    <div className="grid gap-2">
                      {wines.map((w, i) => (
                        <div key={i} className="bg-white border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-sm">{w.name}{w.vintage ? ` ${w.vintage}` : ''}</div>
                              <div className="text-xs text-gray-500">{w.producer}{w.grape ? ` · ${w.grape}` : ''}</div>
                            </div>
                            <div className="text-sm font-medium text-[#722F37]">{Math.round(w.priceExVat / 100)} kr</div>
                          </div>
                          {w.matchedDishes && w.matchedDishes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {w.matchedDishes.map((dish, di) => (
                                <span key={di} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs">
                                  {dish}
                                </span>
                              ))}
                            </div>
                          )}
                          {w.reason && (
                            <div className="text-xs text-gray-600 mt-2 italic">{w.reason}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Send form — only for drafts, not already sent */}
                    {rec.status !== 'sent' && rec.status !== 'failed' && (
                      <div className="space-y-3 pt-2 border-t">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Ämnesrad</label>
                          <input
                            type="text"
                            value={editSubject}
                            onChange={e => setEditSubject(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Mottagare (email)</label>
                          <input
                            type="email"
                            value={editRecipient}
                            onChange={e => setEditRecipient(e.target.value)}
                            placeholder="restaurang@example.com"
                            className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSend(rec.id)}
                            disabled={sendingId === rec.id || !editRecipient.trim()}
                            className="px-4 py-2 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#5a252c] disabled:opacity-50 flex items-center gap-2"
                          >
                            {sendingId === rec.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            Skicka email
                          </button>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ============================================================================
// Tab 3: Pairings (pairing suggestions review)
// ============================================================================

function PairingsTab() {
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
        Inga väntande pairings att granska.
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
        {suggestions.length} väntande pairings
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
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300"
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
