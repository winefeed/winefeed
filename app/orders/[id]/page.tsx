/**
 * RESTAURANT ORDER TRACKING - DETAIL PAGE
 *
 * /orders/[id]
 *
 * Restaurant view for order details (read-only)
 *
 * Features:
 * - Visual order progress tracker (stepper)
 * - Delivery tracking information
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

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { OrderStatusBadge } from '@/app/orders/components/StatusBadge';
import { Package, Truck, CheckCircle2, Clock, MapPin, ExternalLink } from 'lucide-react';

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
    // Tracking info
    tracking_number?: string;
    carrier?: string;
    estimated_delivery?: string;
    shipped_at?: string;
    delivered_at?: string;
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

      // Verify RESTAURANT access
      if (!actorData.roles.includes('RESTAURANT') || !actorData.restaurant_id) {
        throw new Error('Du saknar RESTAURANT-behörighet. Kontakta admin för att få åtkomst.');
      }
    } catch (err: any) {
      console.error('Failed to fetch actor:', err);
      setError(err.message || 'Kunde inte ladda användarprofil');
      setLoading(false);
    }
  }, []);

  const fetchOrderDetail = useCallback(async () => {
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
  }, [actor, orderId]);

  // Fetch actor context on mount
  useEffect(() => {
    fetchActor();
  }, [fetchActor]);

  // Fetch order when actor is ready
  useEffect(() => {
    if (actor && actor.restaurant_id) {
      fetchOrderDetail();
    }
  }, [actor, fetchOrderDetail]);

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

  // Define order status steps for progress tracker
  const statusSteps = [
    { key: 'CONFIRMED', label: 'Bekräftad', icon: CheckCircle2, description: 'Order mottagen' },
    { key: 'IN_FULFILLMENT', label: 'Förbereds', icon: Package, description: 'Packas för leverans' },
    { key: 'SHIPPED', label: 'Skickad', icon: Truck, description: 'På väg till dig' },
    { key: 'DELIVERED', label: 'Levererad', icon: MapPin, description: 'Framme hos dig' },
  ];

  const getCurrentStepIndex = () => {
    if (order.status === 'CANCELLED') return -1;
    if (order.status === 'PENDING_SUPPLIER_CONFIRMATION') return -1;
    return statusSteps.findIndex(s => s.key === order.status);
  };

  const currentStep = getCurrentStepIndex();

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
        {/* Order Progress Tracker */}
        {order.status !== 'CANCELLED' && order.status !== 'PENDING_SUPPLIER_CONFIRMATION' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6">Orderstatus</h2>

            {/* Progress Steps */}
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 mx-12">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${Math.max(0, (currentStep / (statusSteps.length - 1)) * 100)}%` }}
                />
              </div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {statusSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;

                  return (
                    <div key={step.key} className="flex flex-col items-center" style={{ width: '25%' }}>
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                          isCompleted
                            ? 'bg-green-500 text-white shadow-lg'
                            : 'bg-gray-200 text-gray-400'
                        } ${isCurrent ? 'ring-4 ring-green-200 scale-110' : ''}`}
                      >
                        <StepIcon className="h-6 w-6" />
                      </div>
                      <p className={`mt-3 text-sm font-medium ${isCompleted ? 'text-green-700' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      <p className={`text-xs ${isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>
                        {step.description}
                      </p>
                      {/* Show timestamp if available */}
                      {step.key === 'SHIPPED' && order.shipped_at && (
                        <p className="text-xs text-green-600 mt-1">
                          {formatDate(order.shipped_at)}
                        </p>
                      )}
                      {step.key === 'DELIVERED' && order.delivered_at && (
                        <p className="text-xs text-green-600 mt-1">
                          {formatDate(order.delivered_at)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Delivery Tracking */}
        {(order.tracking_number || order.carrier || order.estimated_delivery) && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Leveransspårning</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {order.carrier && (
                <div className="bg-white/70 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Transportör</p>
                  <p className="text-lg font-semibold text-gray-800">{order.carrier}</p>
                </div>
              )}

              {order.tracking_number && (
                <div className="bg-white/70 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Spårningsnummer</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono font-semibold text-gray-800">{order.tracking_number}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(order.tracking_number || '');
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Kopiera"
                    >
                      <ExternalLink className="h-4 w-4 text-blue-500" />
                    </button>
                  </div>
                </div>
              )}

              {order.estimated_delivery && (
                <div className="bg-white/70 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Beräknad leverans</p>
                  <p className="text-lg font-semibold text-green-700">
                    {new Date(order.estimated_delivery).toLocaleDateString('sv-SE', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
              )}
            </div>

            {order.status === 'SHIPPED' && (
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Din order är på väg! Du får ett meddelande när den levereras.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pending Supplier Confirmation Banner */}
        {order.status === 'PENDING_SUPPLIER_CONFIRMATION' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-400 rounded-full">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-amber-800">Väntar på leverantörsbekräftelse</h3>
                <p className="text-amber-700">
                  Leverantören har inte bekräftat ordern ännu. Du får besked så snart de svarar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cancelled Order Banner */}
        {order.status === 'CANCELLED' && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500 rounded-full">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-800">Order avbruten</h3>
                <p className="text-red-700">
                  Denna order har avbrutits. Se händelseloggen nedan för mer information.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Orderdetaljer</h2>
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
          <h2 className="text-xl font-bold text-gray-800 mb-4">Händelselogg ({events.length})</h2>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Inga händelser ännu</p>
            ) : (
              events.map((event, index) => {
                // Determine event styling based on type
                const getEventStyle = (type: string) => {
                  if (type.includes('CREATED')) return { bg: 'bg-green-500', text: 'Order skapad' };
                  if (type.includes('CONFIRMED')) return { bg: 'bg-blue-500', text: 'Bekräftad' };
                  if (type.includes('SHIPPED')) return { bg: 'bg-indigo-500', text: 'Skickad' };
                  if (type.includes('DELIVERED')) return { bg: 'bg-green-600', text: 'Levererad' };
                  if (type.includes('CANCELLED') || type.includes('DECLINED')) return { bg: 'bg-red-500', text: 'Avbruten' };
                  if (type.includes('FULFILLMENT')) return { bg: 'bg-purple-500', text: 'I leverans' };
                  return { bg: 'bg-gray-500', text: type.replace(/_/g, ' ') };
                };

                const eventStyle = getEventStyle(event.event_type);

                return (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 ${eventStyle.bg} rounded-full shadow-sm`}></div>
                      {index < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1"></div>}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`px-2 py-1 text-xs font-medium text-white rounded ${eventStyle.bg}`}>
                            {eventStyle.text}
                          </span>
                          <p className="text-xs text-gray-500">{formatDate(event.created_at)}</p>
                        </div>
                        {event.from_status && event.to_status && (
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">{getStatusLabel(event.from_status)}</span>
                            <span className="mx-2">→</span>
                            <span className="font-medium text-green-700">{getStatusLabel(event.to_status)}</span>
                          </p>
                        )}
                        {event.note && (
                          <p className="text-sm text-gray-700 mt-2 italic">&ldquo;{event.note}&rdquo;</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Av: {event.actor_name || 'System'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
