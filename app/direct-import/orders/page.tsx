/**
 * IOR ORDERS LIST PAGE
 *
 * /ior/orders
 *
 * IOR (Importer-of-Record) console for managing order fulfillment.
 * Lists orders where current user is IOR with status filters and search.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  Inbox,
  ShoppingCart,
} from 'lucide-react';
import { OrderStatusBadge } from '@/app/orders/components/StatusBadge';
import { cn, getErrorMessage } from '@/lib/utils';

interface ActorContext {
  tenant_id: string;
  user_id: string;
  roles: string[];
  importer_id?: string;
  supplier_id?: string;
  restaurant_id?: string;
}

interface Order {
  id: string;
  restaurant_id: string;
  seller_supplier_id: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  total_amount?: number;
  currency: string;
  created_at: string;
  restaurant_name: string;
  restaurant_contact_email: string;
  supplier_name: string;
  supplier_type: string;
  order_number?: number;
}

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Alla' },
  { key: 'CONFIRMED', label: 'Bekräftad' },
  { key: 'IN_FULFILLMENT', label: 'I leverans' },
  { key: 'SHIPPED', label: 'Skickad' },
  { key: 'DELIVERED', label: 'Levererad' },
  { key: 'CANCELLED', label: 'Avbruten' },
];

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'SE',
  'EU_PRODUCER': 'EU',
  'EU_IMPORTER': 'EU',
};

export default function IOROrdersPage() {
  const router = useRouter();
  const [actor, setActor] = useState<ActorContext | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchActor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/me/actor', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch actor context');

      const actorData = await response.json();
      setActor(actorData);

      const hasIORAccess = actorData.roles.includes('IOR') && actorData.importer_id;
      const isAdmin = actorData.roles.includes('ADMIN');

      if (!hasIORAccess && !isAdmin) {
        throw new Error('Du saknar IOR-behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err) {
      console.error('Failed to fetch actor:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda användarprofil'));
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const isAdmin = actor?.roles.includes('ADMIN');
    if (!actor || (!actor.importer_id && !isAdmin)) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const url = `/api/direct-import/orders${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, { credentials: 'include' });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Ej autentiserad');
        if (response.status === 403) throw new Error('Åtkomst nekad: Inte behörig som IOR');
        throw new Error('Kunde inte hämta ordrar');
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda ordrar'));
    } finally {
      setLoading(false);
    }
  }, [actor, statusFilter]);

  useEffect(() => {
    fetchActor();
  }, [fetchActor]);

  useEffect(() => {
    const isAdmin = actor?.roles.includes('ADMIN');
    if (actor && (actor.importer_id || isAdmin)) {
      fetchOrders();
    }
  }, [actor, fetchOrders]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatOrderId = (order: Order) => {
    if (order.order_number) {
      const year = new Date(order.created_at).getFullYear();
      return `ORD-${year}-${String(order.order_number).padStart(3, '0')}`;
    }
    return `#${order.id.substring(0, 6).toUpperCase()}`;
  };

  const formatPrice = (amount: number | undefined, currency: string = 'SEK') => {
    if (!amount && amount !== 0) return '–';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const query = strip(searchQuery);
    return (
      strip(order.restaurant_name).includes(query) ||
      strip(order.supplier_name).includes(query) ||
      strip(order.id).includes(query) ||
      formatOrderId(order).toLowerCase().includes(query)
    );
  });

  // Initial loading (actor not yet resolved)
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

  // Error before actor resolved (auth/permission issue)
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
          <div className="p-3 bg-wine/10 rounded-lg">
            <ShoppingCart className="h-6 w-6 text-wine" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ordrar</h1>
            <p className="text-sm text-gray-500 mt-1">
              Importer-of-Record — hantera orderflöden
            </p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'border border-gray-300 text-gray-700 hover:bg-gray-50'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Uppdatera
        </button>
      </div>

      {/* Error banner (after actor resolved) */}
      {error && actor && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              statusFilter === key
                ? 'bg-wine text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök på restaurang, leverantör eller ordernummer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg bg-white text-sm',
              'focus:outline-none focus:ring-2 focus:ring-wine focus:border-wine',
              'placeholder:text-gray-400'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Ordrar ({filteredOrders.length}
            {searchQuery && ` av ${orders.length}`})
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-200">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-4 py-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
                <div className="h-5 bg-gray-200 rounded w-48 mt-2" />
                <div className="h-4 bg-gray-200 rounded w-32 mt-2" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
              <Inbox className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'Inga ordrar matchar sökningen' : 'Inga ordrar ännu'}
            </h3>
            {!searchQuery && statusFilter === 'ALL' && (
              <p className="text-gray-500 mb-4">Ordrar visas här när leverantörer bekräftar beställningar</p>
            )}
            {(statusFilter !== 'ALL' || searchQuery) && (
              <div className="flex items-center justify-center gap-3 mt-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-wine hover:text-wine/80 text-sm font-medium"
                  >
                    Rensa sökning
                  </button>
                )}
                {statusFilter !== 'ALL' && (
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className="text-wine hover:text-wine/80 text-sm font-medium"
                  >
                    Visa alla statusar
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Restaurang</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Leverantör</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">Antal</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">Summa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Skapad</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/ior/orders/${order.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-wine">{formatOrderId(order)}</div>
                      <div className="text-xs text-gray-400">
                        {order.total_lines} rad{order.total_lines !== 1 ? 'er' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{order.restaurant_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-xs font-medium rounded',
                            order.supplier_type === 'SWEDISH_IMPORTER'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {SUPPLIER_TYPE_LABELS[order.supplier_type] || '—'}
                        </span>
                        <span className="text-gray-700">{order.supplier_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} size="md" />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {order.total_quantity} fl
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatPrice(order.total_amount, order.currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
