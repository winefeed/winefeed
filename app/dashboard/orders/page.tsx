'use client';

/**
 * RESTAURANT ORDERS PAGE
 *
 * View and track orders from accepted offers
 */

import { useEffect, useState } from 'react';
import {
  Package,
  Search,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  Building2,
  ChevronRight,
  Filter,
  RotateCcw,
  Minus,
  Plus,
  Loader2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface OrderLine {
  id: string;
  name: string;
  wine_sku_id?: string;
  quantity: number;
  unit_price: number;
  line_number?: number;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  delivery_date: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  supplier: {
    id: string;
    namn: string;
  };
  lines: OrderLine[];
  // Dispute fields
  dispute_status: 'none' | 'reported' | 'investigating' | 'resolved';
  dispute_reason?: string;
  dispute_reported_at?: string;
  // Payment fields
  payment_status: 'pending' | 'invoiced' | 'paid' | 'overdue' | 'refunded';
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDING: { label: 'Väntar på bekräftelse', icon: Clock, color: 'amber' },
  pending: { label: 'Väntar på bekräftelse', icon: Clock, color: 'amber' },
  CONFIRMED: { label: 'Bekräftad', icon: CheckCircle, color: 'blue' },
  confirmed: { label: 'Bekräftad', icon: CheckCircle, color: 'blue' },
  IN_FULFILLMENT: { label: 'Förbereds', icon: Package, color: 'purple' },
  SHIPPED: { label: 'Skickad', icon: Truck, color: 'indigo' },
  shipped: { label: 'Skickad', icon: Truck, color: 'indigo' },
  DELIVERED: { label: 'Levererad', icon: CheckCircle, color: 'green' },
  delivered: { label: 'Levererad', icon: CheckCircle, color: 'green' },
  CANCELLED: { label: 'Avbruten', icon: XCircle, color: 'red' },
  cancelled: { label: 'Avbruten', icon: XCircle, color: 'red' },
};

export default function RestaurantOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reorderOrder, setReorderOrder] = useState<Order | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') {
          params.set('status', statusFilter);
        }

        const res = await fetch(`/api/restaurant/orders?${params}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [statusFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, icon: Clock, color: 'gray' };
    const Icon = config.icon;

    const colorClasses: Record<string, string> = {
      amber: 'bg-amber-100 text-amber-700 border-amber-200',
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      red: 'bg-red-100 text-red-700 border-red-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200',
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        order.supplier?.namn?.toLowerCase().includes(search) ||
        order.lines?.some(line => line.name.toLowerCase().includes(search))
      );
    }
    return true;
  });

  // Count by status
  const statusCounts = {
    all: orders.length,
    pending: orders.filter(o => ['PENDING', 'pending'].includes(o.status)).length,
    confirmed: orders.filter(o => ['CONFIRMED', 'confirmed', 'IN_FULFILLMENT'].includes(o.status)).length,
    shipped: orders.filter(o => ['SHIPPED', 'shipped'].includes(o.status)).length,
    delivered: orders.filter(o => ['DELIVERED', 'delivered'].includes(o.status)).length,
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mina ordrar</h1>
        <p className="text-gray-500 mt-1">
          Följ dina beställningar och leveranser
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök på leverantör eller produkt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          <FilterButton
            label="Alla"
            count={statusCounts.all}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <FilterButton
            label="Väntar"
            count={statusCounts.pending}
            active={statusFilter === 'pending'}
            onClick={() => setStatusFilter('pending')}
            highlight={statusCounts.pending > 0}
          />
          <FilterButton
            label="Bekräftade"
            count={statusCounts.confirmed}
            active={statusFilter === 'confirmed'}
            onClick={() => setStatusFilter('confirmed')}
          />
          <FilterButton
            label="Skickade"
            count={statusCounts.shipped}
            active={statusFilter === 'shipped'}
            onClick={() => setStatusFilter('shipped')}
          />
          <FilterButton
            label="Levererade"
            count={statusCounts.delivered}
            active={statusFilter === 'delivered'}
            onClick={() => setStatusFilter('delivered')}
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {orders.length === 0 ? 'Inga ordrar än' : 'Inga ordrar matchar filtret'}
          </h3>
          <p className="text-gray-500 mb-4">
            {orders.length === 0
              ? 'När du accepterar en offert skapas en order automatiskt'
              : 'Prova att ändra filter eller sökterm'}
          </p>
          {orders.length === 0 && (
            <a
              href="/dashboard/offers"
              className="inline-flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg text-sm font-medium hover:bg-wine-hover"
            >
              Se inkomna offerter
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors"
            >
              {/* Order Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.supplier?.namn || 'Leverantör'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Order skapad {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: sv })}
                    </p>
                  </div>
                </div>
                {getStatusBadge(order.status)}
              </div>

              {/* Order Content */}
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {/* Delivery Date */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Leverans: {order.delivery_date ? format(new Date(order.delivery_date), 'd MMM yyyy', { locale: sv }) : 'Ej angiven'}
                    </span>
                  </div>

                  {/* Delivery Address */}
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600 truncate">
                      {order.delivery_address || 'Ej angiven'}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="text-sm sm:text-right">
                    <span className="text-gray-600">Totalt: </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Order Lines Preview */}
                {order.lines && order.lines.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Produkter ({order.lines.length})
                    </p>
                    <div className="space-y-1">
                      {order.lines.slice(0, 3).map((line) => (
                        <div key={line.id} className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate flex-1">
                            {line.quantity}x {line.name}
                          </span>
                          <span className="text-gray-600 ml-2">
                            {formatCurrency(line.unit_price * line.quantity)}
                          </span>
                        </div>
                      ))}
                      {order.lines.length > 3 && (
                        <p className="text-xs text-gray-500">
                          ... och {order.lines.length - 3} till
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Order Footer */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {/* Reorder button - available for confirmed, shipped, or delivered orders */}
                  {['CONFIRMED', 'confirmed', 'SHIPPED', 'shipped', 'DELIVERED', 'delivered'].includes(order.status) && order.lines?.length > 0 && (
                    <button
                      onClick={() => setReorderOrder(order)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Beställ igen
                    </button>
                  )}
                  {/* Dispute button - show if not already disputed */}
                  {order.dispute_status === 'none' && !['PENDING', 'pending', 'CANCELLED', 'cancelled'].includes(order.status) && (
                    <button
                      onClick={() => setDisputeOrder(order)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Rapportera problem
                    </button>
                  )}
                  {/* Dispute status badge */}
                  {order.dispute_status !== 'none' && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      order.dispute_status === 'reported' ? 'bg-amber-100 text-amber-700' :
                      order.dispute_status === 'investigating' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      <MessageSquare className="h-3 w-3" />
                      {order.dispute_status === 'reported' && 'Ärende rapporterat'}
                      {order.dispute_status === 'investigating' && 'Under utredning'}
                      {order.dispute_status === 'resolved' && 'Löst'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-wine hover:text-wine/80"
                >
                  Visa detaljer
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          formatCurrency={formatCurrency}
          getStatusBadge={getStatusBadge}
        />
      )}

      {/* Reorder Modal */}
      {reorderOrder && (
        <ReorderModal
          order={reorderOrder}
          onClose={() => setReorderOrder(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Dispute Modal */}
      {disputeOrder && (
        <DisputeModal
          order={disputeOrder}
          onClose={() => setDisputeOrder(null)}
          onSuccess={() => {
            // Refresh orders list
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

interface FilterButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}

function FilterButton({ label, count, active, onClick, highlight }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-wine text-white'
          : highlight
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 ${active ? 'opacity-80' : ''}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function OrderDetailModal({ order, onClose, formatCurrency, getStatusBadge }: OrderDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Orderdetaljer</h2>
            <p className="text-sm text-gray-500">{order.supplier?.namn}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status</span>
            {getStatusBadge(order.status)}
          </div>

          {/* Delivery Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Leveransdatum</p>
              <p className="font-medium text-gray-900">
                {order.delivery_date
                  ? format(new Date(order.delivery_date), 'd MMMM yyyy', { locale: sv })
                  : 'Ej angiven'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Leveransadress</p>
              <p className="font-medium text-gray-900">
                {order.delivery_address || 'Ej angiven'}
              </p>
            </div>
          </div>

          {/* Order Lines */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Produkter</p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-gray-600">Produkt</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">Antal</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">À-pris</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-600">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines?.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="p-3 text-sm text-gray-900">{line.name}</td>
                      <td className="p-3 text-sm text-gray-600 text-right">{line.quantity}</td>
                      <td className="p-3 text-sm text-gray-600 text-right">{formatCurrency(line.unit_price)}</td>
                      <td className="p-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(line.unit_price * line.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="p-3 text-sm font-medium text-gray-700 text-right">
                      Totalt
                    </td>
                    <td className="p-3 text-lg font-bold text-gray-900 text-right">
                      {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Historik</p>
            <div className="space-y-3">
              <TimelineItem
                label="Order skapad"
                date={order.created_at}
                active
              />
              {order.status !== 'PENDING' && order.status !== 'pending' && (
                <TimelineItem
                  label="Bekräftad av leverantör"
                  date={order.updated_at}
                  active
                />
              )}
              {['SHIPPED', 'shipped', 'DELIVERED', 'delivered'].includes(order.status) && (
                <TimelineItem
                  label="Skickad"
                  date={order.updated_at}
                  active
                />
              )}
              {['DELIVERED', 'delivered'].includes(order.status) && (
                <TimelineItem
                  label="Levererad"
                  date={order.updated_at}
                  active
                />
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

interface TimelineItemProps {
  label: string;
  date: string;
  active?: boolean;
}

function TimelineItem({ label, date, active }: TimelineItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
      <div className="flex-1">
        <p className={`text-sm ${active ? 'text-gray-900' : 'text-gray-500'}`}>{label}</p>
      </div>
      <p className="text-xs text-gray-400">
        {format(new Date(date), 'd MMM HH:mm', { locale: sv })}
      </p>
    </div>
  );
}

// ============================================================================
// REORDER MODAL
// ============================================================================

interface ReorderModalProps {
  order: Order;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}

function ReorderModal({ order, onClose, formatCurrency }: ReorderModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    order.lines?.forEach((line, idx) => {
      initial[line.id || `line-${idx}`] = line.quantity;
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateQuantity = (lineId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [lineId]: Math.max(1, (prev[lineId] || 1) + delta)
    }));
  };

  const setQuantity = (lineId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [lineId]: Math.max(1, value)
    }));
  };

  const totalQuantity = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const totalAmount = order.lines?.reduce((sum, line, idx) => {
    const lineId = line.id || `line-${idx}`;
    const qty = quantities[lineId] || line.quantity;
    return sum + (line.unit_price * qty);
  }, 0) || 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const lines = order.lines?.map((line, idx) => ({
        wine_sku_id: line.wine_sku_id,
        line_number: line.line_number || idx + 1,
        quantity: quantities[line.id || `line-${idx}`] || line.quantity
      }));

      const response = await fetch(`/api/restaurant/orders/${order.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Något gick fel');
      }

      setSuccess(true);

      // Redirect to requests after short delay
      setTimeout(() => {
        window.location.href = '/dashboard/requests';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Beställning skickad!
          </h2>
          <p className="text-gray-600 mb-4">
            Din återbeställning har skickats till {order.supplier?.namn}.
          </p>
          <p className="text-sm text-gray-500">
            Du omdirigeras till dina förfrågningar...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Beställ igen</h2>
                <p className="text-sm text-gray-500">{order.supplier?.namn}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <p className="text-sm text-gray-600 mb-4">
            Justera antal om du vill, sedan skickas beställningen direkt till leverantören.
          </p>

          {/* Wine lines with quantity adjustment */}
          <div className="space-y-3">
            {order.lines?.map((line, idx) => {
              const lineId = line.id || `line-${idx}`;
              const qty = quantities[lineId] || line.quantity;

              return (
                <div
                  key={lineId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-gray-900 truncate">{line.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(line.unit_price)} / st
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineId, -1)}
                      className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                      disabled={qty <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQuantity(lineId, parseInt(e.target.value) || 1)}
                      className="w-16 text-center border border-gray-300 rounded-lg py-1 text-sm"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineId, 1)}
                      className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          {/* Summary */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm text-gray-600">Totalt</p>
              <p className="text-lg font-bold text-gray-900">
                {totalQuantity} flaskor = {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              disabled={isSubmitting}
            >
              Avbryt
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Skickar...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Beställ igen
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 mt-3">
            Beställningen skickas direkt till {order.supplier?.namn}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DISPUTE MODAL
// ============================================================================

interface DisputeModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

function DisputeModal({ order, onClose, onSuccess }: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError('Beskriv problemet mer utförligt (minst 10 tecken)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/restaurant/orders/${order.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Tack för din rapport
          </h2>
          <p className="text-gray-600">
            Vi har tagit emot din reklamation och återkommer snarast.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Rapportera problem</h2>
              <p className="text-sm text-gray-500">{order.supplier?.namn}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Beskriv vad som är fel med leveransen. Vi kontaktar leverantören och återkommer till dig.
          </p>

          <div className="space-y-4">
            {/* Quick options */}
            <div className="flex flex-wrap gap-2">
              {[
                'Fel produkt levererad',
                'Skadade flaskor',
                'Saknas i leveransen',
                'Kvalitetsproblem',
              ].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(prev => prev ? `${prev}\n${option}` : option)}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Text area */}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Beskriv problemet i detalj..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 10}
            className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Skickar...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Skicka rapport
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
