'use client';

import { useEffect, useState, useCallback } from 'react';
import { openCriteriaBadges, type OpenCriteria } from '@/lib/matching-agent/open-request-fanout';

interface OpenRequest {
  id: string;
  restaurant_id: string;
  fritext: string;
  budget_per_flaska: number | null;
  antal_flaskor: number | null;
  status: string;
  open_criteria: Record<string, unknown> | null;
  created_at: string;
  restaurant: { id: string; name: string; city: string | null } | null;
}

interface PreviewSupplier {
  supplier_id: string;
  name: string;
  email: string | null;
  match_count: number;
}

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'PENDING_REVIEW', label: 'Väntar granskning' },
  { key: 'OPEN', label: 'Godkända' },
  { key: 'REJECTED', label: 'Avvisade' },
];

export default function AdminOpenRequestsPage() {
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ id: string; suppliers: PreviewSupplier[]; total: number } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/requests/open?status=${status}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Kunde inte hämta');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      STATUS_TABS.map(async tab => {
        try {
          const r = await fetch(`/api/admin/requests/open?status=${tab.key}`);
          if (!r.ok) return [tab.key, 0] as const;
          const d = await r.json();
          return [tab.key, (d.requests || []).length] as const;
        } catch {
          return [tab.key, 0] as const;
        }
      })
    );
    setCounts(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, requests]);

  async function openPreview(id: string) {
    setPreviewing({ id, suppliers: [], total: 0 });
    try {
      const res = await fetch(`/api/admin/requests/${id}/preview`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunde inte ladda preview');
        setPreviewing(null);
        return;
      }
      setPreviewing({ id, suppliers: data.suppliers || [], total: data.total_matching_wines || 0 });
    } catch (err: any) {
      setError(err.message);
      setPreviewing(null);
    }
  }

  async function confirmApprove() {
    if (!previewing) return;
    const id = previewing.id;
    setActioningId(id);
    setPreviewing(null);
    try {
      const res = await fetch(`/api/admin/requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Godkännande misslyckades');
        return;
      }
      setFlash(
        `Godkänd — skickad till ${data.fanout.assignments_created} leverantör(er) (${data.fanout.total_matching_wines} matchande viner, ${data.emails_sent || 0} mail)`
      );
      await fetchRequests();
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Avvisa denna förfrågan?')) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Avvisning misslyckades');
        return;
      }
      setFlash('Avvisad');
      await fetchRequests();
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Öppna förfrågningar</h1>
      <p className="text-slate-600 mb-6">
        Granska broadcast-förfrågningar innan de skickas ut till leverantörer.
      </p>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {STATUS_TABS.map(tab => {
          const count = counts[tab.key];
          const active = status === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors flex items-center gap-2 ${
                active
                  ? 'border-[#93092b] text-[#93092b]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-[#93092b] text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {flash && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          {flash}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500">Laddar...</div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center text-slate-500">Inga förfrågningar i detta läge.</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {req.restaurant?.name || 'Okänd restaurang'}
                    {req.restaurant?.city && (
                      <span className="text-slate-500 font-normal"> · {req.restaurant.city}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(req.created_at).toLocaleString('sv-SE')}
                  </div>
                </div>
                {status === 'PENDING_REVIEW' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actioningId === req.id}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Avvisa
                    </button>
                    <button
                      onClick={() => openPreview(req.id)}
                      disabled={actioningId === req.id}
                      className="px-4 py-1.5 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                      style={{ background: '#93092b' }}
                    >
                      {actioningId === req.id ? 'Arbetar...' : 'Granska & skicka'}
                    </button>
                  </div>
                )}
              </div>
              {req.open_criteria && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {openCriteriaBadges(req.open_criteria as OpenCriteria).map((b, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#93092b]/10 text-[#93092b] border border-[#93092b]/20">
                      {b}
                    </span>
                  ))}
                </div>
              )}
              {req.open_criteria && typeof (req.open_criteria as OpenCriteria).free_text === 'string' && (
                <p className="text-sm text-slate-700 italic mt-2">&ldquo;{(req.open_criteria as OpenCriteria).free_text}&rdquo;</p>
              )}
            </div>
          ))}
        </div>
      )}

      {previewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setPreviewing(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Granska innan utskick</h2>
              {previewing.suppliers.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Laddar matchande leverantörer...</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    <strong>{previewing.suppliers.length}</strong> leverantör(er) får denna förfrågan via mail · totalt <strong>{previewing.total}</strong> matchande viner i deras kataloger
                  </p>
                  <div className="space-y-2 mb-6 max-h-80 overflow-y-auto">
                    {previewing.suppliers.map(s => (
                      <div key={s.supplier_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{s.name}</div>
                          {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                        </div>
                        <span className="text-xs text-slate-500">{s.match_count} viner</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPreviewing(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmApprove}
                  disabled={previewing.suppliers.length === 0}
                  className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ background: '#93092b' }}
                >
                  Skicka till {previewing.suppliers.length} leverantör(er)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
