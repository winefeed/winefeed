/**
 * ADMIN ORDERS PAGE
 *
 * /admin/orders
 *
 * Manage all orders with concierge mode toggle
 * "Vi hanterar allt åt er" - pilot feature
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  Package,
  RefreshCw,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  ChevronDown,
  ChevronUp,
  Handshake,
  MessageSquare,
  Save,
  ExternalLink,
  AlertTriangle,
  CreditCard,
  FileText,
} from 'lucide-react';

interface Order {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  supplier_name: string;
  supplier_type: string | null;
  importer_name: string;
  restaurant_name: string;
  restaurant_id: string;
  import_id: string | null;
  import_status: string | null;
  lines_count: number;
  total_quantity: number;
  currency: string;
  handled_by_winefeed: boolean;
  concierge_notes: string | null;
  concierge_handled_at: string | null;
  // Dispute fields
  dispute_status: 'none' | 'reported' | 'investigating' | 'resolved';
  dispute_reason: string | null;
  dispute_reported_at: string | null;
  // Payment fields
  payment_status: 'pending' | 'invoiced' | 'paid' | 'overdue' | 'refunded';
  payment_due_date: string | null;
  invoice_number: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Package; color: string }> = {
  CONFIRMED: { label: 'Bekräftad', icon: CheckCircle, color: 'bg-blue-100 text-blue-800' },
  IN_FULFILLMENT: { label: 'Under hantering', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  SHIPPED: { label: 'Skickad', icon: Truck, color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: 'Levererad', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Avbruten', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ej fakturerad', color: 'bg-gray-100 text-gray-700' },
  invoiced: { label: 'Fakturerad', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Betald', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Förfallen', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Återbetald', color: 'bg-purple-100 text-purple-700' },
};

const DISPUTE_CONFIG: Record<string, { label: string; color: string }> = {
  none: { label: 'Ingen', color: 'bg-gray-100 text-gray-500' },
  reported: { label: 'Rapporterad', color: 'bg-amber-100 text-amber-700' },
  investigating: { label: 'Utreds', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Löst', color: 'bg-green-100 text-green-700' },
};

export default function AdminOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [conciergeFilter, setConciergeFilter] = useState<string>('ALL');
  const [disputeFilter, setDisputeFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      params.set('limit', '100');

      const response = await fetch(`/api/admin/orders?${params}`);
      if (!response.ok) throw new Error('Failed to fetch orders');

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      toast.error('Kunde inte hämta ordrar');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleConcierge = async (orderId: string, currentValue: boolean) => {
    setSaving(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handled_by_winefeed: !currentValue }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? { ...o, handled_by_winefeed: !currentValue, concierge_handled_at: !currentValue ? new Date().toISOString() : o.concierge_handled_at }
            : o
        )
      );

      toast.success(!currentValue ? 'Concierge-läge aktiverat' : 'Concierge-läge avaktiverat');
    } catch (error) {
      toast.error('Kunde inte uppdatera order');
    } finally {
      setSaving(null);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setSaving(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      toast.success('Status uppdaterad');
    } catch (error) {
      toast.error('Kunde inte uppdatera status');
    } finally {
      setSaving(null);
    }
  };

  const saveNotes = async (orderId: string) => {
    setSaving(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concierge_notes: notesValue }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, concierge_notes: notesValue } : o))
      );

      setEditingNotes(null);
      toast.success('Anteckningar sparade');
    } catch (error) {
      toast.error('Kunde inte spara anteckningar');
    } finally {
      setSaving(null);
    }
  };

  const updatePaymentStatus = async (orderId: string, newStatus: string) => {
    setSaving(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, payment_status: newStatus as Order['payment_status'] } : o))
      );

      toast.success('Betalningsstatus uppdaterad');
    } catch (error) {
      toast.error('Kunde inte uppdatera betalningsstatus');
    } finally {
      setSaving(null);
    }
  };

  const updateDisputeStatus = async (orderId: string, newStatus: string) => {
    setSaving(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispute_status: newStatus,
          ...(newStatus === 'resolved' ? { dispute_resolved_at: new Date().toISOString() } : {})
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, dispute_status: newStatus as Order['dispute_status'] } : o))
      );

      toast.success('Reklamationsstatus uppdaterad');
    } catch (error) {
      toast.error('Kunde inte uppdatera reklamationsstatus');
    } finally {
      setSaving(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (conciergeFilter === 'CONCIERGE' && !order.handled_by_winefeed) return false;
    if (conciergeFilter === 'NORMAL' && order.handled_by_winefeed) return false;
    if (disputeFilter !== 'ALL' && order.dispute_status !== disputeFilter) return false;
    if (paymentFilter !== 'ALL' && order.payment_status !== paymentFilter) return false;
    return true;
  });

  const conciergeCount = orders.filter(o => o.handled_by_winefeed).length;
  const disputeCount = orders.filter(o => o.dispute_status !== 'none').length;
  const unpaidCount = orders.filter(o => o.payment_status === 'pending' || o.payment_status === 'overdue').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orderhantering</h1>
          <p className="text-gray-600 mt-1">
            Hantera ordrar och aktivera concierge-läge
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Uppdatera
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Totalt</p>
          <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Concierge</p>
          <p className="text-2xl font-bold text-wine">{conciergeCount}</p>
        </div>
        <div className={`bg-white rounded-lg border p-4 ${disputeCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
          <p className="text-sm text-gray-500">Reklamationer</p>
          <p className={`text-2xl font-bold ${disputeCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{disputeCount}</p>
        </div>
        <div className={`bg-white rounded-lg border p-4 ${unpaidCount > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
          <p className="text-sm text-gray-500">Ej betalda</p>
          <p className={`text-2xl font-bold ${unpaidCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{unpaidCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Levererade</p>
          <p className="text-2xl font-bold text-green-600">
            {orders.filter(o => o.status === 'DELIVERED').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="ALL">Alla statusar</option>
            <option value="CONFIRMED">Bekräftad</option>
            <option value="IN_FULFILLMENT">Under hantering</option>
            <option value="SHIPPED">Skickad</option>
            <option value="DELIVERED">Levererad</option>
            <option value="CANCELLED">Avbruten</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hantering</label>
          <select
            value={conciergeFilter}
            onChange={(e) => setConciergeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="ALL">Alla ordrar</option>
            <option value="CONCIERGE">Concierge-ordrar</option>
            <option value="NORMAL">Vanliga ordrar</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reklamation</label>
          <select
            value={disputeFilter}
            onChange={(e) => setDisputeFilter(e.target.value)}
            className={`px-3 py-2 border rounded-lg text-sm ${disputeFilter !== 'ALL' ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}
          >
            <option value="ALL">Alla</option>
            <option value="reported">Rapporterade</option>
            <option value="investigating">Under utredning</option>
            <option value="resolved">Lösta</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Betalning</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className={`px-3 py-2 border rounded-lg text-sm ${paymentFilter !== 'ALL' ? 'border-blue-300 bg-blue-50' : 'border-gray-300'}`}
          >
            <option value="ALL">Alla</option>
            <option value="pending">Ej fakturerad</option>
            <option value="invoiced">Fakturerad</option>
            <option value="paid">Betald</option>
            <option value="overdue">Förfallen</option>
            <option value="refunded">Återbetald</option>
          </select>
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Laddar ordrar...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Inga ordrar hittades</div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.CONFIRMED;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedOrder === order.id;
            const isSaving = saving === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-lg border ${order.handled_by_winefeed ? 'border-wine/30 bg-wine/5' : 'border-gray-200'}`}
              >
                {/* Order header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Concierge badge */}
                      {order.handled_by_winefeed && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-wine/10 text-wine rounded-full text-xs font-medium">
                          <Handshake className="h-3 w-3" />
                          Concierge
                        </div>
                      )}

                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </span>

                      {/* Dispute badge */}
                      {order.dispute_status !== 'none' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${DISPUTE_CONFIG[order.dispute_status].color}`}>
                          <AlertTriangle className="h-3 w-3" />
                          {DISPUTE_CONFIG[order.dispute_status].label}
                        </span>
                      )}

                      {/* Payment badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${PAYMENT_CONFIG[order.payment_status || 'pending'].color}`}>
                        <CreditCard className="h-3 w-3" />
                        {PAYMENT_CONFIG[order.payment_status || 'pending'].label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-400">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Restaurang</p>
                      <p className="font-medium text-gray-900 truncate">{order.restaurant_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Leverantör</p>
                      <p className="font-medium text-gray-900 truncate">{order.supplier_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Antal</p>
                      <p className="font-medium text-gray-900">{order.total_quantity} flaskor</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Skapad</p>
                      <p className="font-medium text-gray-900">
                        {new Date(order.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 space-y-4">
                    {/* Concierge toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Handshake className="h-5 w-5 text-wine" />
                        <div>
                          <p className="font-medium text-gray-900">Concierge-läge</p>
                          <p className="text-sm text-gray-500">
                            Winefeed hanterar ordern åt kunden
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleConcierge(order.id, order.handled_by_winefeed);
                        }}
                        disabled={isSaving}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          order.handled_by_winefeed ? 'bg-wine' : 'bg-gray-300'
                        } ${isSaving ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            order.handled_by_winefeed ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Dispute section */}
                    {order.dispute_status !== 'none' && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <p className="font-medium text-gray-900">Reklamation</p>
                          </div>
                          <select
                            value={order.dispute_status}
                            onChange={(e) => updateDisputeStatus(order.id, e.target.value)}
                            disabled={isSaving}
                            className="px-2 py-1 text-xs border border-amber-300 rounded-lg bg-white"
                          >
                            <option value="reported">Rapporterad</option>
                            <option value="investigating">Under utredning</option>
                            <option value="resolved">Löst</option>
                          </select>
                        </div>
                        <p className="text-sm text-gray-700 bg-white p-2 rounded border border-amber-100">
                          {order.dispute_reason || 'Ingen beskrivning'}
                        </p>
                        {order.dispute_reported_at && (
                          <p className="text-xs text-gray-500 mt-2">
                            Rapporterad: {new Date(order.dispute_reported_at).toLocaleString('sv-SE')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Payment section */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-gray-600" />
                          <p className="font-medium text-gray-900">Betalning</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={order.payment_status || 'pending'}
                            onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                            disabled={isSaving}
                            className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                          >
                            <option value="pending">Ej fakturerad</option>
                            <option value="invoiced">Fakturerad</option>
                            <option value="paid">Betald</option>
                            <option value="overdue">Förfallen</option>
                            <option value="refunded">Återbetald</option>
                          </select>
                        </div>
                      </div>
                      {order.invoice_number && (
                        <p className="text-xs text-gray-500 mt-2">
                          Fakturanr: {order.invoice_number}
                        </p>
                      )}
                    </div>

                    {/* Concierge notes */}
                    {order.handled_by_winefeed && (
                      <div className="p-4 bg-wine/5 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-wine" />
                          <p className="font-medium text-gray-900">Concierge-anteckningar</p>
                        </div>
                        {editingNotes === order.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                              placeholder="T.ex. 'Kontaktat leverantör 2/2, väntar på bekräftelse'"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveNotes(order.id)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine/90 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                                Spara
                              </button>
                              <button
                                onClick={() => setEditingNotes(null)}
                                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotes(order.id);
                              setNotesValue(order.concierge_notes || '');
                            }}
                            className="text-sm text-gray-600 cursor-pointer hover:bg-wine/10 p-2 rounded-lg transition-colors"
                          >
                            {order.concierge_notes || (
                              <span className="italic text-gray-400">Klicka för att lägga till anteckningar...</span>
                            )}
                          </div>
                        )}
                        {order.concierge_handled_at && (
                          <p className="text-xs text-gray-500 mt-2">
                            Aktiverat: {new Date(order.concierge_handled_at).toLocaleString('sv-SE')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status change */}
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-medium text-gray-700">Ändra status:</p>
                      <div className="flex gap-2">
                        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                          <button
                            key={status}
                            onClick={() => updateStatus(order.id, status)}
                            disabled={isSaving || order.status === status}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              order.status === status
                                ? config.color
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } disabled:opacity-50`}
                          >
                            {config.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Order ID */}
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-400">
                        Order-ID: {order.id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
