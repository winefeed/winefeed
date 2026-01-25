/**
 * IOR ORDER DETAIL PAGE - EU-SELLER → IOR OPERATIONAL FLOW
 *
 * /ior/orders/[id]
 *
 * Order detail view for IOR (Importer-of-Record)
 *
 * Features:
 * - View order summary (restaurant, supplier, delivery info)
 * - View order lines (wines, quantities, prices)
 * - View order events timeline (audit trail)
 * - Update order status (CONFIRMED → IN_FULFILLMENT → SHIPPED → DELIVERED)
 *
 * MVP: Uses hardcoded IMPORTER_ID for testing
 * Production: Get importer_id from authenticated user context
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
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
    restaurant: any;
    supplier: any;
    importer: any;
    delivery_location: any;
    import_case: any;
    compliance: any;
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
  documents?: Array<{
    id: string;
    document_type: string;
    version: number;
    generated_at: string;
    file_path: string | null;
    file_size: number | null;
  }>;
}

export default function IOROrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const orderId = params.id;

  const [actor, setActor] = useState<ActorContext | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [creatingImport, setCreatingImport] = useState(false);

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

  const fetchOrderDetail = useCallback(async () => {
    if (!actor || !actor.importer_id) return;

    try {
      setLoading(true);
      setError(null);

      // Middleware sets x-user-id and x-tenant-id from Supabase auth session
      const response = await fetch(`/api/ior/orders/${orderId}`, {
        credentials: 'include'
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
    if (actor && actor.importer_id) {
      fetchOrderDetail();
    }
  }, [actor, fetchOrderDetail]);

  const updateOrderStatus = async (toStatus: string) => {
    if (!actor || !actor.importer_id) return;

    try {
      setUpdating(true);
      setUpdateSuccess(null);
      setError(null);

      // Middleware sets x-user-id and x-tenant-id from Supabase auth session
      const response = await fetch(`/api/ior/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ to_status: toStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      const data = await response.json();
      setUpdateSuccess(`Status uppdaterad: ${data.from_status} → ${data.to_status}`);

      // Refresh order details
      await fetchOrderDetail();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      setError(err.message || 'Kunde inte uppdatera status');
    } finally {
      setUpdating(false);
    }
  };

  const createImportCase = async () => {
    if (!actor || !actor.importer_id) return;

    try {
      setCreatingImport(true);
      setUpdateSuccess(null);
      setError(null);

      // Middleware sets x-user-id and x-tenant-id from Supabase auth session
      const response = await fetch(`/api/ior/orders/${orderId}/create-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to create import case');
      }

      const data = await response.json();
      setUpdateSuccess(`Import case skapad: ${data.import_id}`);

      // Refresh order details
      await fetchOrderDetail();
    } catch (err: any) {
      console.error('Failed to create import case:', err);
      setError(err.message || 'Kunde inte skapa import case');
    } finally {
      setCreatingImport(false);
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

  const getNextStatusOptions = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      'CONFIRMED': ['IN_FULFILLMENT', 'CANCELLED'],
      'IN_FULFILLMENT': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'CANCELLED'],
      'DELIVERED': [],
      'CANCELLED': []
    };
    return transitions[currentStatus] || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar order...</p>
        </div>
      </div>
    );
  }

  if (error && !orderDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/ior/orders')}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Tillbaka till lista
              </button>
              <button
                onClick={() => {
                  setError(null);
                  if (error.includes('IOR-behörighet')) {
                    fetchActor();
                  } else {
                    fetchOrderDetail();
                  }
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Försök igen
              </button>
              {error.includes('IOR-behörighet') && (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Dashboard →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    return null;
  }

  const { order, lines, events } = orderDetail;
  const nextStatusOptions = getNextStatusOptions(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/ior/orders')}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
              >
                ← Tillbaka
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Order {orderId.substring(0, 8)}...</h1>
                <p className="text-sm text-white/80">Order detaljer och fulfillment</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/supplier')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                Supplier Portal
              </button>
              <button
                onClick={() => router.push('/supplier/orders')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                Mina försäljningar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Success/Error Messages */}
        {updateSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
            ✓ {updateSuccess}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            ✗ {error}
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Order Summary</h2>
            <OrderStatusBadge status={order.status} size="md" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Restaurant Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Restaurang</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold text-lg">{order.restaurant?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-600">{order.restaurant?.contact_email}</p>
                <p className="text-sm text-gray-600">{order.restaurant?.contact_phone}</p>
                {order.restaurant?.address && (
                  <p className="text-sm text-gray-500 mt-2">{order.restaurant.address}</p>
                )}
              </div>
            </div>

            {/* Supplier Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Leverantör</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold text-lg">{order.supplier?.namn || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{order.supplier?.type}</p>
                <p className="text-sm text-gray-600">{order.supplier?.kontakt_email}</p>
                <p className="text-sm text-gray-600">{order.supplier?.kontakt_telefon}</p>
              </div>
            </div>

            {/* IOR Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Importer-of-Record</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="font-bold text-lg">{order.importer?.legal_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">Org.nr: {order.importer?.org_number}</p>
                <p className="text-sm text-gray-600">{order.importer?.contact_email}</p>
                <p className="text-xs text-gray-500 mt-2">Licens: {order.importer?.license_number || 'N/A'}</p>
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

        {/* Compliance Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Compliance & Import Case</h2>

          {order.import_case ? (
            <div className="space-y-4">
              {/* Import Case Status */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Import Case Status</span>
                  <ImportStatusBadge status={order.compliance?.import_case_status || 'NOT_REGISTERED'} size="md" />
                </div>
                <p className="text-xs text-gray-600 mb-2">Import ID: {order.import_case.id}</p>
                <a
                  href={`/imports/${order.import_case.id}`}
                  className="text-sm text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  → Visa import case detaljer
                </a>
              </div>

              {/* DDL Status */}
              {order.import_case.delivery_location && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Direct Delivery Location (DDL)</span>
                    <ImportStatusBadge status={order.compliance?.ddl_status || 'UNKNOWN'} size="md" />
                  </div>
                  <p className="text-sm text-gray-600">
                    {order.import_case.delivery_location.delivery_address_line1}
                  </p>
                  <p className="text-sm text-gray-600">
                    {order.import_case.delivery_location.postal_code} {order.import_case.delivery_location.city}
                  </p>
                </div>
              )}

              {/* 5369 Documents */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">5369 Documents</span>
                  <span className="text-sm text-gray-600">
                    {orderDetail?.documents?.length || 0} version(s)
                  </span>
                </div>

                {orderDetail?.documents && orderDetail.documents.length > 0 ? (
                  <div className="space-y-2">
                    {orderDetail.documents.slice(0, 3).map((doc: any, index: number) => (
                      <div key={doc.id} className="flex items-center justify-between bg-white p-2 rounded border border-purple-100">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Version {doc.version}</p>
                          <p className="text-xs text-gray-500">
                            Generated: {formatDate(doc.generated_at)}
                          </p>
                        </div>
                        {doc.file_path && (
                          <a
                            href={doc.file_path}
                            download
                            className="ml-4 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                          >
                            ⬇ Download
                          </a>
                        )}
                      </div>
                    ))}

                    {orderDetail.documents.length > 3 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        + {orderDetail.documents.length - 3} fler version(er)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">No 5369 documents generated yet</p>
                    <button
                      onClick={() => {
                        // TODO: Implement 5369 generation via existing endpoint
                        alert('5369 generation: Coming soon! Use existing /api/imports/[id]/generate-5369 endpoint');
                      }}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                    >
                      📄 Generate 5369
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <span className="text-5xl mb-3 block">📦</span>
              <p className="text-gray-600 mb-4">No import case linked to this order</p>
              <p className="text-sm text-gray-500 mb-6">
                {order.supplier?.type === 'EU_PRODUCER' || order.supplier?.type === 'EU_IMPORTER'
                  ? 'This is an EU order and requires an import case for compliance.'
                  : 'Import cases are required for EU orders only.'}
              </p>

              {(order.supplier?.type === 'EU_PRODUCER' || order.supplier?.type === 'EU_IMPORTER') && (
                <button
                  onClick={createImportCase}
                  disabled={creatingImport}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {creatingImport ? 'Creating...' : '+ Create Import Case'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status Update Actions */}
        {nextStatusOptions.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Uppdatera Status</h2>
            <div className="flex gap-3">
              {nextStatusOptions.map(status => (
                <button
                  key={status}
                  onClick={() => updateOrderStatus(status)}
                  disabled={updating}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {updating ? 'Uppdaterar...' : `→ ${getStatusLabel(status)}`}
                </button>
              ))}
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
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
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
