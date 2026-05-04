/**
 * ADMIN GROWTH PIPELINE PAGE
 *
 * /admin/growth
 *
 * Pipeline view for tracking restaurant lead acquisition.
 * Leads are created via the /growth slash command in Claude Code.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useActor } from '@/lib/hooks/useActor';
import { useToast } from '@/components/ui/toast';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Rocket,
  Users,
  Phone,
  CalendarCheck,
  CheckCircle,
  Search,
  Mail,
  MailOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  city: string | null;
  restaurant_type: string | null;
  website: string | null;
  instagram: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  wine_focus_score: number | null;
  pilot_fit_score: number | null;
  wine_focus_notes: string | null;
  wine_match_notes: string | null;
  outreach_angle: string | null;
  outreach_draft: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  signal_type?: string | null;
  signal_date?: string | null;
  signal_context?: string | null;
  restaurant_id?: string | null;
}

interface Stats {
  identified: number;
  researched: number;
  outreach_drafted: number;
  contacted: number;
  responded: number;
  meeting_booked: number;
  onboarded: number;
  rejected: number;
  paused: number;
  total: number;
}

const STATUS_BADGE: Record<string, string> = {
  identified: 'bg-muted text-foreground',
  researched: 'bg-wine-riesling/30 text-wine-dark',
  outreach_drafted: 'bg-wine-dark/10 text-wine-dark',
  contacted: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-emerald-100 text-emerald-800',
  meeting_booked: 'bg-wine-rose/30 text-wine-dark',
  onboarded: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  paused: 'bg-orange-100 text-orange-800',
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identifierad',
  researched: 'Undersökt',
  outreach_drafted: 'Utkast',
  contacted: 'Kontaktad',
  responded: 'Svarat',
  meeting_booked: 'Möte bokat',
  onboarded: 'Onboardad',
  rejected: 'Avvisad',
  paused: 'Pausad',
};

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 4) return 'text-green-600 font-semibold';
  if (score >= 3) return 'text-yellow-600 font-semibold';
  return 'text-red-500';
}

const STALE_STATUSES = new Set(['contacted', 'responded']);

function staleDays(lead: Lead): number | null {
  if (!STALE_STATUSES.has(lead.status)) return null;
  if (!lead.last_contact_at) return null;
  const ms = Date.now() - new Date(lead.last_contact_at).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days >= 14 ? days : null;
}

function extractWarmSources(notes: string | null | undefined): string[] {
  if (!notes) return [];
  const matches: string[] = [];
  const re = /^varm:\s*([^\s,]+)/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(notes)) !== null) {
    matches.push(m[1].toLowerCase());
  }
  return [...new Set(matches)];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('sv-SE', {
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminGrowthPage() {
  const { actor, loading: actorLoading } = useActor();
  const toast = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leadType, setLeadType] = useState<'restaurant' | 'importer' | 'producer'>('restaurant');
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [emailStatuses, setEmailStatuses] = useState<Record<string, string>>({});
  const [emailStatusLoaded, setEmailStatusLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [resolvingLinks, setResolvingLinks] = useState(false);

  const handleResolveLinks = async () => {
    setResolvingLinks(true);
    try {
      const res = await fetch('/api/admin/growth/resolve-links', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Kunde inte länka leads');
      } else {
        toast.success(`${data.matched} leads länkade (av ${data.scanned} skannade)`);
        fetchLeads();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Fel vid länkning');
    } finally {
      setResolvingLinks(false);
    }
  };

  const handleCreateLead = async (payload: Partial<Lead> & { lead_type?: string }) => {
    const res = await fetch('/api/admin/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_type: payload.lead_type || leadType, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Kunde inte skapa lead');
      return false;
    }
    toast.success('Lead skapad');
    setShowNewLeadModal(false);
    fetchLeads();
    return true;
  };

  const handleUpdateLead = async (id: string, patch: Partial<Lead>) => {
    const res = await fetch(`/api/admin/growth/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Kunde inte uppdatera');
      return false;
    }
    toast.success('Sparat');
    fetchLeads();
    return true;
  };

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('lead_type', leadType);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (cityFilter !== 'ALL') params.set('city', cityFilter);

      const response = await fetch(`/api/admin/growth?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Unauthorized: Admin access required');
        }
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();
      const fetchedLeads = data.leads || [];
      setLeads(fetchedLeads);
      setStats(data.stats || null);

      // Fetch email statuses for contacted leads with Resend IDs
      const resendIds = fetchedLeads
        .filter((l: Lead) => l.outreach_draft?.startsWith('resend:'))
        .map((l: Lead) => l.outreach_draft!.replace('resend:', ''));
      setEmailStatusLoaded(resendIds.length === 0);
      if (resendIds.length > 0) {
        try {
          const statusRes = await fetch(`/api/admin/growth/email-status?ids=${resendIds.join(',')}`);
          if (statusRes.ok) {
            setEmailStatuses(await statusRes.json());
          }
        } catch {
          // Non-critical
        } finally {
          setEmailStatusLoaded(true);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch growth data:', err);
      setError(err.message || 'Kunde inte ladda data');
      toast.error('Kunde inte ladda pipeline-data');
    } finally {
      setLoading(false);
    }
  }, [leadType, statusFilter, sourceFilter, cityFilter, toast]);

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Unauthorized: Admin access required');
        setLoading(false);
        return;
      }
      fetchLeads();
    }
  }, [actor, actorLoading, fetchLeads]);

  // Card filter groups: which statuses each card covers
  const CARD_GROUPS: Record<string, string[]> = {
    identified: ['identified', 'researched', 'outreach_drafted'],
    contacted: ['contacted', 'responded'],
    meeting_booked: ['meeting_booked'],
    onboarded: ['onboarded'],
  };

  const filteredLeads = cardFilter
    ? leads.filter((l) => CARD_GROUPS[cardFilter]?.includes(l.status))
    : leads;

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'name':
        return dir * (a.name || '').localeCompare(b.name || '', 'sv');
      case 'restaurant_type':
        return dir * (a.restaurant_type || '').localeCompare(b.restaurant_type || '', 'sv');
      case 'city':
        return dir * (a.city || '').localeCompare(b.city || '', 'sv');
      case 'pilot_fit_score':
        return dir * ((a.pilot_fit_score ?? 0) - (b.pilot_fit_score ?? 0));
      case 'status':
        return dir * (a.status || '').localeCompare(b.status || '', 'sv');
      case 'next_action':
        return dir * (a.next_action || '').localeCompare(b.next_action || '', 'sv');
      case 'last_sign_in_at':
        return dir * (a.last_sign_in_at || '').localeCompare(b.last_sign_in_at || '');
      case 'created_at':
        return dir * (a.created_at || '').localeCompare(b.created_at || '');
      default:
        return 0;
    }
  });

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-foreground" />
      : <ArrowDown className="h-3 w-3 text-foreground" />;
  }

  function toggleCard(card: string) {
    setCardFilter((prev) => (prev === card ? null : card));
    setExpandedLead(null);
  }

  // Extract unique values for filter dropdowns
  const uniqueSources = [...new Set(leads.map((l) => l.source).filter(Boolean))] as string[];
  const uniqueCities = [...new Set(leads.map((l) => l.city).filter(Boolean))] as string[];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header + Tabs + Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tillväxtpipeline</h1>
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => { setLeadType('restaurant'); setExpandedLead(null); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  leadType === 'restaurant'
                    ? 'bg-wine-dark text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Restauranger
              </button>
              <button
                onClick={() => { setLeadType('importer'); setExpandedLead(null); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  leadType === 'importer'
                    ? 'bg-wine-dark text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Importörer
              </button>
              <button
                onClick={() => { setLeadType('producer'); setExpandedLead(null); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  leadType === 'producer'
                    ? 'bg-wine-dark text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Producenter
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-wine-dark text-white rounded-lg hover:bg-wine-dark/90 text-sm font-medium"
            >
              + Ny lead
            </button>
            <button
              onClick={handleResolveLinks}
              disabled={resolvingLinks}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg hover:bg-accent disabled:opacity-50 text-sm"
              title="Matcha leads mot registrerade restaurangkonton på email"
            >
              <RefreshCw className={`h-4 w-4 ${resolvingLinks ? 'animate-spin' : ''}`} />
              Länka leads
            </button>
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg hover:bg-accent disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white"
          >
            <option value="ALL">Alla statusar</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white"
          >
            <option value="ALL">Alla källor</option>
            {uniqueSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white"
          >
            <option value="ALL">Alla städer</option>
            {uniqueCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(cardFilter || statusFilter !== 'ALL' || sourceFilter !== 'ALL' || cityFilter !== 'ALL') && (
            <button
              onClick={() => { setCardFilter(null); setStatusFilter('ALL'); setSourceFilter('ALL'); setCityFilter('ALL'); }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Rensa filter
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Stat cards (clickable filters) */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => toggleCard('identified')}
            className={`bg-white rounded-lg border-2 p-5 text-left transition-colors ${
              cardFilter === 'identified' ? 'border-foreground ring-1 ring-border' : 'border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted0/10 rounded-lg">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Identifierade</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.identified + stats.researched + stats.outreach_drafted}
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => toggleCard('contacted')}
            className={`bg-white rounded-lg border-2 p-5 text-left transition-colors ${
              cardFilter === 'contacted' ? 'border-wine-dark ring-1 ring-wine-light' : 'border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-wine-dark/10 rounded-lg">
                <Phone className="h-5 w-5 text-wine-dark" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kontaktade</p>
                <p className="text-2xl font-bold text-wine-dark">
                  {stats.contacted + stats.responded}
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => toggleCard('meeting_booked')}
            className={`bg-white rounded-lg border-2 p-5 text-left transition-colors ${
              cardFilter === 'meeting_booked' ? 'border-wine-dark ring-1 ring-wine-light' : 'border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-wine-dark/10 rounded-lg">
                <CalendarCheck className="h-5 w-5 text-wine-dark" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Möte bokat</p>
                <p className="text-2xl font-bold text-wine-dark">{stats.meeting_booked}</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => toggleCard('onboarded')}
            className={`bg-white rounded-lg border-2 p-5 text-left transition-colors ${
              cardFilter === 'onboarded' ? 'border-green-500 ring-1 ring-green-300' : 'border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Anslutna</p>
                <p className="text-2xl font-bold text-green-600">{stats.onboarded}</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Filters moved to header */}

      {/* Lead table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laddar leads...</div>
      ) : sortedLeads.length === 0 ? (
        <div className="bg-white rounded-lg border border-border p-12 text-center">
          <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {leadType === 'restaurant' ? 'Inga restaurang-leads ännu' : leadType === 'importer' ? 'Inga importör-leads ännu' : 'Inga producent-leads ännu'}
          </h3>
          <p className="text-muted-foreground">
            Kör <code className="bg-muted px-2 py-0.5 rounded text-sm">/growth</code> i Claude
            Code för att börja söka {leadType === 'restaurant' ? 'restauranger' : leadType === 'importer' ? 'importörer' : 'producenter'}.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                {[
                  { key: 'name', label: 'Namn' },
                  { key: 'restaurant_type', label: 'Typ' },
                  { key: 'city', label: 'Stad' },
                  { key: 'pilot_fit_score', label: 'Poäng' },
                  { key: 'status', label: 'Status' },
                  { key: 'next_action', label: 'Nästa steg' },
                  { key: 'last_sign_in_at', label: 'Senaste login' },
                  { key: 'created_at', label: 'Datum' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 text-left font-medium text-foreground cursor-pointer hover:bg-accent select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon column={col.key} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedLeads.map((lead) => {
                const isExpanded = expandedLead === lead.id;
                return (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedLead(isExpanded ? null : lead.id)}
                    emailStatuses={emailStatuses}
                    emailStatusLoaded={emailStatusLoaded}
                    onUpdate={handleUpdateLead}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNewLeadModal && (
        <NewLeadModal
          defaultLeadType={leadType}
          onCancel={() => setShowNewLeadModal(false)}
          onCreate={handleCreateLead}
        />
      )}
    </div>
  );
}

function NewLeadModal({
  defaultLeadType,
  onCancel,
  onCreate,
}: {
  defaultLeadType: 'restaurant' | 'importer' | 'producer';
  onCancel: () => void;
  onCreate: (payload: Partial<Lead> & { lead_type?: string }) => Promise<boolean>;
}) {
  const [leadType, setLeadType] = useState<'restaurant' | 'importer' | 'producer'>(defaultLeadType);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactLinkedin, setContactLinkedin] = useState('');
  const [source, setSource] = useState('');
  const [signalType, setSignalType] = useState('');
  const [signalContext, setSignalContext] = useState('');
  const [saving, setSaving] = useState(false);

  const typeLabels = {
    restaurant: { heading: 'Ny restaurang-lead', nameLabel: 'Restaurangens namn', placeholder: 'T.ex. Restaurang Volt', rolePh: 'Sommelier, F&B Manager...' },
    importer:   { heading: 'Ny importör-lead',   nameLabel: 'Importörens namn',   placeholder: 'T.ex. Wine Exchange', rolePh: 'Inköp, Sortimentsansvarig...' },
    producer:   { heading: 'Ny producent-lead',  nameLabel: 'Producentens namn',  placeholder: 'T.ex. Domaine Laroche', rolePh: 'Export Manager, Ägare...' },
  } as const;
  const t = typeLabels[leadType];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const payload: Partial<Lead> & { lead_type?: string } = { name: name.trim(), lead_type: leadType };
    if (city.trim()) payload.city = city.trim();
    if (contactName.trim()) payload.contact_name = contactName.trim();
    if (contactRole.trim()) payload.contact_role = contactRole.trim();
    if (contactEmail.trim()) payload.contact_email = contactEmail.trim().toLowerCase();
    if (contactLinkedin.trim()) payload.contact_linkedin = contactLinkedin.trim();
    if (source.trim()) payload.source = source.trim();
    if (signalType.trim()) payload.signal_type = signalType.trim();
    if (signalContext.trim()) {
      payload.signal_context = signalContext.trim();
      payload.signal_date = new Date().toISOString().slice(0, 10);
    }
    await onCreate(payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{t.heading}</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm">
              <span className="text-foreground block mb-1">Typ av lead</span>
              <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
                {(['restaurant', 'importer', 'producer'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLeadType(k)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      leadType === k ? 'bg-wine-dark text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {k === 'restaurant' ? 'Restaurang' : k === 'importer' ? 'Importör' : 'Producent'}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <div>
            <label className="text-sm">
              <span className="text-foreground block mb-1">{t.nameLabel} *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded"
                placeholder={t.placeholder}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-foreground block mb-1">Stad</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
            </label>
            <label className="text-sm">
              <span className="text-foreground block mb-1">Källa</span>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-3 py-2 border border-border rounded">
                <option value="">—</option>
                <option value="linkedin">LinkedIn</option>
                <option value="munskankarna">Munskänkarna</option>
                <option value="vinkoll">Vinkoll</option>
                <option value="referral">Referral</option>
                <option value="google">Google</option>
                <option value="instagram">Instagram</option>
                <option value="event">Event</option>
                <option value="starwinelist">Star Wine List</option>
                <option value="besoksliv">Besöksliv</option>
                <option value="whiteguide">White Guide</option>
                <option value="direct">Direct</option>
                <option value="other">Övrigt</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-foreground block mb-1">Kontaktnamn</span>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
            </label>
            <label className="text-sm">
              <span className="text-foreground block mb-1">Roll</span>
              <input value={contactRole} onChange={(e) => setContactRole(e.target.value)} className="w-full px-3 py-2 border border-border rounded" placeholder={t.rolePh} />
            </label>
          </div>
          <label className="text-sm block">
            <span className="text-foreground block mb-1">Email</span>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
          </label>
          <label className="text-sm block">
            <span className="text-foreground block mb-1">LinkedIn-URL</span>
            <input value={contactLinkedin} onChange={(e) => setContactLinkedin(e.target.value)} className="w-full px-3 py-2 border border-border rounded" placeholder="https://linkedin.com/in/..." />
          </label>
          <label className="text-sm block">
            <span className="text-foreground block mb-1">Signal-typ</span>
            <select value={signalType} onChange={(e) => setSignalType(e.target.value)} className="w-full px-3 py-2 border border-border rounded">
              <option value="">—</option>
              <option value="job_change">Jobbskifte</option>
              <option value="post_engagement">Engagemang (inlägg/kommentar)</option>
              <option value="new_opening">Nyöppning</option>
              <option value="wine_list_update">Vinlista-uppdatering</option>
              <option value="frustration">Frustrations-signal</option>
            </select>
          </label>
          {signalType && (
            <label className="text-sm block">
              <span className="text-foreground block mb-1">Signal-kontext</span>
              <textarea value={signalContext} onChange={(e) => setSignalContext(e.target.value)} rows={2} className="w-full px-3 py-2 border border-border rounded" placeholder="T.ex. tillträdde 2026-04-15, inlägg-länk, citat..." />
            </label>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onCancel} className="px-4 py-2 border border-border rounded text-sm">Avbryt</button>
            <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 bg-wine-dark text-white rounded text-sm font-medium disabled:opacity-50">
              {saving ? 'Skapar...' : 'Skapa lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const EMAIL_EVENT_LABELS: Record<string, { label: string; color: string; icon: 'sent' | 'opened' }> = {
  delivered: { label: 'Levererat', color: 'text-muted-foreground', icon: 'sent' },
  opened: { label: 'Öppnat', color: 'text-green-600', icon: 'opened' },
  clicked: { label: 'Klickat', color: 'text-green-700', icon: 'opened' },
  bounced: { label: 'Studsade', color: 'text-red-500', icon: 'sent' },
  complained: { label: 'Klagomål', color: 'text-red-500', icon: 'sent' },
};

function LeadRow({
  lead,
  isExpanded,
  onToggle,
  emailStatuses,
  emailStatusLoaded,
  onUpdate,
}: {
  lead: Lead;
  isExpanded: boolean;
  onToggle: () => void;
  emailStatuses: Record<string, string>;
  emailStatusLoaded: boolean;
  onUpdate: (id: string, patch: Partial<Lead>) => Promise<boolean>;
}) {
  const badgeClass = STATUS_BADGE[lead.status] || 'bg-muted text-foreground';
  const statusLabel = STATUS_LABELS[lead.status] || lead.status;
  const resendId = lead.outreach_draft?.startsWith('resend:')
    ? lead.outreach_draft.replace('resend:', '')
    : null;
  const emailEvent = resendId ? emailStatuses[resendId] : null;
  const eventInfo = emailEvent ? EMAIL_EVENT_LABELS[emailEvent] : null;

  return (
    <>
      <tr className="hover:bg-accent cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
        <td className="px-4 py-3 text-muted-foreground">{lead.restaurant_type || '—'}</td>
        <td className="px-4 py-3 text-muted-foreground">{lead.city || '—'}</td>
        <td className="px-4 py-3">
          <span className={getScoreColor(lead.pilot_fit_score)}>
            {lead.pilot_fit_score !== null ? `${lead.pilot_fit_score}/5` : '—'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
              {statusLabel}
            </span>
            {lead.restaurant_id && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700"
                title="Länkad till registrerat restaurangkonto"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Länkad
              </span>
            )}
            {(() => {
              const days = staleDays(lead);
              return days !== null ? (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-800"
                  title={`Senaste kontakt för ${days} dagar sedan`}
                >
                  Inaktiv {days}d
                </span>
              ) : null;
            })()}
            {extractWarmSources(lead.notes).map((src) => (
              <span
                key={src}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-800"
                title={`Varm kontakt via ${src}`}
              >
                varm: {src}
              </span>
            ))}
            {resendId && (
              <span className={`inline-flex items-center gap-1 text-xs ${eventInfo ? eventInfo.color : emailStatusLoaded ? 'text-yellow-600' : 'text-muted-foreground'}`} title={`Mail: ${eventInfo?.label || 'Ej tillgänglig'}`}>
                {eventInfo?.icon === 'opened' ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                {eventInfo?.label || (emailStatusLoaded ? 'Skickat' : '...')}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
          {lead.next_action || '—'}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {lead.last_sign_in_at ? (
            <span className="text-green-600" title={new Date(lead.last_sign_in_at).toLocaleString('sv-SE')}>
              {formatDate(lead.last_sign_in_at)}
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.created_at)}</td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={9} className="bg-muted px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left: Contact info */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Kontaktinfo
                </h4>
                <div className="space-y-1 text-sm">
                  {lead.contact_name && (
                    <p>
                      <span className="text-muted-foreground">Namn:</span>{' '}
                      <span className="text-foreground">{lead.contact_name}</span>
                    </p>
                  )}
                  {lead.contact_role && (
                    <p>
                      <span className="text-muted-foreground">Roll:</span>{' '}
                      <span className="text-foreground">{lead.contact_role}</span>
                    </p>
                  )}
                  {lead.contact_email && (
                    <p>
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <a href={`mailto:${lead.contact_email}`} className="text-blue-600 hover:underline">
                        {lead.contact_email}
                      </a>
                    </p>
                  )}
                  {lead.contact_phone && (
                    <p>
                      <span className="text-muted-foreground">Telefon:</span>{' '}
                      <span className="text-foreground">{lead.contact_phone}</span>
                    </p>
                  )}
                  {lead.contact_linkedin && (
                    <p>
                      <span className="text-muted-foreground">LinkedIn:</span>{' '}
                      <a
                        href={lead.contact_linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Profil
                      </a>
                    </p>
                  )}
                  {lead.website && (
                    <p>
                      <span className="text-muted-foreground">Webb:</span>{' '}
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </p>
                  )}
                  {lead.instagram && (
                    <p>
                      <span className="text-muted-foreground">Instagram:</span>{' '}
                      <span className="text-foreground">{lead.instagram}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Middle: Wine match & Outreach */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Vinmatch & Kontakt
                </h4>
                <div className="space-y-3 text-sm">
                  {lead.wine_focus_notes && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Vinfokus</p>
                      <p className="text-foreground">{lead.wine_focus_notes}</p>
                    </div>
                  )}
                  {lead.wine_match_notes && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Vinmatch</p>
                      <p className="text-foreground">{lead.wine_match_notes}</p>
                    </div>
                  )}
                  {lead.outreach_angle && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Kontaktvinkel</p>
                      <p className="text-foreground">{lead.outreach_angle}</p>
                    </div>
                  )}
                  {resendId && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Mailstatus</p>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                        eventInfo
                          ? emailEvent === 'opened' || emailEvent === 'clicked'
                            ? 'bg-green-100 text-green-700'
                            : emailEvent === 'bounced' || emailEvent === 'complained'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-muted text-foreground'
                          : emailStatusLoaded
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {eventInfo?.icon === 'opened'
                          ? <MailOpen className="h-3.5 w-3.5" />
                          : <Mail className="h-3.5 w-3.5" />}
                        {eventInfo?.label || (emailStatusLoaded ? 'Skickat (status ej tillgänglig)' : 'Laddar...')}
                      </div>
                    </div>
                  )}
                  {lead.outreach_draft && !resendId && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Kontaktutkast</p>
                      <pre className="text-foreground whitespace-pre-wrap bg-white p-2 rounded border border-border text-xs">
                        {lead.outreach_draft}
                      </pre>
                    </div>
                  )}
                  {lead.wine_focus_score !== null && (
                    <p className="text-muted-foreground text-xs">
                      Vinfokus-score:{' '}
                      <span className={getScoreColor(lead.wine_focus_score)}>
                        {lead.wine_focus_score}/5
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Notes & Next steps */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Anteckningar & Nästa steg
                </h4>
                <div className="space-y-3 text-sm">
                  {lead.notes && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Anteckningar</p>
                      <p className="text-foreground">{lead.notes}</p>
                    </div>
                  )}
                  {lead.next_action && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Nästa steg</p>
                      <p className="text-foreground">{lead.next_action}</p>
                    </div>
                  )}
                  {lead.next_action_date && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Datum för nästa steg</p>
                      <p className="text-foreground">
                        {new Date(lead.next_action_date).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  )}
                  {lead.source && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Källa</p>
                      <p className="text-foreground">{lead.source}</p>
                    </div>
                  )}
                  {lead.last_contact_at && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Senaste kontakt</p>
                      <p className="text-foreground">
                        {new Date(lead.last_contact_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signal + Länkning — visas alltid om någondera finns */}
            {(lead.signal_type || lead.restaurant_id) && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
                {lead.signal_type && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Signal
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Typ:</span>{' '}
                        <span className="font-medium text-foreground">{lead.signal_type}</span>
                        {lead.signal_date && (
                          <span className="text-muted-foreground ml-2">
                            ({new Date(lead.signal_date).toLocaleDateString('sv-SE')})
                          </span>
                        )}
                      </p>
                      {lead.signal_context && (
                        <p className="text-foreground italic">{lead.signal_context}</p>
                      )}
                    </div>
                  </div>
                )}
                {lead.restaurant_id && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Registrerat konto
                    </h4>
                    <a
                      href={`/admin/restaurants/${lead.restaurant_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 hover:bg-green-100"
                    >
                      Öppna restaurang-vy →
                    </a>
                  </div>
                )}
              </div>
            )}

            <QuickEdit lead={lead} onUpdate={onUpdate} />
          </td>
        </tr>
      )}
    </>
  );
}

function QuickEdit({
  lead,
  onUpdate,
}: {
  lead: Lead;
  onUpdate: (id: string, patch: Partial<Lead>) => Promise<boolean>;
}) {
  const [status, setStatus] = useState(lead.status);
  const [nextAction, setNextAction] = useState(lead.next_action || '');
  const [nextActionDate, setNextActionDate] = useState(lead.next_action_date || '');
  const [noteAddition, setNoteAddition] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const patch: Partial<Lead> = {};
    if (status !== lead.status) patch.status = status;
    if (nextAction !== (lead.next_action || '')) patch.next_action = nextAction || null;
    if (nextActionDate !== (lead.next_action_date || '')) patch.next_action_date = nextActionDate || null;
    if (noteAddition.trim()) {
      const stamp = new Date().toISOString().slice(0, 10);
      const prev = lead.notes ? lead.notes + '\n\n' : '';
      patch.notes = `${prev}[${stamp}] ${noteAddition.trim()}`;
    }
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      return;
    }
    const ok = await onUpdate(lead.id, patch);
    if (ok) setNoteAddition('');
    setSaving(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Snabbredigera
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <label className="text-xs">
          <span className="text-muted-foreground block mb-1">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-2 py-1.5 border border-border rounded text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground block mb-1">Nästa steg</span>
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="w-full px-2 py-1.5 border border-border rounded text-sm"
            placeholder="T.ex. skicka uppföljning"
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground block mb-1">Datum</span>
          <input
            type="date"
            value={nextActionDate?.slice(0, 10) || ''}
            onChange={(e) => setNextActionDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-border rounded text-sm"
          />
        </label>
      </div>
      <div className="mb-3">
        <label className="text-xs">
          <span className="text-muted-foreground block mb-1">Lägg till anteckning (tidsstämplas)</span>
          <textarea
            value={noteAddition}
            onChange={(e) => setNoteAddition(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 border border-border rounded text-sm"
            placeholder='Nya anteckningar — skriv "varm:vinkoll" för varm-tagg'
          />
        </label>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-1.5 bg-wine-dark text-white rounded text-sm font-medium hover:bg-wine-dark/90 disabled:opacity-50"
      >
        {saving ? 'Sparar...' : 'Spara ändringar'}
      </button>
    </div>
  );
}
