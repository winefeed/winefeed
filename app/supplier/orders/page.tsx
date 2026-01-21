'use client';

/**
 * SUPPLIER ORDERS PAGE
 *
 * View and manage orders from accepted offers
 */

import { useEffect, useState } from 'react';
import { Package, Clock, Building2, Truck, CheckCircle, XCircle, ChevronRight, AlertCircle } from 'lucide-react';

interface Order {
  id: string;
  offer_id: string;
  restaurant_name: string;
  wine_name: string;
  quantity: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  delivery_date: string | null;
  shipping_address: string | null;
}

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped'>('pending');
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  async function fetchOrders() {
    try {
      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Fetch orders
      const ordersRes = await fetch(
        `/api/suppliers/${supplierData.supplierId}/orders?status=${filter}`
      );
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Ny order', color: 'bg-blue-100 text-blue-800', icon: Clock },
    confirmed: { label: 'Bekräftad', color: 'bg-amber-100 text-amber-800', icon: CheckCircle },
    shipped: { label: 'Skickad', color: 'bg-purple-100 text-purple-800', icon: Truck },
    delivered: { label: 'Levererad', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    cancelled: { label: 'Avbruten', color: 'bg-red-100 text-red-800', icon: XCircle },
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ordrar</h1>
        <p className="text-gray-500 mt-1">
          Hantera beställningar från accepterade offerter
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['pending', 'confirmed', 'shipped', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'Alla' : statusConfig[status]?.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const config = statusConfig[order.status];
            const StatusIcon = config?.icon || Clock;

            return (
              <a
                key={order.id}
                href={`/supplier/orders/${order.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Restaurant */}
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {order.restaurant_name}
                      </span>
                    </div>

                    {/* Order details */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{order.wine_name}</span>
                      <span>•</span>
                      <span>{order.quantity} flaskor</span>
                      <span>•</span>
                      <span className="font-medium">
                        {order.total_price.toLocaleString('sv-SE')} kr
                      </span>
                    </div>

                    {/* Delivery info */}
                    {order.delivery_date && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <Truck className="h-4 w-4" />
                        <span>
                          Leverans: {new Date(order.delivery_date).toLocaleDateString('sv-SE')}
                        </span>
                      </div>
                    )}

                    {/* Time */}
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>
                        Order skapad {new Date(order.created_at).toLocaleDateString('sv-SE', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status & Arrow */}
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {config?.label}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Inga ordrar
          </h3>
          <p className="text-gray-500 mb-4">
            {filter === 'all'
              ? 'Du har inga ordrar ännu. Ordrar skapas när restauranger accepterar dina offerter.'
              : `Inga ordrar med status "${statusConfig[filter]?.label.toLowerCase()}".`}
          </p>
          <a
            href="/supplier/offers"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            Se offerter →
          </a>
        </div>
      )}

      {/* Stats summary */}
      {orders.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {orders.length}
            </p>
            <p className="text-sm text-gray-500">Totalt</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter((o) => o.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-500">Nya</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {orders.filter((o) => o.status === 'shipped').length}
            </p>
            <p className="text-sm text-gray-500">Skickade</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {orders.filter((o) => o.status === 'delivered').length}
            </p>
            <p className="text-sm text-gray-500">Levererade</p>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">Orderflöde</h3>
            <p className="text-sm text-blue-700 mt-1">
              När en restaurang accepterar din offert skapas en order automatiskt.
              Bekräfta ordern och uppdatera status när du skickar leveransen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
