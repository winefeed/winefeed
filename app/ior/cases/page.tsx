/**
 * IOR CASES LIST
 *
 * All communication cases with filters and quick actions.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  MessageSquare,
  Clock,
  AlertTriangle,
  Building2,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Case {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  producerId: string;
  producerName: string;
  dueAt?: string;
  isOverdue: boolean;
  lastMessageAt?: string;
  messageCount: number;
  createdAt: string;
}

interface CasesResponse {
  items: Case[];
  page: number;
  pageSize: number;
  total: number;
}

const statusLabels: Record<string, string> = {
  OPEN: 'Öppen',
  WAITING_PRODUCER: 'Väntar svar',
  WAITING_INTERNAL: 'Behöver åtgärd',
  RESOLVED: 'Löst',
  CLOSED: 'Stängd',
};

const statusStyles: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  WAITING_PRODUCER: 'bg-amber-100 text-amber-700',
  WAITING_INTERNAL: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const priorityStyles: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-500',
};

export default function IORCasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [producerFilter, setProducerFilter] = useState(searchParams.get('producer') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      // Special filter: action_required = overdue/high priority
      if (statusFilter === 'action_required') {
        params.set('action_required', 'true');
      } else if (statusFilter) {
        params.set('status', statusFilter);
      }
      if (priorityFilter) params.set('priority', priorityFilter);
      if (producerFilter) params.set('producer', producerFilter);
      params.set('page', String(page));
      params.set('pageSize', '20');

      const response = await fetch(`/api/ior/cases?${params}`);
      if (!response.ok) throw new Error('Failed to fetch cases');

      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Kunde inte ladda ärenden');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, priorityFilter, producerFilter, page]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (producerFilter) params.set('producer', producerFilter);
    if (page > 1) params.set('page', String(page));

    const queryString = params.toString();
    router.replace(`/ior/cases${queryString ? `?${queryString}` : ''}`, {
      scroll: false,
    });
  }, [searchQuery, statusFilter, priorityFilter, producerFilter, page, router]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setProducerFilter('');
    setPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter || priorityFilter || producerFilter;

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ärenden</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hantera kommunikation med dina producenter
          </p>
        </div>
        <Link
          href="/ior/cases/new"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-wine text-white font-medium',
            'hover:bg-wine/90 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
          )}
        >
          <Plus className="h-4 w-4" />
          Nytt ärende
        </Link>
      </div>

      {/* Active filter banner for action_required */}
      {statusFilter === 'action_required' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
                <AlertTriangle className="h-3.5 w-3.5" />
                Kräver åtgärd
              </span>
              <span className="text-sm text-amber-700">
                Visar ärenden som är försenade, hög prio eller väntar internt
              </span>
            </div>
            <button
              onClick={() => setStatusFilter('')}
              className="text-amber-600 hover:text-amber-800 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök ärende..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className={cn(
              'w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
              'placeholder:text-gray-400'
            )}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={cn(
            'px-3 py-2 border border-gray-300 rounded-lg bg-white',
            'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
          )}
        >
          <option value="">Alla statusar</option>
          <option value="action_required">Kräver åtgärd</option>
          <option value="OPEN">Öppen</option>
          <option value="WAITING_PRODUCER">Väntar svar</option>
          <option value="WAITING_INTERNAL">Behöver åtgärd</option>
          <option value="RESOLVED">Löst</option>
          <option value="CLOSED">Stängd</option>
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className={cn(
            'px-3 py-2 border border-gray-300 rounded-lg bg-white',
            'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
          )}
        >
          <option value="">Alla prioriteter</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">Hög</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Låg</option>
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
            Rensa filter
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-64 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cases list */}
      {data && (
        <>
          {data.items.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {hasActiveFilters
                  ? 'Inga ärenden matchar dina filter'
                  : 'Inga ärenden ännu'}
              </p>
              {!hasActiveFilters && (
                <Link
                  href="/ior/cases/new"
                  className="inline-flex items-center gap-2 text-wine hover:text-wine/80 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Skapa ditt första ärende
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.items.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/ior/cases/${caseItem.id}`}
                  className={cn(
                    'block bg-white border rounded-lg p-4 transition-all',
                    'hover:shadow-md hover:border-wine/30',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2',
                    caseItem.isOverdue && 'border-red-300 bg-red-50/30'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                          priorityStyles[caseItem.priority]
                        )}>
                          {caseItem.priority === 'URGENT' && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {caseItem.priority}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          statusStyles[caseItem.status]
                        )}>
                          {statusLabels[caseItem.status] || caseItem.status}
                        </span>
                        {caseItem.isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            <Clock className="h-3 w-3" />
                            Försenad
                          </span>
                        )}
                      </div>

                      {/* Subject */}
                      <h3 className="font-medium text-gray-900 truncate mb-1">
                        {caseItem.subject}
                      </h3>

                      {/* Producer and meta */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {caseItem.producerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {caseItem.messageCount} meddelanden
                        </span>
                        {caseItem.lastMessageAt && (
                          <span className="text-gray-400">
                            Senast:{' '}
                            {formatDistanceToNow(new Date(caseItem.lastMessageAt), {
                              addSuffix: true,
                              locale: sv,
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Due date */}
                    {caseItem.dueAt && (
                      <div className={cn(
                        'text-right text-sm',
                        caseItem.isOverdue ? 'text-red-600' : 'text-gray-500'
                      )}>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDistanceToNow(new Date(caseItem.dueAt), {
                            addSuffix: true,
                            locale: sv,
                          })}
                        </div>
                      </div>
                    )}

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.total > data.pageSize && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Visar {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} av {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg border',
                    page === 1
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Föregående
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * data.pageSize >= data.total}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg border',
                    page * data.pageSize >= data.total
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Nästa
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
