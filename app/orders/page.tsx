/**
 * RESTAURANT ORDER TRACKING - LIST PAGE
 *
 * /orders
 *
 * Restaurant view to track orders after acceptance (read-only)
 *
 * Features:
 * - List all orders for current restaurant
 * - Filter by status (CONFIRMED, IN_FULFILLMENT, SHIPPED, DELIVERED, CANCELLED)
 * - View order details
 * - See compliance status for EU orders
 *
 * Actor Resolution:
 * - Fetches current user's actor context from /api/me/actor
 * - Verifies user has RESTAURANT role and restaurant_id
 * - Uses dynamic restaurant_id for all API calls
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OrderStatusBadge } from './components/StatusBadge';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StepIndicator } from '@/components/ui/StepIndicator';

// MVP: Hardcoded tenant for testing
// Production: Get from authenticated user context or environment
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000001'; // MVP: Simulated auth

interface ActorContext {
  tenant_id: string;
  user_id: string;
  roles: string[];
  restaurant_id?: string;
  supplier_id?: string;
  importer_id?: string;
}

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

export default function RestaurantOrdersPage() {
  const router = useRouter();
  const [actor, setActor] = useState<ActorContext | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchActor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/me/actor', {
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-user-id': USER_ID
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch actor context');
      }

      const actorData = await response.json();
      setActor(actorData);

      // Allow ADMIN or RESTAURANT access
      const isAdmin = actorData.roles.includes('ADMIN');
      const isRestaurant = actorData.roles.includes('RESTAURANT') && actorData.restaurant_id;

      if (!isAdmin && !isRestaurant) {
        throw new Error('Du saknar behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err: any) {
      console.error('Failed to fetch actor:', err);
      setError(err.message || 'Kunde inte ladda användarprofil');
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!actor) return;

    const isAdmin = actor.roles.includes('ADMIN');
    if (!isAdmin && !actor.restaurant_id) return;

    try {
      setLoading(true);
      setError(null);

      // Build URL with status filter
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      // Admin sees all orders, restaurant sees their own
      const url = isAdmin
        ? `/api/admin/orders${params.toString() ? `?${params.toString()}` : ''}`
        : `/api/restaurant/orders${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-user-id': USER_ID
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Missing authentication');
        }
        if (response.status === 403) {
          throw new Error('Access denied: Not authorized as RESTAURANT');
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
    if (actor && (actor.restaurant_id || actor.roles.includes('ADMIN'))) {
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

  // Status color/label logic moved to OrderStatusBadge component
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'CONFIRMED': 'Bekräftad',
      'IN_FULFILLMENT': 'I leverans',
      'SHIPPED': 'Skickad',
      'DELIVERED': 'Levererad',
      'CANCELLED': 'Avbruten',
    };
    return labels[status] || status;
  };

  const getSupplierTypeIcon = (type: string) => {
    switch (type) {
      case 'SWEDISH_IMPORTER': return '🇸🇪';
      case 'EU_PRODUCER': return '🇪🇺';
      case 'EU_IMPORTER': return '🇪🇺';
      default: return '📦';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
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
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🔄 Försök igen
              </button>
              {error.includes('RESTAURANT-behörighet') && (
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📦</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {actor?.roles.includes('ADMIN') ? 'Alla Orders' : 'Mina Orders'}
                </h1>
                <p className="text-sm text-white/80">
                  {actor?.roles.includes('ADMIN') ? 'Adminvy över alla orders' : 'Följ dina beställningar'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
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
        {/* Step Indicator */}
        <div className="mb-6">
          <StepIndicator currentStep={4} />
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {['ALL', 'CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'ALL' ? 'Alla' : getStatusLabel(status)}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              Orders ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <>
              {statusFilter !== 'ALL' ? (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">🔍</span>
                  <p className="text-gray-500 text-lg">Inga orders med detta filter</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Prova ett annat filter eller <button onClick={() => setStatusFilter('ALL')} className="text-green-600 underline">visa alla</button>
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon="📦"
                  title="Inga orders ännu"
                  description="Orders skapas automatiskt när du accepterar en offert. Skapa din första offertförfrågan för att komma igång."
                  actionLabel="Skapa första offertförfrågan"
                  actionHref="/dashboard/new-request"
                  showSteps={true}
                />
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Order ID</th>
                    {actor?.roles.includes('ADMIN') && (
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Restaurang</th>
                    )}
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Leverantör</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Importör</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Rader</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Antal</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Compliance</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Skapad</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/orders/${order.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">
                        {order.id.substring(0, 8)}...
                      </td>
                      {actor?.roles.includes('ADMIN') && (
                        <td className="px-4 py-3 text-gray-600">{order.restaurant_name || '—'}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span>{getSupplierTypeIcon(order.supplier_type)}</span>
                          <span>{order.supplier_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{order.importer_name}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} size="md" />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{order.lines_count}</td>
                      <td className="px-4 py-3 text-gray-600">{order.total_quantity}</td>
                      <td className="px-4 py-3">
                        {order.import_id ? (
                          <ImportStatusBadge status={order.import_status} size="sm" />
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/orders/${order.id}`);
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
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
