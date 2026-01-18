/**
 * RESTAURANT ORDER TRACKING - DETAIL PAGE
 *
 * /orders/[id]
 *
 * Restaurant view for order details (read-only)
 *
 * Features:
 * - View order summary (supplier, importer, status)
 * - View order lines (wines, quantities)
 * - View order events timeline (audit trail)
 * - View compliance summary for EU orders (read-only)
 *
 * Actor Resolution:
 * - Fetches current user's actor context from /api/me/actor
 * - Verifies user has RESTAURANT role and restaurant_id
 * - Verifies order belongs to user's restaurant
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { OrderStatusBadge } from '@/app/orders/components/StatusBadge';

// MVP: Hardcoded tenant for testing
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

interface OrderDetail {
  order: {
    id: string;
    restaurant_id: string;
    seller_supplier_id: string;
    importer_of_record_id: string;
    status: string;
    total_lines: number;
    total_quantity: number;
    currency: string;
    created_at: string;
    updated_at: string;
    supplier: any;
    importer: any;
  };
  lines: Array<{
    id: string;
    wine_name: string;
    producer: string;
    vintage: string;
    country: string;
    region: string;
    quantity: number;
    unit: string;
    unit_price_sek: number;
    total_price_sek: number;
    line_number: number;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    from_status: string;
    to_status: string;
    note: string;
    actor_name: string;
    created_at: string;
  }>;
  compliance: {
    import_case_id: string | null;
    import_status: string | null;
    ddl_status: string | null;
    ddl_address: string | null;
    latest_5369_version: number | null;
    latest_5369_generated_at: string | null;
  } | null;
}

export default function RestaurantOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const orderId = params.id;

  const [actor, setActor] = useState<ActorContext | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch actor context on mount
  useEffect(() => {
    fetchActor();
  }, []);

  // Fetch order when actor is ready
  useEffect(() => {
    if (actor && actor.restaurant_id) {
      fetchOrderDetail();
    }
  }, [actor, orderId]);

  const fetchActor = async () => {
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

      // Verify RESTAURANT access
      if (!actorData.roles.includes('RESTAURANT') || !actorData.restaurant_id) {
        throw new Error('Du saknar RESTAURANT-behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err: any) {
      console.error('Failed to fetch actor:', err);
      setError(err.message || 'Kunde inte ladda användarprofil');
      setLoading(false);
    }
  };

  const fetchOrderDetail = async () => {
    if (!actor || !actor.restaurant_id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/restaurant/orders/${orderId}`, {
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-user-id': USER_ID
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Order not found');
        }
        if (response.status === 403) {
          throw new Error('Access denied: Not authorized for this order');
        }
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      setOrderDetail(data);
    } catch (err: any) {
      console.error('Failed to fetch order details:', err);
      setError(err.message || 'Kunde inte ladda order');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar order...</p>
        </div>
      </div>
    );
  }

  if (error && !orderDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/orders')}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Tillbaka till lista
              </button>
              <button
                onClick={() => {
                  setError(null);
                  if (error.includes('RESTAURANT-behörighet')) {
                    fetchActor();
                  } else {
                    fetchOrderDetail();
                  }
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🔄 Försök igen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    return null;
  }

  const { order, lines, events, compliance } = orderDetail;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/orders')}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
              >
                ← Tillbaka
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Order {orderId.substring(0, 8)}...</h1>
                <p className="text-sm text-white/80">Order detaljer</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Order Summary</h2>
            <OrderStatusBadge status={order.status} size="md" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supplier Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Leverantör</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold text-lg">{order.supplier?.namn || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{order.supplier?.type}</p>
                <p className="text-sm text-gray-600">{order.supplier?.kontakt_email}</p>
              </div>
            </div>

            {/* Importer Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Importör (IOR)</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="font-bold text-lg">{order.importer?.legal_name || 'Unknown'}</p>
                <p className="text-sm text-gray-600">{order.importer?.contact_email}</p>
              </div>
            </div>

            {/* Order Metadata */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Order Info</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Antal rader:</span>
                  <span className="font-medium">{order.total_lines}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total kvantitet:</span>
                  <span className="font-medium">{order.total_quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valuta:</span>
                  <span className="font-medium">{order.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Skapad:</span>
                  <span className="text-xs">{formatDate(order.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Section (Read-Only) */}
        {compliance && compliance.import_case_id && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Compliance Status (EU Order)</h2>

            <div className="space-y-4">
              {/* Import Case Status */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Import Case Status</span>
                  <ImportStatusBadge status={compliance.import_status || 'NOT_REGISTERED'} size="md" />
                </div>
                <p className="text-xs text-gray-600">Import ID: {compliance.import_case_id}</p>
              </div>

              {/* DDL Status */}
              {compliance.ddl_status && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Direct Delivery Location (DDL)</span>
                    <ImportStatusBadge status={compliance.ddl_status} size="md" />
                  </div>
                  {compliance.ddl_address && (
                    <p className="text-sm text-gray-600">{compliance.ddl_address}</p>
                  )}
                </div>
              )}

              {/* 5369 Document Status */}
              {compliance.latest_5369_version !== null && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">5369 Document</span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500 text-white">
                      Version {compliance.latest_5369_version}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Generated: {compliance.latest_5369_generated_at ? formatDate(compliance.latest_5369_generated_at) : 'N/A'}
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500 italic">
                📋 Compliance status is managed by the IOR (Importer-of-Record). Contact them for details.
              </p>
            </div>
          </div>
        )}

        {/* Order Lines */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Order Rader ({lines.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Vin</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Producent</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Årg.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Land</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Antal</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Enhet</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Á-pris</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Totalt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{line.line_number}</td>
                    <td className="px-4 py-3 font-medium">{line.wine_name}</td>
                    <td className="px-4 py-3 text-gray-600">{line.producer || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{line.vintage || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{line.country || '—'}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{line.quantity}</td>
                    <td className="px-4 py-3 text-gray-600">{line.unit}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {line.unit_price_sek ? `${line.unit_price_sek.toFixed(2)} kr` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {line.total_price_sek ? `${line.total_price_sek.toFixed(2)} kr` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Events Timeline */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Event Timeline ({events.length})</h2>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Inga events ännu</p>
            ) : (
              events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    {index < events.length - 1 && <div className="w-0.5 h-full bg-gray-300 mt-1"></div>}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{event.event_type}</p>
                        {event.from_status && event.to_status && (
                          <p className="text-sm text-gray-600">
                            {event.from_status} → {event.to_status}
                          </p>
                        )}
                        {event.note && <p className="text-sm text-gray-500 mt-1">{event.note}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          Av: {event.actor_name || 'System'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(event.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
