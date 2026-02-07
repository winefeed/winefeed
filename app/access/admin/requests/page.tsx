'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AdminRequest {
  id: string;
  status: 'pending' | 'seen' | 'accepted' | 'declined' | 'expired';
  quantity: number;
  message: string | null;
  forwarded_at: string | null;
  responded_at: string | null;
  consumer_notified_at: string | null;
  order_confirmed_at: string | null;
  response_price_sek: number | null;
  response_quantity: number | null;
  response_delivery_days: number | null;
  response_note: string | null;
  created_at: string;
  consumer: { id: string; name: string | null; email: string; phone: string | null };
  wine: { id: string; name: string; wine_type: string; vintage: number | null; country: string | null; region: string | null; grape: string | null } | null;
  importer: { id: string | null; name: string; contact_email: string | null } | null;
  lot_price_sek: number | null;
}

type FilterStatus = 'action' | 'all' | 'new' | 'forwarded' | 'responded' | 'notified' | 'completed';

// ============================================================================
// Helpers
// ============================================================================

function getStatusLabel(r: AdminRequest): { label: string; color: string; pulse?: boolean } {
  if (r.status === 'expired') return { label: 'Utgången', color: 'bg-gray-200 text-gray-600' };
  if (r.order_confirmed_at) {
    return { label: 'Slutförd', color: 'bg-green-200 text-green-900' };
  }
  if ((r.status === 'accepted' || r.status === 'declined') && r.consumer_notified_at) {
    return { label: 'Meddelad', color: 'bg-gray-200 text-gray-600' };
  }
  if (r.status === 'accepted' && !r.consumer_notified_at) {
    return { label: 'Besvarad — Ja', color: 'bg-green-100 text-green-800', pulse: true };
  }
  if (r.status === 'declined' && !r.consumer_notified_at) {
    return { label: 'Besvarad — Nej', color: 'bg-red-100 text-red-800', pulse: true };
  }
  if (r.status === 'seen') return { label: 'Sedd av importör', color: 'bg-blue-100 text-blue-800' };
  if (r.status === 'pending' && r.forwarded_at) return { label: 'Vidareskickad', color: 'bg-blue-100 text-blue-700' };
  if (r.status === 'pending' && !r.forwarded_at) return { label: 'Ny', color: 'bg-yellow-100 text-yellow-800' };
  return { label: r.status, color: 'bg-gray-100 text-gray-600' };
}

function matchesFilter(r: AdminRequest, filter: FilterStatus): boolean {
  if (filter === 'all') return true;
  if (filter === 'action') {
    const isNew = r.status === 'pending' && !r.forwarded_at;
    const isResponded = (r.status === 'accepted' || r.status === 'declined') && !r.consumer_notified_at;
    return isNew || isResponded;
  }
  if (filter === 'new') return r.status === 'pending' && !r.forwarded_at;
  if (filter === 'forwarded') return (r.status === 'pending' || r.status === 'seen') && !!r.forwarded_at;
  if (filter === 'responded') return (r.status === 'accepted' || r.status === 'declined') && !r.consumer_notified_at;
  if (filter === 'notified') return !!r.consumer_notified_at && !r.order_confirmed_at;
  if (filter === 'completed') return !!r.order_confirmed_at;
  return true;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getOrderValue(r: AdminRequest): { value: number | null; source: 'response' | 'lot' | null } {
  const price = r.response_price_sek || r.lot_price_sek;
  if (!price) return { value: null, source: null };
  const qty = r.response_quantity || r.quantity;
  return { value: price * qty, source: r.response_price_sek ? 'response' : 'lot' };
}

function formatSEK(value: number): string {
  return value.toLocaleString('sv-SE') + ' kr';
}

// ============================================================================
// Component
// ============================================================================

export default function AdminRequestsCockpit() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('action');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [forwardEmail, setForwardEmail] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/access/admin-requests');
      if (res.status === 401) {
        window.location.href = '/login?redirect=/access/admin/requests';
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRequests(data.requests || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Pre-fill importer emails from contact_email when requests load
  useEffect(() => {
    const prefilled: Record<string, string> = {};
    for (const req of requests) {
      if (req.importer?.contact_email && !forwardEmail[req.id]) {
        prefilled[req.id] = req.importer.contact_email;
      }
    }
    if (Object.keys(prefilled).length > 0) {
      setForwardEmail(prev => ({ ...prefilled, ...prev }));
    }
  }, [requests]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const newCount = requests.filter(r => r.status === 'pending' && !r.forwarded_at).length;
  const forwardedCount = requests.filter(r => (r.status === 'pending' || r.status === 'seen') && r.forwarded_at).length;
  const respondedCount = requests.filter(r => (r.status === 'accepted' || r.status === 'declined') && !r.consumer_notified_at).length;
  const totalOrderValue = requests.reduce((sum, r) => sum + (getOrderValue(r).value || 0), 0);

  const filtered = requests.filter(r => matchesFilter(r, filter));

  // Actions
  async function handleForward(reqId: string) {
    const email = forwardEmail[reqId];
    if (!email) {
      alert('Ange importörens e-postadress');
      return;
    }
    setActionLoading(reqId);
    try {
      const res = await fetch(`/api/admin/access/admin-requests/${reqId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importer_email: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Något gick fel');
        return;
      }
      setExpandedId(null);
      showToast('Förfrågan vidarebefordrad till importören');
      await fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleNotifyConsumer(reqId: string) {
    if (!confirm('Skicka svar till konsumenten?')) return;
    setActionLoading(reqId);
    try {
      const res = await fetch(`/api/admin/access/admin-requests/${reqId}/notify-consumer`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Något gick fel');
        return;
      }
      setExpandedId(null);
      showToast('Konsumenten har meddelats');
      await fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestConfirmation(reqId: string) {
    const req = requests.find(r => r.id === reqId);
    const email = forwardEmail[reqId] || req?.importer?.contact_email;
    if (!email) {
      alert('Ange importörens e-post');
      return;
    }
    setActionLoading(reqId);
    try {
      const res = await fetch(`/api/admin/access/admin-requests/${reqId}/request-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importer_email: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Något gick fel');
        return;
      }
      setExpandedId(null);
      showToast('Bekräftelseförfrågan skickad till importören');
      await fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemind(reqId: string) {
    const email = forwardEmail[reqId];
    if (!email) {
      alert('Ange importörens e-postadress');
      return;
    }
    if (!confirm(`Skicka påminnelse till ${email}? (Ny länk skapas)`)) return;
    setActionLoading(reqId);
    try {
      const res = await fetch(`/api/admin/access/admin-requests/${reqId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importer_email: email, force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Något gick fel');
        return;
      }
      setExpandedId(null);
      showToast('Påminnelse skickad till importören');
      await fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExpire(reqId: string) {
    if (!confirm('Markera som utgången? Går ej att ångra.')) return;
    setActionLoading(reqId);
    try {
      const res = await fetch(`/api/admin/access/admin-requests/${reqId}/expire`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Något gick fel');
        return;
      }
      setExpandedId(null);
      showToast('Förfrågan markerad som utgången');
      await fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Förfrågningar</h1>
          <p className="text-sm text-gray-500 mt-1">Förmedla vinförfrågningar mellan konsumenter och importörer</p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Laddar...' : 'Uppdatera'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Nya" value={newCount} color="bg-yellow-50 border-yellow-200 text-yellow-800" onClick={() => setFilter('new')} />
        <StatCard label="Vidareskickade" value={forwardedCount} color="bg-blue-50 border-blue-200 text-blue-800" onClick={() => setFilter('forwarded')} />
        <StatCard label="Besvarade" value={respondedCount} color="bg-green-50 border-green-200 text-green-800" pulse={respondedCount > 0} onClick={() => setFilter('responded')} />
        <div className="border rounded-lg px-4 py-3 bg-gray-50 border-gray-200 text-gray-800 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFilter('all')}>
          <div className="text-2xl font-bold">{totalOrderValue > 0 ? formatSEK(totalOrderValue) : '—'}</div>
          <div className="text-xs font-medium mt-1">Ordervärde ({requests.length} st)</div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          ['action', `Att göra (${newCount + respondedCount})`],
          ['all', 'Alla'],
          ['new', `Nya (${newCount})`],
          ['forwarded', `Vidareskickade (${forwardedCount})`],
          ['responded', `Besvarade (${respondedCount})`],
          ['notified', 'Meddelade'],
          ['completed', 'Slutförda'],
        ] as [FilterStatus, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === key
                ? 'bg-[#722F37] text-white border-[#722F37]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Request table */}
      {loading && requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Laddar förfrågningar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Inga förfrågningar matchar filtret</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Vin</th>
                <th className="px-4 py-3 font-medium text-gray-600">Konsument</th>
                <th className="px-4 py-3 font-medium text-gray-600">Importör</th>
                <th className="px-4 py-3 font-medium text-gray-600">Ordervärde</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Datum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const status = getStatusLabel(req);
                const isExpanded = expandedId === req.id;
                return (
                  <RequestRow
                    key={req.id}
                    req={req}
                    status={status}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : req.id)}
                    actionLoading={actionLoading === req.id}
                    forwardEmailValue={forwardEmail[req.id] || ''}
                    onForwardEmailChange={(v) => setForwardEmail(prev => ({ ...prev, [req.id]: v }))}
                    onForward={() => handleForward(req.id)}
                    onNotifyConsumer={() => handleNotifyConsumer(req.id)}
                    onRequestConfirmation={() => handleRequestConfirmation(req.id)}
                    onRemind={() => handleRemind(req.id)}
                    onExpire={() => handleExpire(req.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value, color, pulse, onClick }: { label: string; value: number; color: string; pulse?: boolean; onClick?: () => void }) {
  return (
    <div className={`border rounded-lg px-4 py-3 ${color} cursor-pointer hover:opacity-80 transition-opacity`} onClick={onClick}>
      <div className={`text-2xl font-bold ${pulse ? 'animate-pulse' : ''}`}>{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}

function RequestRow({
  req, status, isExpanded, onToggle, actionLoading,
  forwardEmailValue, onForwardEmailChange, onForward,
  onNotifyConsumer, onRequestConfirmation, onRemind, onExpire,
}: {
  req: AdminRequest;
  status: { label: string; color: string; pulse?: boolean };
  isExpanded: boolean;
  onToggle: () => void;
  actionLoading: boolean;
  forwardEmailValue: string;
  onForwardEmailChange: (v: string) => void;
  onForward: () => void;
  onNotifyConsumer: () => void;
  onRequestConfirmation: () => void;
  onRemind: () => void;
  onExpire: () => void;
}) {
  const rowBg =
    req.status === 'expired' || req.consumer_notified_at ? 'bg-gray-50' :
    (req.status === 'accepted' || req.status === 'declined') && !req.consumer_notified_at ? 'bg-emerald-50' :
    (req.status === 'pending' || req.status === 'seen') && req.forwarded_at ? 'bg-sky-50' :
    '';

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-t border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors ${rowBg}`}
      >
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">
            {req.wine?.name || 'Okänt vin'}
            {req.wine?.vintage && !req.wine.name.includes(String(req.wine.vintage)) ? ` ${req.wine.vintage}` : ''}
          </div>
          <div className="text-xs text-gray-500">{req.wine?.wine_type} {req.wine?.grape ? `· ${req.wine.grape}` : ''}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-gray-900">{req.consumer.name || req.consumer.email}</div>
          <div className="text-xs text-gray-500">{req.quantity} fl</div>
        </td>
        <td className="px-4 py-3 text-gray-700">
          {req.importer?.name || '—'}
        </td>
        <td className="px-4 py-3">
          {(() => {
            const ov = getOrderValue(req);
            if (!ov.value) return <span className="text-gray-400 text-xs">—</span>;
            const unitPrice = req.response_price_sek || req.lot_price_sek;
            const qty = req.response_quantity || req.quantity;
            return (
              <div>
                <div className="font-medium text-gray-900 text-sm">{formatSEK(ov.value)}</div>
                <div className="text-xs text-gray-400">{qty} × {unitPrice} kr · {ov.source === 'response' ? 'Bekräftat' : 'Est.'}</div>
              </div>
            );
          })()}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}>
            {status.label}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {formatDate(req.created_at)}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
            <ExpandedDetails
              req={req}
              actionLoading={actionLoading}
              forwardEmailValue={forwardEmailValue}
              onForwardEmailChange={onForwardEmailChange}
              onForward={onForward}
              onNotifyConsumer={onNotifyConsumer}
              onRequestConfirmation={onRequestConfirmation}
              onRemind={onRemind}
              onExpire={onExpire}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetails({
  req, actionLoading, forwardEmailValue, onForwardEmailChange,
  onForward, onNotifyConsumer, onRequestConfirmation, onRemind, onExpire,
}: {
  req: AdminRequest;
  actionLoading: boolean;
  forwardEmailValue: string;
  onForwardEmailChange: (v: string) => void;
  onForward: () => void;
  onNotifyConsumer: () => void;
  onRequestConfirmation: () => void;
  onRemind: () => void;
  onExpire: () => void;
}) {
  const isNew = req.status === 'pending' && !req.forwarded_at;
  const isForwarded = (req.status === 'pending' || req.status === 'seen') && !!req.forwarded_at;
  const isResponded = (req.status === 'accepted' || req.status === 'declined') && !req.consumer_notified_at;
  const isNotified = !!req.consumer_notified_at;

  const referenceCode = 'VK-' + req.id.replace(/-/g, '').substring(0, 6).toUpperCase();

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Col 1: Förfrågan */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">Förfrågan</h4>
        <div className="text-sm space-y-0.5">
          <div><span className="text-gray-500">Vin:</span> {req.wine?.name}{req.wine?.vintage && !req.wine.name.includes(String(req.wine.vintage)) ? ` ${req.wine.vintage}` : ''}</div>
          <div><span className="text-gray-500">Typ:</span> {req.wine?.wine_type}</div>
          {req.wine?.grape && <div><span className="text-gray-500">Druva:</span> {req.wine.grape}</div>}
          {req.wine?.region && <div><span className="text-gray-500">Region:</span> {req.wine.region}{req.wine.country ? `, ${req.wine.country}` : ''}</div>}
          <div><span className="text-gray-500">Antal:</span> {req.quantity} fl</div>
          {req.lot_price_sek && <div><span className="text-gray-500">Listpris:</span> {req.lot_price_sek} kr/fl</div>}
        </div>
        <div className="pt-2 border-t border-gray-100">
          <div className="text-sm"><span className="text-gray-500">Konsument:</span> {req.consumer.name || req.consumer.email}</div>
          {req.consumer.name && <div className="text-xs text-gray-400">{req.consumer.email}</div>}
          {req.consumer.phone && <div className="text-xs text-gray-400">{req.consumer.phone}</div>}
        </div>
        {req.message && (
          <div className="text-sm bg-white p-2 rounded border border-gray-200 text-gray-700 italic">&ldquo;{req.message}&rdquo;</div>
        )}
        <div className="text-xs text-gray-400">Ref: {referenceCode}</div>
      </div>

      {/* Col 2: Importörens svar */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">Importörens svar</h4>
        {(req.status === 'accepted' || req.status === 'declined') ? (
          <div className="text-sm space-y-1">
            <div className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${req.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {req.status === 'accepted' ? 'Kan leverera' : 'Kan ej leverera'}
            </div>
            {req.response_price_sek && <div><span className="text-gray-500">Pris:</span> <strong>{req.response_price_sek} kr/fl</strong></div>}
            {req.response_quantity && <div><span className="text-gray-500">Antal:</span> {req.response_quantity} fl</div>}
            {req.response_delivery_days && <div><span className="text-gray-500">Leveranstid:</span> {req.response_delivery_days} dagar</div>}
            {req.response_note && <div className="bg-white p-2 rounded border border-gray-200 text-gray-700 italic">&ldquo;{req.response_note}&rdquo;</div>}
            {(() => {
              const ov = getOrderValue(req);
              if (!ov.value) return null;
              return (
                <div className="pt-2 border-t border-gray-100 font-medium">
                  Ordervärde: {formatSEK(ov.value)}
                  <span className="text-gray-400 text-xs font-normal ml-1">({ov.source === 'response' ? 'Bekräftat' : 'Est.'})</span>
                </div>
              );
            })()}
            <div className="text-xs text-gray-400">Svarat: {formatDate(req.responded_at)}</div>
          </div>
        ) : isForwarded ? (
          <div className="text-sm text-blue-600">
            <div>Väntar på svar från {req.importer?.name || 'importören'}</div>
            <div className="text-xs text-gray-400 mt-1">
              Skickad {formatDate(req.forwarded_at)} ({daysSince(req.forwarded_at!)} d sedan)
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">Ej vidareskickad ännu</div>
        )}
      </div>

      {/* Col 3: Åtgärd */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">Åtgärd</h4>

        {isNew && (
          <div className="space-y-2">
            <input
              type="email"
              placeholder="Importörens e-post"
              value={forwardEmailValue}
              onChange={(e) => onForwardEmailChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
            />
            <button
              onClick={onForward}
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#5c2630] disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Skickar...' : `Vidarebefordra`}
            </button>
          </div>
        )}

        {isForwarded && (
          <div className="space-y-2">
            <button
              onClick={onRemind}
              disabled={actionLoading}
              className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? '...' : 'Påminn (ny länk)'}
            </button>
            <button
              onClick={onExpire}
              disabled={actionLoading}
              className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? '...' : 'Markera utgången'}
            </button>
          </div>
        )}

        {isResponded && (
          <div className="space-y-2">
            <button
              onClick={onNotifyConsumer}
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#5c2630] disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Skickar...' : 'Meddela konsument'}
            </button>
            <p className="text-xs text-gray-500">
              Skickar {req.status === 'accepted' ? 'erbjudandet' : 'beskedet'} till {req.consumer.email}
            </p>
          </div>
        )}

        {isNotified && !req.order_confirmed_at && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg border border-gray-200">
              Konsumenten meddelad {formatDate(req.consumer_notified_at)}
            </div>
            <button
              onClick={onRequestConfirmation}
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#5c2630] disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Skickar...' : 'Skicka bekräftelseförfrågan'}
            </button>
            <p className="text-xs text-gray-500">
              Skickar mail till importören att bekräfta mottagen beställning
            </p>
          </div>
        )}

        {!!req.order_confirmed_at && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-800 bg-green-50 p-3 rounded-lg border border-green-200">
              <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium">Slutförd</div>
                <div className="text-xs text-green-700">Bekräftad {formatDate(req.order_confirmed_at)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
