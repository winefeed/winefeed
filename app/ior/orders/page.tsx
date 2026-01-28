/**
 * IOR ORDERS LIST PAGE - EU-SELLER → IOR OPERATIONAL FLOW
 *
 * /ior/orders
 *
 * IOR (Importer-of-Record) console for managing order fulfillment
 *
 * Features:
 * - List orders where current user is IOR
 * - Filter by status (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
 * - View order details
 * - Quick status overview
 *
 * Actor Resolution:
 * - Fetches current user's actor context from /api/me/actor
 * - Verifies user has IOR role and importer_id
 * - Uses dynamic importer_id for all API calls
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OrderStatusBadge } from '@/app/orders/components/StatusBadge';

// Tenant ID - single tenant for MVP
// Middleware sets x-user-id and x-tenant-id headers from Supabase auth session

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
  order_number?: number; // Sequential order number
}

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

      // Middleware sets x-user-id from Supabase auth session
      const response = await fetch('/api/me/actor', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch actor context');
      }

      const actorData = await response.json();
      setActor(actorData);

      // Verify IOR access - ADMIN can always access IOR view
      const hasIORAccess = actorData.roles.includes('IOR') && actorData.importer_id;
      const isAdmin = actorData.roles.includes('ADMIN');

      if (!hasIORAccess && !isAdmin) {
        throw new Error('Du saknar IOR-behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err: any) {
      console.error('Failed to fetch actor:', err);
      setError(err.message || 'Kunde inte ladda användarprofil');
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    // Allow ADMIN without importer_id to view all IOR orders
    const isAdmin = actor?.roles.includes('ADMIN');
    if (!actor || (!actor.importer_id && !isAdmin)) return;

    try {
      setLoading(true);
      setError(null);

      // Build URL with status filter
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const url = `/api/ior/orders${params.toString() ? `?${params.toString()}` : ''}`;

      // Middleware sets x-user-id and x-tenant-id from Supabase auth session
      const response = await fetch(url, {
        credentials: 'include'  // Ensure cookies are sent
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Missing authentication');
        }
        if (response.status === 403) {
          throw new Error('Access denied: Not authorized as IOR');
        }
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err.message || 'Kunde inte ladda orders');
    } finally {
      setLoading(false);
    }
  }, [actor, statusFilter]);

  // Fetch actor context on mount
  useEffect(() => {
    fetchActor();
  }, [fetchActor]);

  // Fetch orders when actor or filter changes
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
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'Bekräftad';
      case 'IN_FULFILLMENT': return 'I leverans';
      case 'SHIPPED': return 'Skickad';
      case 'DELIVERED': return 'Levererad';
      case 'CANCELLED': return 'Avbruten';
      default: return status;
    }
  };

  const getSupplierTypeIcon = (type: string) => {
    switch (type) {
      case 'SWEDISH_IMPORTER': return '🇸🇪';
      case 'EU_PRODUCER': return '🇪🇺';
      case 'EU_IMPORTER': return '🇪🇺';
      default: return '📦';
    }
  };

  // Format order ID to readable format
  const formatOrderId = (order: Order) => {
    const year = new Date(order.created_at).getFullYear();
    if (order.order_number) {
      return `ORD-${year}-${String(order.order_number).padStart(3, '0')}`;
    }
    // Fallback: use last 6 chars of UUID
    return `#${order.id.substring(0, 6).toUpperCase()}`;
  };

  // Format price
  const formatPrice = (amount: number | undefined, currency: string = 'SEK') => {
    if (!amount && amount !== 0) return '–';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Filter orders by search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.restaurant_name.toLowerCase().includes(query) ||
      order.supplier_name.toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query) ||
      formatOrderId(order).toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setError(null);
                  fetchActor();
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Försök igen
              </button>
              {error.includes('IOR-behörighet') && (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ← Tillbaka
                </button>
              )}
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
              <span className="text-4xl">📦</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">IOR Orders</h1>
                <p className="text-sm text-white/80">Importer-of-Record Fulfillment Console</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/supplier')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                ← Supplier Portal
              </button>
              <button
                onClick={() => router.push('/supplier/orders')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                Mina försäljningar
              </button>
              <button
                onClick={fetchOrders}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {['ALL', 'CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'ALL' ? 'Alla' : getStatusLabel(status)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Sök på restaurang, leverantör eller ordernummer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              Orders ({filteredOrders.length}{searchQuery && ` av ${orders.length}`})
            </h2>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">📭</span>
              <p className="text-gray-500 text-lg">
                {searchQuery ? 'Inga orders matchar sökningen' : 'Inga orders ännu'}
              </p>
              {(statusFilter !== 'ALL' || searchQuery) && (
                <p className="text-gray-400 text-sm mt-2">
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-blue-600 underline mr-2">Rensa sökning</button>
                  )}
                  {statusFilter !== 'ALL' && (
                    <button onClick={() => setStatusFilter('ALL')} className="text-blue-600 underline">Visa alla statusar</button>
                  )}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Order</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Restaurang</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Leverantör</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Antal</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Summa</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Skapad</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/ior/orders/${order.id}`)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-blue-600">{formatOrderId(order)}</div>
                        <div className="text-xs text-gray-400">{order.total_lines} rad{order.total_lines !== 1 ? 'er' : ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{order.restaurant_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span>{getSupplierTypeIcon(order.supplier_type)}</span>
                          <span>{order.supplier_name}</span>
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
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/ior/orders/${order.id}`);
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                        >
                          Visa →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
