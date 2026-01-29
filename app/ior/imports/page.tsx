/**
 * IOR IMPORTS COCKPIT
 *
 * /ior/imports
 *
 * Importer-of-Record action queue showing import cases with status signals.
 * Helps importers see what needs action, what's waiting on admin, and what's ready.
 *
 * Features:
 * - Filter tabs: Needs Action / Waiting Admin / Ready / All
 * - Compliance status badges
 * - Missing docs count
 * - Pending verification count
 * - One-click navigation to import details
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ComplianceStatusBadge, ComplianceStatus } from '@/components/compliance/ComplianceStatusBadge';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { FileText, Clock, CheckCircle, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

interface ActorContext {
  tenant_id: string;
  user_id: string;
  roles: string[];
  importer_id?: string;
}

interface ImportQueueItem {
  id: string;
  status: string;
  statusLabel: string;
  complianceStatus: ComplianceStatus;
  blockReason: string | null;
  missingDocsCount: number;
  pendingVerificationCount: number;
  verifiedDocsCount: number;
  updatedAt: string;
  createdAt: string;
  allowedTransitions: string[];
  restaurantName: string;
  restaurantId: string;
  queueType: 'needs_action' | 'waiting_admin' | 'ready';
}

interface QueueCounts {
  all: number;
  needs_action: number;
  waiting_admin: number;
  ready: number;
}

type FilterType = 'all' | 'needs_action' | 'waiting_admin' | 'ready';

const FILTER_TABS: { key: FilterType; label: string; icon: typeof FileText; description: string }[] = [
  { key: 'needs_action', label: 'Behöver åtgärd', icon: AlertTriangle, description: 'Saknade dokument eller problem' },
  { key: 'waiting_admin', label: 'Väntar på admin', icon: Clock, description: 'Dokument väntar på verifiering' },
  { key: 'ready', label: 'Redo', icon: CheckCircle, description: 'Kan gå vidare till nästa steg' },
  { key: 'all', label: 'Alla', icon: FileText, description: 'Visa alla import-ärenden' },
];

export default function IORImportsCockpitPage() {
  const router = useRouter();
  const [actor, setActor] = useState<ActorContext | null>(null);
  const [imports, setImports] = useState<ImportQueueItem[]>([]);
  const [counts, setCounts] = useState<QueueCounts>({ all: 0, needs_action: 0, waiting_admin: 0, ready: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('needs_action');

  const fetchActor = useCallback(async () => {
    try {
      const response = await fetch('/api/me/actor', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch actor context');

      const actorData = await response.json();
      setActor(actorData);

      if (!actorData.roles.includes('IOR') || !actorData.importer_id) {
        throw new Error('Du saknar IOR-behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kunde inte ladda användarprofil'));
      setLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!actor) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ior/imports/queue?filter=${filter}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Åtkomst nekad: Inte behörig som IOR');
        }
        throw new Error('Kunde inte hämta import-ärenden');
      }

      const data = await response.json();
      setImports(data.imports || []);
      setCounts(data.counts || { all: 0, needs_action: 0, waiting_admin: 0, ready: 0 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [actor, filter]);

  useEffect(() => {
    fetchActor();
  }, [fetchActor]);

  useEffect(() => {
    if (actor) {
      fetchQueue();
    }
  }, [actor, fetchQueue]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    if (diffHours < 24) return `${diffHours} tim sedan`;
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    return date.toLocaleDateString('sv-SE');
  };

  if (loading && !actor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }

  if (error && !actor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Fel</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setError(null);
                  fetchActor();
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Försök igen
              </button>
              <button
                onClick={() => router.push('/supplier')}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Tillbaka
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📋</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Import Cockpit</h1>
                <p className="text-sm text-white/80">Dina import-ärenden och dokumentstatus</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/ior/orders')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                IOR Orders
              </button>
              <button
                onClick={() => router.push('/supplier')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                Supplier Portal
              </button>
              <button
                onClick={fetchQueue}
                disabled={loading}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {FILTER_TABS.map(tab => {
            const Icon = tab.icon;
            const count = counts[tab.key];
            const isActive = filter === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`bg-white rounded-lg p-4 border-l-4 ${counts.needs_action > 0 ? 'border-amber-500' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${counts.needs_action > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-600">Behöver åtgärd</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.needs_action}</p>
          </div>
          <div className={`bg-white rounded-lg p-4 border-l-4 ${counts.waiting_admin > 0 ? 'border-blue-500' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Clock className={`h-5 w-5 ${counts.waiting_admin > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-600">Väntar på admin</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.waiting_admin}</p>
          </div>
          <div className={`bg-white rounded-lg p-4 border-l-4 ${counts.ready > 0 ? 'border-green-500' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-5 w-5 ${counts.ready > 0 ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-600">Redo</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.ready}</p>
          </div>
        </div>

        {/* Import Cases List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              {FILTER_TABS.find(t => t.key === filter)?.label || 'Ärenden'} ({imports.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {FILTER_TABS.find(t => t.key === filter)?.description}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Laddar...</p>
            </div>
          ) : imports.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">
                {filter === 'needs_action' ? '🎉' : filter === 'waiting_admin' ? '⏳' : filter === 'ready' ? '📭' : '📋'}
              </span>
              <p className="text-gray-500 text-lg">
                {filter === 'needs_action' && 'Inga ärenden behöver åtgärd just nu!'}
                {filter === 'waiting_admin' && 'Inga dokument väntar på verifiering.'}
                {filter === 'ready' && 'Inga ärenden är redo att gå vidare.'}
                {filter === 'all' && 'Inga import-ärenden ännu.'}
              </p>
              {filter !== 'all' && counts.all > 0 && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-4 text-blue-600 underline text-sm"
                >
                  Visa alla ärenden
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {imports.map(item => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/imports/${item.id}`)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Top row: ID + Status badges */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-gray-500">
                          {item.id.substring(0, 8)}...
                        </span>
                        <ImportStatusBadge status={item.status} size="sm" />
                        <ComplianceStatusBadge status={item.complianceStatus} size="sm" />
                      </div>

                      {/* Restaurant name */}
                      <p className="font-medium text-gray-900 truncate">
                        {item.restaurantName}
                      </p>

                      {/* Action signals */}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {item.missingDocsCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <FileText className="h-4 w-4" />
                            {item.missingDocsCount} saknas
                          </span>
                        )}
                        {item.pendingVerificationCount > 0 && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Clock className="h-4 w-4" />
                            {item.pendingVerificationCount} väntar
                          </span>
                        )}
                        {item.verifiedDocsCount > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            {item.verifiedDocsCount} OK
                          </span>
                        )}
                        {item.blockReason && (
                          <span className="text-red-600 text-xs">
                            {item.blockReason}
                          </span>
                        )}
                      </div>

                      {/* Updated time */}
                      <p className="text-xs text-gray-400 mt-1">
                        Uppdaterad {formatTimeAgo(item.updatedAt)}
                      </p>
                    </div>

                    {/* Action button */}
                    <div className="flex items-center gap-2 ml-4">
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
