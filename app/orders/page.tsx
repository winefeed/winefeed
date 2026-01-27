/**
 * ORDERS LIST PAGE
 *
 * /orders
 *
 * View and track orders (read-only)
 *
 * Features:
 * - List all orders (ADMIN sees all, RESTAURANT sees their own)
 * - Filter by status
 * - Search by order ID, supplier, restaurant
 * - Sortable columns
 * - Click row to view details
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, RefreshCw, Search, ArrowLeft, ChevronUp, ChevronDown, Package } from 'lucide-react';
import { OrderStatusBadge } from './components/StatusBadge';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { useActor } from '@/lib/hooks/useActor';

interface Order {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  supplier_name: string;
  supplier_type: string;
  importer_name: string;
  restaurant_name?: string;
  import_id: string | null;
  import_status: string | null;
  lines_count: number;
  total_quantity: number;
  currency: string;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Alla' },
  { value: 'PENDING_SUPPLIER_CONFIRMATION', label: 'Vantande' },
  { value: 'CONFIRMED', label: 'Bekraftad' },
  { value: 'IN_FULFILLMENT', label: 'I leverans' },
  { value: 'SHIPPED', label: 'Skickad' },
  { value: 'DELIVERED', label: 'Levererad' },
  { value: 'CANCELLED', label: 'Avbruten' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { actor, loading: actorLoading } = useActor();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const isAdmin = actor?.roles.includes('ADMIN');

  const fetchOrders = useCallback(async () => {
    if (!actor) return;

    const hasAccess = actor.roles.includes('ADMIN') || (actor.roles.includes('RESTAURANT') && actor.restaurant_id);
    if (!hasAccess) return;

    try {
      setLoading(true);
      setError(null);

      const url = actor.roles.includes('ADMIN')
        ? '/api/admin/orders'
        : '/api/restaurant/orders';

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Atkomst nekad');
        }
        throw new Error('Kunde inte hamta ordrar');
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err.message || 'Kunde inte ladda ordrar');
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (!actorLoading && actor) {
      const hasAccess = actor.roles.includes('ADMIN') || (actor.roles.includes('RESTAURANT') && actor.restaurant_id);
      if (!hasAccess) {
        setError('Du saknar behorighet att se ordrar');
        setLoading(false);
        return;
      }
      fetchOrders();
    }
  }, [actor, actorLoading, fetchOrders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.id.toLowerCase().includes(query) ||
        o.supplier_name.toLowerCase().includes(query) ||
        o.importer_name.toLowerCase().includes(query) ||
        o.restaurant_name?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'supplier_name':
          aVal = a.supplier_name.toLowerCase();
          bVal = b.supplier_name.toLowerCase();
          break;
        case 'restaurant_name':
          aVal = (a.restaurant_name || '').toLowerCase();
          bVal = (b.restaurant_name || '').toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'lines_count':
          aVal = a.lines_count;
          bVal = b.lines_count;
          break;
        case 'total_quantity':
          aVal = a.total_quantity;
          bVal = b.total_quantity;
          break;
        case 'created_at':
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [orders, statusFilter, searchQuery, sortColumn, sortDirection]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSupplierTypeIcon = (type: string) => {
    switch (type) {
      case 'SWEDISH_IMPORTER': return '🇸🇪';
      case 'EU_PRODUCER': return '🇪🇺';
      case 'EU_IMPORTER': return '🇪🇺';
      default: return '';
    }
  };

  // Count orders by status for badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };
    orders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

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

  if (error && orders.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nagot gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Dashboard
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
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? 'Alla ordrar' : 'Mina ordrar'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredOrders.length} av {orders.length} ordrar
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <Link
            href="/dashboard"
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
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">Sok</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sok order-ID, leverantor, restaurang..."
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status filter */}
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

      {/* Orders Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">
                  Order
                </th>
                {isAdmin && (
                  <SortableHeader column="restaurant_name" label="Restaurang" className="text-left" />
                )}
                <SortableHeader column="supplier_name" label="Leverantor" className="text-left" />
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">
                  Importor
                </th>
                <SortableHeader column="status" label="Status" className="text-left" />
                <SortableHeader column="lines_count" label="Rader" className="text-right" />
                <SortableHeader column="total_quantity" label="Antal" className="text-right" />
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">
                  Compliance
                </th>
                <SortableHeader column="created_at" label="Skapad" className="text-left" />
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Inga ordrar hittades</p>
                    {statusFilter !== 'ALL' && (
                      <button
                        onClick={() => setStatusFilter('ALL')}
                        className="text-primary hover:underline mt-2 text-sm"
                      >
                        Visa alla ordrar
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="hover:bg-accent transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-primary">
                        {order.id.substring(0, 8)}...
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm text-foreground">
                        {order.restaurant_name || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span>{getSupplierTypeIcon(order.supplier_type)}</span>
                        <span className="text-sm text-foreground">{order.supplier_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {order.importer_name}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} size="md" />
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">
                      {order.lines_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-medium">
                      {order.total_quantity}
                    </td>
                    <td className="px-4 py-3">
                      {order.import_id ? (
                        <ImportStatusBadge status={order.import_status} size="sm" />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(order.created_at)}
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
