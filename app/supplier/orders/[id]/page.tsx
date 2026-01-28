'use client';

/**
 * SUPPLIER ORDER DETAIL PAGE
 *
 * Shows full details of a single order and allows status updates
 */

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Wine,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';

interface OrderDetail {
  id: string;
  status: string;
  raw_status: string;
  total_price: number;
  quantity: number;
  created_at: string;
  delivery_date: string | null;
  shipping_address: string | null;
  restaurant_name: string;
  restaurant_email: string | null;
  restaurant_phone: string | null;
  restaurant_address: string | null;
  restaurant_city: string | null;
  wine_name: string;
  offer: {
    id: string;
    offered_price: number;
    notes: string | null;
    is_franco: boolean;
    shipping_cost_sek: number | null;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Väntar på bekräftelse', color: 'text-yellow-800', bgColor: 'bg-yellow-100', icon: Clock },
  confirmed: { label: 'Bekräftad', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: CheckCircle },
  shipped: { label: 'Skickad', color: 'text-purple-800', bgColor: 'bg-purple-100', icon: Truck },
  delivered: { label: 'Levererad', color: 'text-green-800', bgColor: 'bg-green-100', icon: CheckCircle },
  cancelled: { label: 'Avbruten', color: 'text-red-800', bgColor: 'bg-red-100', icon: XCircle },
};

export default function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showShipModal, setShowShipModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    try {
      // First get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        router.push('/supplier/login');
        return;
      }
      const supplierData = await supplierRes.json();

      // Fetch orders list and find this order
      const ordersRes = await fetch(`/api/suppliers/${supplierData.supplierId}/orders?status=all`);
      if (!ordersRes.ok) {
        setError('Kunde inte hämta order');
        return;
      }

      const ordersData = await ordersRes.json();
      const foundOrder = ordersData.orders?.find((o: any) => o.id === orderId);

      if (!foundOrder) {
        setError('Ordern hittades inte');
        return;
      }

      setOrder({
        id: foundOrder.id,
        status: foundOrder.status,
        raw_status: foundOrder.raw_status || foundOrder.status,
        total_price: foundOrder.total_price,
        quantity: foundOrder.quantity,
        created_at: foundOrder.created_at,
        delivery_date: foundOrder.delivery_date,
        shipping_address: foundOrder.shipping_address,
        restaurant_name: foundOrder.restaurant_name,
        restaurant_email: foundOrder.restaurant_email,
        restaurant_phone: foundOrder.restaurant_phone,
        restaurant_address: null,
        restaurant_city: null,
        wine_name: foundOrder.wine_name,
        offer: null,
      });
    } catch (err) {
      setError('Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  }

  async function confirmOrder() {
    setActionLoading('confirm');
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Kunde inte bekräfta ordern');
      }

      await fetchOrder();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function declineOrder() {
    if (!declineReason.trim()) return;

    setActionLoading('decline');
    try {
      const res = await fetch(`/api/orders/${orderId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Kunde inte avböja ordern');
      }

      setShowDeclineModal(false);
      setDeclineReason('');
      await fetchOrder();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function markAsShipped() {
    setActionLoading('ship');
    try {
      const res = await fetch(`/api/orders/${orderId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_number: trackingNumber || null }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Kunde inte markera som skickad');
      }

      setShowShipModal(false);
      setTrackingNumber('');
      await fetchOrder();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-red-800">{error || 'Kunde inte ladda order'}</h2>
          <button
            onClick={() => router.push('/supplier/orders')}
            className="mt-4 text-red-600 hover:underline"
          >
            Tillbaka till ordrar
          </button>
        </div>
      </div>
    );
  }

  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till ordrar
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-gray-400" />
              <h1 className="text-xl font-bold text-gray-900">
                Order #{order.id.slice(0, 8)}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Building2 className="h-4 w-4" />
              <span>{order.restaurant_name}</span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
            <StatusIcon className="h-4 w-4" />
            {config.label}
          </span>
        </div>

        {/* Action Buttons */}
        {order.status === 'pending' && (
          <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={confirmOrder}
              disabled={actionLoading === 'confirm'}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {actionLoading === 'confirm' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Bekräfta order
            </button>
            <button
              onClick={() => setShowDeclineModal(true)}
              disabled={!!actionLoading}
              className="flex-1 px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Avböj order
            </button>
          </div>
        )}

        {order.status === 'confirmed' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowShipModal(true)}
              disabled={!!actionLoading}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {actionLoading === 'ship' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              Markera som skickad
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400" />
            Orderdetaljer
          </h2>

          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500">Vin</dt>
              <dd className="font-medium text-gray-900 flex items-center gap-2">
                <Wine className="h-4 w-4 text-gray-400" />
                {order.wine_name}
              </dd>
            </div>

            <div className="flex justify-between">
              <dt className="text-gray-500">Antal flaskor</dt>
              <dd className="font-medium text-gray-900">{order.quantity} st</dd>
            </div>

            <div className="flex justify-between border-t border-gray-100 pt-4">
              <dt className="text-gray-900 font-medium">Totalpris</dt>
              <dd className="font-bold text-lg text-gray-900">
                {order.total_price.toLocaleString('sv-SE')} kr
              </dd>
            </div>
          </dl>
        </div>

        {/* Restaurant & Delivery */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              Restaurang
            </h2>

            <div className="space-y-3">
              <p className="font-medium text-gray-900">{order.restaurant_name}</p>

              {order.restaurant_email && (
                <a
                  href={`mailto:${order.restaurant_email}`}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <Mail className="h-4 w-4" />
                  {order.restaurant_email}
                </a>
              )}

              {order.restaurant_phone && (
                <a
                  href={`tel:${order.restaurant_phone}`}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <Phone className="h-4 w-4" />
                  {order.restaurant_phone}
                </a>
              )}
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-gray-400" />
              Leverans
            </h2>

            <div className="space-y-4">
              {order.shipping_address && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Leveransadress</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <p className="text-gray-900">{order.shipping_address}</p>
                  </div>
                </div>
              )}

              {order.delivery_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Önskat leveransdatum</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="font-medium text-gray-900">
                      {new Date(order.delivery_date).toLocaleDateString('sv-SE', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {!order.shipping_address && !order.delivery_date && (
                <p className="text-gray-500 text-sm">
                  Ingen leveransinformation angiven
                </p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Tidslinje
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">
                  Order skapad{' '}
                  {new Date(order.created_at).toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {order.status === 'confirmed' && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-blue-700 font-medium">Bekräftad av dig</span>
                </div>
              )}

              {order.status === 'shipped' && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-purple-700 font-medium">Skickad</span>
                </div>
              )}

              {order.status === 'delivered' && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-700 font-medium">Levererad</span>
                </div>
              )}

              {order.status === 'cancelled' && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-red-700 font-medium">Avbruten</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Avböj order
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ange en anledning till varför du inte kan uppfylla denna order.
              Restaurangen kommer att informeras.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="T.ex. 'Vinet är tillfälligt slut i lager'"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Avbryt
              </button>
              <button
                onClick={declineOrder}
                disabled={!declineReason.trim() || actionLoading === 'decline'}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />}
                Avböj order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ship Modal */}
      {showShipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Markera som skickad
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ange ett spårningsnummer om tillgängligt (valfritt).
            </p>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Spårningsnummer (valfritt)"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowShipModal(false);
                  setTrackingNumber('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Avbryt
              </button>
              <button
                onClick={markAsShipped}
                disabled={actionLoading === 'ship'}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'ship' && <Loader2 className="h-4 w-4 animate-spin" />}
                Bekräfta skickad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
