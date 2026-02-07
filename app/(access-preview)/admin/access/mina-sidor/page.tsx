/**
 * VINKOLL ACCESS - Consumer Dashboard
 *
 * /admin/access/mina-sidor
 *
 * Requests + watchlists + logout
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Trash2, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { RequestWithWine, WatchlistWithTarget } from '@/lib/access-types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Väntande', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  accepted: { label: 'Accepterad', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  declined: { label: 'Nekad', color: 'bg-red-100 text-red-800', icon: XCircle },
  expired: { label: 'Utgången', color: 'bg-gray-100 text-gray-600', icon: AlertCircle },
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  wine: 'Vin',
  producer: 'Producent',
  free_text: 'Fritextbevakning',
};

export default function MinaSidorPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestWithWine[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New watchlist form
  const [showWatchlistForm, setShowWatchlistForm] = useState(false);
  const [watchlistType, setWatchlistType] = useState('free_text');
  const [watchlistNote, setWatchlistNote] = useState('');
  const [watchlistSubmitting, setWatchlistSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqRes, wlRes] = await Promise.all([
        fetch('/api/admin/access/requests'),
        fetch('/api/admin/access/watchlists'),
      ]);

      if (reqRes.status === 401 || wlRes.status === 401) {
        router.push('/admin/access/login?redirect=/admin/access/mina-sidor');
        return;
      }

      if (!reqRes.ok || !wlRes.ok) throw new Error('Failed to fetch data');

      const [reqData, wlData] = await Promise.all([
        reqRes.json(),
        wlRes.json(),
      ]);

      setRequests(reqData);
      setWatchlists(wlData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch('/api/admin/access/auth/logout', { method: 'POST' });
    router.push('/admin/access');
  };

  const handleDeleteWatchlist = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/access/watchlists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWatchlists((prev) => prev.filter((wl) => wl.id !== id));
      }
    } catch (err) {
      console.error('Delete watchlist error:', err);
    }
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchlistNote.trim()) return;

    setWatchlistSubmitting(true);
    try {
      const res = await fetch('/api/admin/access/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: watchlistType,
          note: watchlistNote,
        }),
      });

      if (res.ok) {
        setShowWatchlistForm(false);
        setWatchlistNote('');
        fetchData();
      }
    } catch (err) {
      console.error('Create watchlist error:', err);
    } finally {
      setWatchlistSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={fetchData} className="text-[#722F37] hover:underline">Försök igen</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Mina sidor</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logga ut
        </button>
      </div>

      {/* ================================================================== */}
      {/* REQUESTS */}
      {/* ================================================================== */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Mina förfrågningar
          {requests.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">({requests.length})</span>
          )}
        </h2>

        {requests.length === 0 ? (
          <div className="bg-muted/50 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Du har inga förfrågningar ännu.</p>
            <Link href="/admin/access/viner" className="text-[#722F37] hover:underline text-sm mt-2 inline-block">
              Utforska viner
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;
              return (
                <div key={req.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      {req.wine ? (
                        <Link
                          href={`/admin/access/vin/${req.wine.id}`}
                          className="font-semibold text-foreground hover:text-[#722F37] transition-colors"
                        >
                          {req.wine.name}
                          {req.wine.vintage && <span className="text-muted-foreground font-normal ml-1">{req.wine.vintage}</span>}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">Förfrågan</span>
                      )}
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {req.importer_name || 'Importör'} &middot; {req.quantity} flaskor
                      </p>
                      {req.message && (
                        <p className="text-sm text-muted-foreground/70 mt-1 italic">&ldquo;{req.message}&rdquo;</p>
                      )}
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusConfig.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Skickad {new Date(req.created_at).toLocaleDateString('sv-SE')}
                    {req.expires_at && (
                      <span> &middot; Giltig till {new Date(req.expires_at).toLocaleDateString('sv-SE')}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* WATCHLISTS */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Mina bevakningar
            {watchlists.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">({watchlists.length})</span>
            )}
          </h2>
          <button
            onClick={() => setShowWatchlistForm(!showWatchlistForm)}
            className="flex items-center gap-1 text-sm text-[#722F37] hover:text-[#5a252c] font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny bevakning
          </button>
        </div>

        {/* Inline new watchlist form */}
        {showWatchlistForm && (
          <form onSubmit={handleCreateWatchlist} className="bg-card border border-rose-200 rounded-lg p-4 mb-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Typ</label>
                <select
                  value={watchlistType}
                  onChange={(e) => setWatchlistType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="free_text">Fritext (beskriv vad du letar efter)</option>
                  <option value="wine">Specifikt vin</option>
                  <option value="producer">Producent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Beskrivning</label>
                <input
                  type="text"
                  required
                  placeholder="T.ex. &ldquo;Naturvin från Loire under 200 kr&rdquo;"
                  value={watchlistNote}
                  onChange={(e) => setWatchlistNote(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={watchlistSubmitting}
                  className="bg-[#722F37] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5a252c] transition-colors disabled:opacity-50"
                >
                  {watchlistSubmitting ? 'Skapar...' : 'Skapa bevakning'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWatchlistForm(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </form>
        )}

        {watchlists.length === 0 && !showWatchlistForm ? (
          <div className="bg-muted/50 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Du har inga bevakningar ännu.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Skapa en bevakning för att bli notifierad när nya viner dyker upp.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {watchlists.map((wl) => (
              <div key={wl.id} className="bg-card border border-border rounded-lg p-4 flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {TARGET_TYPE_LABELS[wl.target_type] || wl.target_type}
                  </span>
                  <p className="font-medium text-foreground mt-0.5">
                    {wl.note || wl.wine?.name || wl.producer?.name || 'Bevakning'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Skapad {new Date(wl.created_at).toLocaleDateString('sv-SE')}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteWatchlist(wl.id)}
                  className="text-muted-foreground hover:text-red-600 transition-colors p-1"
                  title="Ta bort bevakning"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
