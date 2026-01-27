/**
 * ADMIN OFFERS PAGE
 *
 * /admin/offers
 *
 * Shows all offers with filtering and sorting
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, RefreshCw, Search, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useActor } from '@/lib/hooks/useActor';

interface Offer {
  id: string;
  status: string;
  supplierId: string;
  supplierName: string;
  requestId: string;
  requestFritext: string | null;
  restaurantName: string;
  linesCount: number;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Alla' },
  { value: 'DRAFT', label: 'Utkast' },
  { value: 'SENT', label: 'Skickade' },
  { value: 'ACCEPTED', label: 'Accepterade' },
  { value: 'REJECTED', label: 'Avvisade' },
];

export default function AdminOffersPage() {
  const router = useRouter();
  const { actor, loading: actorLoading } = useActor();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Access Denied: Admin privileges required');
        setLoading(false);
        return;
      }
      fetchOffers();
    }
  }, [actor, actorLoading]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/offers', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        throw new Error('Failed to fetch offers');
      }

      const data = await response.json();
      setOffers(data.offers);
    } catch (err: any) {
      console.error('Failed to fetch offers:', err);
      setError(err.message || 'Kunde inte ladda offerter');
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = useMemo(() => {
    let filtered = offers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.id.toLowerCase().includes(query) ||
        o.supplierName.toLowerCase().includes(query) ||
        o.restaurantName.toLowerCase().includes(query) ||
        o.requestFritext?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'supplierName':
          aVal = a.supplierName.toLowerCase();
          bVal = b.supplierName.toLowerCase();
          break;
        case 'restaurantName':
          aVal = a.restaurantName.toLowerCase();
          bVal = b.restaurantName.toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'linesCount':
          aVal = a.linesCount;
          bVal = b.linesCount;
          break;
        case 'createdAt':
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [offers, searchQuery, statusFilter, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ column, label, className = '' }: { column: string; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(column)}
      className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <div className="w-3" />
        )}
      </div>
    </th>
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: offers.length };
    offers.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [offers]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">Utkast</span>;
      case 'SENT':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">Skickad</span>;
      case 'ACCEPTED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">Accepterad</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">Avvisad</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nagot gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Offerter</h1>
          <p className="text-muted-foreground mt-1">
            {filteredOffers.length} av {offers.length} offerter
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchOffers}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-card rounded-lg p-4 border border-border">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">Sok</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sok leverantor, restaurang..."
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} {statusCounts[opt.value] ? `(${statusCounts[opt.value]})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick status filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
              {statusCounts[opt.value] > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-background/20">
                  {statusCounts[opt.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">
                  Offert
                </th>
                <SortableHeader column="supplierName" label="Leverantor" className="text-left" />
                <SortableHeader column="restaurantName" label="Restaurang" className="text-left" />
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">
                  Forfragan
                </th>
                <SortableHeader column="status" label="Status" className="text-left" />
                <SortableHeader column="linesCount" label="Rader" className="text-right" />
                <SortableHeader column="createdAt" label="Skapad" className="text-left" />
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Inga offerter hittades</p>
                    {statusFilter !== 'ALL' && (
                      <button
                        onClick={() => setStatusFilter('ALL')}
                        className="text-primary hover:underline mt-2 text-sm"
                      >
                        Visa alla offerter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOffers.map((offer) => (
                  <tr
                    key={offer.id}
                    onClick={() => router.push(`/dashboard/offers/${offer.id}`)}
                    className="hover:bg-accent transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-primary">
                        {offer.id.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {offer.supplierName}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {offer.restaurantName}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                      {offer.requestFritext || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(offer.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">
                      {offer.linesCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(offer.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
