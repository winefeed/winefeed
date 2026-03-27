/**
 * IOR IMPORTS COCKPIT
 *
 * /ior/imports
 *
 * Importer-of-Record action queue showing import cases with status signals.
 * Helps importers see what needs action, what's waiting on admin, and what's ready.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ComplianceStatusBadge, ComplianceStatus } from '@/components/compliance/ComplianceStatusBadge';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Package,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

      const response = await fetch(`/api/direct-import/imports/queue?filter=${filter}`, {
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
      <div className="py-6 px-4 lg:px-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !actor) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Fel</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setError(null);
                    fetchActor();
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-wine text-white hover:bg-wine/90'
                  )}
                >
                  Försök igen
                </button>
                <button
                  onClick={() => router.push('/supplier')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Tillbaka
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-wine/10 rounded-xl">
            <Package className="h-6 w-6 text-wine" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Cockpit</h1>
            <p className="text-sm text-gray-500 mt-1">
              Dina import-ärenden och dokumentstatus
            </p>
          </div>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
            'border border-gray-300 text-gray-700 hover:bg-gray-50'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Uppdatera
        </button>
      </div>

      {/* Error banner */}
      {error && actor && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTER_TABS.map(tab => {
          const Icon = tab.icon;
          const count = counts[tab.key];
          const isActive = filter === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-wine text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  isActive ? 'bg-white/20' : 'bg-gray-100'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={cn(
          'bg-white rounded-lg p-4 border border-gray-200',
          counts.needs_action > 0 && 'border-amber-200 bg-amber-50/50'
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('h-5 w-5', counts.needs_action > 0 ? 'text-amber-500' : 'text-gray-400')} />
            <span className="text-sm font-medium text-gray-600">Behöver åtgärd</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-gray-900">{counts.needs_action}</p>
        </div>
        <div className={cn(
          'bg-white rounded-lg p-4 border border-gray-200',
          counts.waiting_admin > 0 && 'border-blue-200 bg-blue-50/50'
        )}>
          <div className="flex items-center gap-2">
            <Clock className={cn('h-5 w-5', counts.waiting_admin > 0 ? 'text-blue-500' : 'text-gray-400')} />
            <span className="text-sm font-medium text-gray-600">Väntar på admin</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-gray-900">{counts.waiting_admin}</p>
        </div>
        <div className={cn(
          'bg-white rounded-lg p-4 border border-gray-200',
          counts.ready > 0 && 'border-green-200 bg-green-50/50'
        )}>
          <div className="flex items-center gap-2">
            <CheckCircle className={cn('h-5 w-5', counts.ready > 0 ? 'text-green-500' : 'text-gray-400')} />
            <span className="text-sm font-medium text-gray-600">Redo</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-gray-900">{counts.ready}</p>
        </div>
      </div>

      {/* Import Cases List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {FILTER_TABS.find(t => t.key === filter)?.label || 'Ärenden'} ({imports.length})
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {FILTER_TABS.find(t => t.key === filter)?.description}
          </p>
        </div>

        {loading ? (
          <div className="space-y-0 divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
                <div className="h-5 bg-gray-200 rounded w-48 mt-2" />
                <div className="h-4 bg-gray-200 rounded w-32 mt-2" />
              </div>
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
              {filter === 'needs_action' ? (
                <CheckCircle className="h-10 w-10 text-green-400" />
              ) : filter === 'ready' ? (
                <Inbox className="h-10 w-10 text-gray-400" />
              ) : (
                <FileText className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <p className="text-gray-600 font-medium mb-1">
              {filter === 'needs_action' && 'Inga ärenden behöver åtgärd just nu'}
              {filter === 'waiting_admin' && 'Inga dokument väntar på verifiering'}
              {filter === 'ready' && 'Inga ärenden är redo att gå vidare'}
              {filter === 'all' && 'Inga import-ärenden ännu'}
            </p>
            {filter !== 'all' && counts.all > 0 && (
              <button
                onClick={() => setFilter('all')}
                className="mt-2 text-wine hover:text-wine/80 text-sm font-medium"
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
                className="px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Top row: ID + Status badges */}
                    <div className="flex items-center gap-3 mb-1.5">
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
                    <div className="flex items-center gap-4 mt-1.5 text-sm">
                      {item.missingDocsCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <FileText className="h-3.5 w-3.5" />
                          {item.missingDocsCount} saknas
                        </span>
                      )}
                      {item.pendingVerificationCount > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Clock className="h-3.5 w-3.5" />
                          {item.pendingVerificationCount} väntar
                        </span>
                      )}
                      {item.verifiedDocsCount > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3.5 w-3.5" />
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

                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
