'use client';

import { useEffect, useState, useCallback } from 'react';

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

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'PENDING_REVIEW', label: 'Väntar granskning' },
  { key: 'OPEN', label: 'Godkända' },
  { key: 'REJECTED', label: 'Avvisade' },
];

export default function AdminOpenRequestsPage() {
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleApprove(id: string) {
    if (!confirm('Godkänn och skicka ut till matchande leverantörer?')) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Godkännande misslyckades');
        return;
      }
      setFlash(
        `Godkänd — skickad till ${data.fanout.assignments_created} leverantör(er) (${data.fanout.total_matching_wines} matchande viner)`
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
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              status === tab.key
                ? 'border-[#93092b] text-[#93092b]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
                      onClick={() => handleApprove(req.id)}
                      disabled={actioningId === req.id}
                      className="px-4 py-1.5 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                      style={{ background: '#93092b' }}
                    >
                      {actioningId === req.id ? 'Arbetar...' : 'Godkänn & skicka'}
                    </button>
                  </div>
                )}
              </div>
              <div className="text-slate-800 mb-3">{req.fritext}</div>
              {req.open_criteria && (
                <pre className="text-xs bg-slate-50 rounded p-3 overflow-x-auto text-slate-600">
                  {JSON.stringify(req.open_criteria, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
