/**
 * IOR FEEDBACK LIST
 *
 * View and filter submitted feedback items.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  MessageSquarePlus,
  AlertTriangle,
  Bug,
  Lightbulb,
  Workflow,
  Database,
  HelpCircle,
  ChevronRight,
  X,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FeedbackItem {
  id: string;
  pagePath: string;
  category: string;
  severity: string;
  title: string;
  details: string;
  expected?: string;
  status: string;
  producerId?: string;
  createdAt: string;
}

interface FeedbackResponse {
  items: FeedbackItem[];
  page: number;
  pageSize: number;
  total: number;
}

const categoryIcons: Record<string, React.ElementType> = {
  UX: Lightbulb,
  Bug: Bug,
  Data: Database,
  Workflow: Workflow,
  'Missing feature': MessageSquarePlus,
  Other: HelpCircle,
};

const categoryLabels: Record<string, string> = {
  UX: 'UX',
  Bug: 'Bugg',
  Data: 'Data',
  Workflow: 'Arbetsflöde',
  'Missing feature': 'Saknad funktion',
  Other: 'Övrigt',
};

const severityStyles: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

const statusStyles: Record<string, { bg: string; icon: React.ElementType }> = {
  OPEN: { bg: 'bg-blue-100 text-blue-700', icon: Clock },
  ACKNOWLEDGED: { bg: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  DONE: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
  WONTFIX: { bg: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const statusLabels: Record<string, string> = {
  OPEN: 'Öppen',
  ACKNOWLEDGED: 'Mottagen',
  DONE: 'Klar',
  WONTFIX: 'Åtgärdas ej',
};

export default function FeedbackListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (severityFilter) params.set('severity', severityFilter);
      params.set('page', String(page));
      params.set('pageSize', '20');

      const response = await fetch(`/api/ior/feedback?${params}`);
      if (!response.ok) throw new Error('Failed to fetch feedback');

      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Kunde inte ladda feedback');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, severityFilter, page]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (severityFilter) params.set('severity', severityFilter);
    if (page > 1) params.set('page', String(page));

    const queryString = params.toString();
    router.replace(`/ior/feedback${queryString ? `?${queryString}` : ''}`, {
      scroll: false,
    });
  }, [statusFilter, categoryFilter, severityFilter, page, router]);

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setSeverityFilter('');
    setPage(1);
  };

  const hasActiveFilters = statusFilter || categoryFilter || severityFilter;

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Feedback</h1>
          <p className="text-sm text-gray-500 mt-1">
            Rapportera buggar, förslag och synpunkter
          </p>
        </div>
        <Link
          href="/ior/feedback/new"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-wine text-white font-medium',
            'hover:bg-wine/90 transition-colors'
          )}
        >
          <Plus className="h-4 w-4" />
          Ny feedback
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Status */}
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
          <option value="OPEN">Öppen</option>
          <option value="ACKNOWLEDGED">Mottagen</option>
          <option value="DONE">Klar</option>
          <option value="WONTFIX">Åtgärdas ej</option>
        </select>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className={cn(
            'px-3 py-2 border border-gray-300 rounded-lg bg-white',
            'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
          )}
        >
          <option value="">Alla kategorier</option>
          <option value="UX">UX</option>
          <option value="Bug">Bugg</option>
          <option value="Data">Data</option>
          <option value="Workflow">Arbetsflöde</option>
          <option value="Missing feature">Saknad funktion</option>
          <option value="Other">Övrigt</option>
        </select>

        {/* Severity */}
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPage(1);
          }}
          className={cn(
            'px-3 py-2 border border-gray-300 rounded-lg bg-white',
            'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent'
          )}
        >
          <option value="">Alla allvarlighetsgrader</option>
          <option value="Low">Låg</option>
          <option value="Medium">Medel</option>
          <option value="High">Hög</option>
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
            Rensa
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-64 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-48" />
            </div>
          ))}
        </div>
      )}

      {/* Feedback list */}
      {data && (
        <>
          {data.items.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <MessageSquarePlus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {hasActiveFilters
                  ? 'Ingen feedback matchar dina filter'
                  : 'Ingen feedback rapporterad ännu'}
              </p>
              {!hasActiveFilters && (
                <Link
                  href="/ior/feedback/new"
                  className="inline-flex items-center gap-2 text-wine hover:text-wine/80 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Skapa din första feedback
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.items.map((item) => {
                const CategoryIcon = categoryIcons[item.category] || HelpCircle;
                const statusInfo = statusStyles[item.status] || statusStyles.OPEN;
                const StatusIcon = statusInfo.icon;

                return (
                  <Link
                    key={item.id}
                    href={`/ior/feedback/${item.id}`}
                    className={cn(
                      'block bg-white border rounded-lg p-4 transition-all',
                      'hover:shadow-md hover:border-wine/30'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <CategoryIcon className="h-5 w-5 text-gray-600" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                            statusInfo.bg
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {statusLabels[item.status]}
                          </span>
                          <span className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            severityStyles[item.severity]
                          )}>
                            {item.severity}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {categoryLabels[item.category] || item.category}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-medium text-gray-900 truncate">
                          {item.title}
                        </h3>

                        {/* Meta */}
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                              locale: sv,
                            })}
                          </span>
                          <span className="truncate text-gray-400">
                            {item.pagePath}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
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
