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
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

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
  currency: string;
  created_at: string;
  restaurant_name: string;
  restaurant_contact_email: string;
  supplier_name: string;
  supplier_type: string;
}

export default function IOROrdersPage() {
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

      // Middleware sets x-user-id from Supabase auth session
      const response = await fetch('/api/me/actor', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch actor context');
      }

      const actorData = await response.json();
      setActor(actorData);

      // Verify IOR access
      if (!actorData.roles.includes('IOR') || !actorData.importer_id) {
        throw new Error('Du saknar IOR-behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err: any) {
      console.error('Failed to fetch actor:', err);
      setError(err.message || 'Kunde inte ladda användarprofil');
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!actor || !actor.importer_id) return;

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
    if (actor && actor.importer_id) {
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

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              Orders ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">📭</span>
              <p className="text-gray-500 text-lg">Inga orders ännu</p>
              {statusFilter !== 'ALL' && (
                <p className="text-gray-400 text-sm mt-2">
                  Prova ett annat filter eller <button onClick={() => setStatusFilter('ALL')} className="text-blue-600 underline">visa alla</button>
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Order ID</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Restaurang</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Leverantör</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Rader</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Antal</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Skapad</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/ior/orders/${order.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">
                        {order.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{order.restaurant_name}</div>
                          <div className="text-xs text-gray-500">{order.restaurant_contact_email}</div>
                        </div>
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
                      <td className="px-4 py-3 text-gray-600">{order.total_lines}</td>
                      <td className="px-4 py-3 text-gray-600">{order.total_quantity}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/ior/orders/${order.id}`);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
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
