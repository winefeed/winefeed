/**
 * ADMIN PROPOSALS PAGE
 *
 * /admin/proposals
 *
 * Create, manage and track wine proposals sent to restaurants.
 * View responses and copy shareable links.
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles, Plus, Copy, ExternalLink, RefreshCw, Trash2,
  ChevronDown, ChevronUp, Mail, Clock, Check, Wine, Search, X,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ProposalWineItem {
  id: string;
  supplier_wine_id: string;
  reason: string | null;
  sort_order: number;
  supplier_wines: {
    id: string;
    name: string;
    vintage: string | null;
    supplier: { namn: string } | null;
  } | null;
}

interface ProposalResponse {
  id: string;
  contact_name: string;
  contact_email: string;
  interested_wine_ids: string[] | null;
  created_at: string;
}

interface Proposal {
  id: string;
  restaurant_name: string;
  restaurant_city: string | null;
  message: string | null;
  expires_at: string | null;
  created_at: string;
  share_url: string;
  full_url?: string;
  response_count: number;
  wine_count: number;
  is_expired: boolean;
  wine_proposal_items: ProposalWineItem[];
  wine_proposal_responses: ProposalResponse[];
}

interface AvailableWine {
  id: string;
  name: string;
  vintage: string | null;
  grape_variety: string | null;
  region: string | null;
  country: string | null;
  supplierName: string;
}

// ============================================================================
// Main component
// ============================================================================

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/proposals');
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : []);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProposals(); }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const copyLink = (url: string) => {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(full);
    setToast('Länk kopierad!');
  };

  const deleteProposal = async (id: string) => {
    if (!confirm('Ta bort detta vinförslag?')) return;
    await fetch(`/api/admin/proposals/${id}`, { method: 'DELETE' });
    setProposals(prev => prev.filter(p => p.id !== id));
    setToast('Förslaget borttaget');
  };

  const activeCount = proposals.filter(p => !p.is_expired).length;
  const totalResponses = proposals.reduce((sum, p) => sum + p.response_count, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Vinförslag
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Skapa personliga vinförslag och skicka till restauranger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchProposals} className="p-2 text-muted-foreground hover:text-muted-foreground rounded-lg hover:bg-accent">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Nytt förslag
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Totalt</p>
          <p className="text-2xl font-bold">{proposals.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Aktiva</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Svar</p>
          <p className="text-2xl font-bold text-primary">{totalResponses}</p>
        </div>
      </div>

      {/* Proposals list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laddar...</div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-lg">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Inga vinförslag ännu</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
          >
            Skapa ditt första förslag
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onCopyLink={() => copyLink(p.share_url)}
              onDelete={() => deleteProposal(p.id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateProposalModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setProposals(prev => [p, ...prev]);
            setShowCreate(false);
            setToast('Vinförslag skapat!');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-50">
          <Check className="h-4 w-4 text-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Proposal Card
// ============================================================================

function ProposalCard({
  proposal: p,
  expanded,
  onToggle,
  onCopyLink,
  onDelete,
}: {
  proposal: Proposal;
  expanded: boolean;
  onToggle: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground truncate">{p.restaurant_name}</span>
              {p.restaurant_city && (
                <span className="text-sm text-muted-foreground">{p.restaurant_city}</span>
              )}
              {p.is_expired && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Utgången</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wine className="h-3 w-3" />
                {p.wine_count} viner
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {p.response_count} svar
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(p.created_at).toLocaleDateString('sv-SE')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onCopyLink(); }}
            className="p-2 text-muted-foreground hover:text-primary rounded hover:bg-accent"
            title="Kopiera länk"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); window.open(p.share_url, '_blank'); }}
            className="p-2 text-muted-foreground hover:text-primary rounded hover:bg-accent"
            title="Öppna förslaget"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-muted-foreground hover:text-red-500 rounded hover:bg-accent"
            title="Ta bort"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-4">
          {/* Message */}
          {p.message && (
            <div className="text-sm text-muted-foreground bg-muted rounded p-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Meddelande</span>
              <p className="mt-1">{p.message}</p>
            </div>
          )}

          {/* Wines */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Viner</h4>
            <div className="space-y-1">
              {p.wine_proposal_items?.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-muted">
                  <span className="text-foreground">
                    {item.supplier_wines?.name || 'Okänt vin'}
                    {item.supplier_wines?.vintage && ` ${item.supplier_wines.vintage}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.supplier_wines?.supplier?.namn || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Responses */}
          {p.wine_proposal_responses && p.wine_proposal_responses.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Svar ({p.wine_proposal_responses.length})
              </h4>
              <div className="space-y-2">
                {p.wine_proposal_responses.map(r => (
                  <div key={r.id} className="border rounded p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.contact_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{r.contact_email}</p>
                    {r.interested_wine_ids && r.interested_wine_ids.length > 0 && (
                      <p className="mt-1 text-xs text-green-700">
                        Intresserad av {r.interested_wine_ids.length} vin{r.interested_wine_ids.length > 1 ? 'er' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share link */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}${p.share_url}`}
              className="flex-1 text-xs text-muted-foreground bg-muted border rounded px-3 py-2 select-all"
            />
            <button
              onClick={onCopyLink}
              className="px-3 py-2 text-xs bg-primary text-white rounded hover:bg-primary/90"
            >
              Kopiera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Create Proposal Modal
// ============================================================================

function CreateProposalModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (proposal: Proposal) => void;
}) {
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantCity, setRestaurantCity] = useState('');
  const [message, setMessage] = useState('');
  const [expiresIn, setExpiresIn] = useState('14'); // days
  const [selectedWineIds, setSelectedWineIds] = useState<string[]>([]);
  const [wines, setWines] = useState<AvailableWine[]>([]);
  const [wineSearch, setWineSearch] = useState('');
  const [loadingWines, setLoadingWines] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available wines
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/wines?limit=500');
        const data = await res.json();
        setWines(Array.isArray(data) ? data : data.wines || []);
      } catch {
        setWines([]);
      } finally {
        setLoadingWines(false);
      }
    })();
  }, []);

  const filteredWines = wineSearch.trim()
    ? wines.filter(w => {
        const _strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const q = _strip(wineSearch);
        return (
          _strip(w.name || '').includes(q) ||
          _strip(w.grape_variety || '').includes(q) ||
          _strip(w.region || '').includes(q) ||
          _strip(w.country || '').includes(q) ||
          _strip(w.supplierName || '').includes(q)
        );
      })
    : wines;

  const toggleWine = (id: string) => {
    setSelectedWineIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!restaurantName.trim()) { setError('Ange restaurangens namn'); return; }
    if (selectedWineIds.length === 0) { setError('Välj minst ett vin'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const expiresAt = expiresIn
        ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: restaurantName.trim(),
          restaurant_city: restaurantCity.trim() || null,
          message: message.trim() || null,
          expires_at: expiresAt,
          wine_ids: selectedWineIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refetch to get full enriched proposal
      const listRes = await fetch('/api/admin/proposals');
      const list = await listRes.json();
      const created = list.find((p: any) => p.id === data.id);
      onCreated(created || data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[10vh] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-12">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Nytt vinförslag</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Restaurant info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Restaurang *</label>
              <input
                type="text"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                placeholder="Restaurangens namn"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Stad</label>
              <input
                type="text"
                value={restaurantCity}
                onChange={e => setRestaurantCity(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                placeholder="Stockholm"
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Meddelande (valfritt)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary resize-none"
              placeholder="Personligt meddelande till restaurangen..."
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Giltighetstid</label>
            <select
              value={expiresIn}
              onChange={e => setExpiresIn(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary"
            >
              <option value="7">7 dagar</option>
              <option value="14">14 dagar</option>
              <option value="30">30 dagar</option>
              <option value="90">90 dagar</option>
              <option value="">Ingen utgångsdatum</option>
            </select>
          </div>

          {/* Wine selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Välj viner ({selectedWineIds.length} valda)
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={wineSearch}
                onChange={e => setWineSearch(e.target.value)}
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-primary focus:border-primary"
                placeholder="Sök vin, druva, region, leverantör..."
              />
            </div>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {loadingWines ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Laddar viner...</p>
              ) : filteredWines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Inga viner hittades</p>
              ) : (
                filteredWines.map(w => {
                  const selected = selectedWineIds.includes(w.id);
                  return (
                    <label
                      key={w.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent border-b last:border-0 ${
                        selected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleWine(w.id)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-foreground">
                          {w.name}{w.vintage ? ` ${w.vintage}` : ''}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {[w.grape_variety, w.region, w.supplierName].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Skapar...' : 'Skapa förslag'}
          </button>
        </div>
      </div>
    </div>
  );
}
