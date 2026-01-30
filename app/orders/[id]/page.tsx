/**
 * ORDER DETAIL PAGE
 *
 * /orders/[id]
 *
 * Order details view (read-only)
 *
 * Features:
 * - Visual order progress tracker (stepper)
 * - Delivery tracking information
 * - View order summary (supplier, importer, status)
 * - View order lines (wines, quantities)
 * - View order events timeline (expandable)
 * - View compliance summary for EU orders
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { OrderStatusBadge } from '@/app/orders/components/StatusBadge';
import { useActor } from '@/lib/hooks/useActor';
import { getErrorMessage } from '@/lib/utils';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Wine
} from 'lucide-react';

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importor',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importor',
};

// Carrier tracking URL templates
const CARRIER_TRACKING_URLS: Record<string, string> = {
  'dhl': 'https://www.dhl.com/se-sv/home/tracking.html?tracking-id={tracking}',
  'postnord': 'https://tracking.postnord.com/se/?id={tracking}',
  'ups': 'https://www.ups.com/track?tracknum={tracking}',
  'schenker': 'https://www.dbschenker.com/se-sv/spara-forsandelse?tracking={tracking}',
  'fedex': 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  'bring': 'https://tracking.bring.se/tracking/{tracking}',
  'dsv': 'https://www.dsv.com/sv-se/vara-losningar/spara-din-forsandelse?trackingNumber={tracking}',
};

function getTrackingUrl(carrier: string | undefined, trackingNumber: string): string | null {
  if (!carrier) return null;

  const carrierKey = carrier.toLowerCase().replace(/[^a-z]/g, '');

  // Find matching carrier
  for (const [key, urlTemplate] of Object.entries(CARRIER_TRACKING_URLS)) {
    if (carrierKey.includes(key) || key.includes(carrierKey)) {
      return urlTemplate.replace('{tracking}', encodeURIComponent(trackingNumber));
    }
  }

  return null;
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
    supplier?: { namn?: string; type?: string; kontakt_email?: string };
    importer?: { legal_name?: string; contact_email?: string };
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
    metadata?: Record<string, any>;
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

const STATUS_STEPS = [
  { key: 'CONFIRMED', label: 'Bekraftad', icon: CheckCircle2, description: 'Order mottagen' },
  { key: 'IN_FULFILLMENT', label: 'Forbereds', icon: Package, description: 'Packas for leverans' },
  { key: 'SHIPPED', label: 'Skickad', icon: Truck, description: 'Pa vag' },
  { key: 'DELIVERED', label: 'Levererad', icon: MapPin, description: 'Framme' },
];

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const orderId = params.id;
  const { actor, loading: actorLoading } = useActor();

  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  const fetchOrderDetail = useCallback(async () => {
    if (!actor) return;

    const isAdmin = actor.roles.includes('ADMIN');
    if (!isAdmin && !actor.restaurant_id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/restaurant/orders/${orderId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Order hittades inte');
        }
        if (response.status === 403) {
          throw new Error('Atkomst nekad');
        }
        throw new Error('Kunde inte hamta orderdetaljer');
      }

      const data = await response.json();
      setOrderDetail(data);
    } catch (err) {
      console.error('Failed to fetch order details:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda order'));
    } finally {
      setLoading(false);
    }
  }, [actor, orderId]);

  useEffect(() => {
    if (!actorLoading && actor) {
      const hasAccess = actor.roles.includes('ADMIN') || (actor.roles.includes('RESTAURANT') && actor.restaurant_id);
      if (!hasAccess) {
        setError('Du saknar behorighet');
        setLoading(false);
        return;
      }
      fetchOrderDetail();
    }
  }, [actor, actorLoading, fetchOrderDetail]);

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
    const labels: Record<string, string> = {
      'PENDING_SUPPLIER_CONFIRMATION': 'Vantande',
      'CONFIRMED': 'Bekraftad',
      'IN_FULFILLMENT': 'I leverans',
      'SHIPPED': 'Skickad',
      'DELIVERED': 'Levererad',
      'CANCELLED': 'Avbruten',
    };
    return labels[status] || status;
  };

  const getCurrentStepIndex = (status: string) => {
    if (status === 'CANCELLED' || status === 'PENDING_SUPPLIER_CONFIRMATION') return -1;
    return STATUS_STEPS.findIndex(s => s.key === status);
  };

  const copyTrackingNumber = async (tracking: string) => {
    await navigator.clipboard.writeText(tracking);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-32 bg-muted rounded-lg mb-4"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error && !orderDetail) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nagot gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/orders"
              className="px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg"
            >
              Tillbaka till ordrar
            </Link>
            <button
              onClick={fetchOrderDetail}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Forsok igen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!orderDetail) return null;

  const { order, lines, events, compliance } = orderDetail;
  const currentStep = getCurrentStepIndex(order.status);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Order {orderId.substring(0, 8)}...
            </h1>
            <p className="text-muted-foreground">
              Skapad {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} size="lg" />
          <button
            onClick={fetchOrderDetail}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Order Progress Stepper */}
      {order.status !== 'CANCELLED' && order.status !== 'PENDING_SUPPLIER_CONFIRMATION' && (
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">Orderstatus</h2>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-border mx-16">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.max(0, (currentStep / (STATUS_STEPS.length - 1)) * 100)}%` }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.key} className="flex flex-col items-center" style={{ width: '25%' }}>
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                        isCompleted
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}`}
                    >
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <p className={`mt-3 text-sm font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    <p className={`text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                      {step.description}
                    </p>
                    {step.key === 'SHIPPED' && order.shipped_at && (
                      <p className="text-xs text-primary mt-1">{formatDate(order.shipped_at)}</p>
                    )}
                    {step.key === 'DELIVERED' && order.delivered_at && (
                      <p className="text-xs text-primary mt-1">{formatDate(order.delivered_at)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pending/Cancelled Banners */}
      {order.status === 'PENDING_SUPPLIER_CONFIRMATION' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 flex items-center gap-4">
          <Clock className="h-6 w-6 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Vantar pa leverantorsbekraftelse</p>
            <p className="text-sm text-amber-700">Du far besked nar leverantoren svarar.</p>
          </div>
        </div>
      )}

      {order.status === 'CANCELLED' && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 flex items-center gap-4">
          <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
            <span className="text-destructive-foreground text-sm font-bold">X</span>
          </div>
          <div>
            <p className="font-medium text-destructive">Order avbruten</p>
            <p className="text-sm text-destructive/80">Se handelseloggen for mer information.</p>
          </div>
        </div>
      )}

      {/* Delivery Tracking */}
      {(order.tracking_number || order.carrier || order.estimated_delivery) && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium text-foreground">Leveranssparning</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {order.carrier && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Transportor</p>
                <p className="font-medium">{order.carrier}</p>
              </div>
            )}
            {order.tracking_number && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Sparningsnummer</p>
                <div className="flex items-center gap-2">
                  {getTrackingUrl(order.carrier, order.tracking_number) ? (
                    <a
                      href={getTrackingUrl(order.carrier, order.tracking_number)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {order.tracking_number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="font-mono font-medium">{order.tracking_number}</p>
                  )}
                  <button
                    onClick={() => copyTrackingNumber(order.tracking_number!)}
                    className="p-1 hover:bg-accent rounded transition-colors"
                    title="Kopiera"
                  >
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {copiedTracking && <span className="text-xs text-primary">Kopierat!</span>}
                </div>
              </div>
            )}
            {order.estimated_delivery && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Beraknad leverans</p>
                <p className="font-medium text-primary">
                  {new Date(order.estimated_delivery).toLocaleDateString('sv-SE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Order Info */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Orderinfo</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Antal rader</span>
              <span className="font-medium">{order.total_lines}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total kvantitet</span>
              <span className="font-medium">{order.total_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valuta</span>
              <span className="font-medium">{order.currency}</span>
            </div>
          </div>
        </div>

        {/* Supplier */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Leverantor</h3>
          <p className="font-medium text-foreground">{order.supplier?.namn || '-'}</p>
          <p className="text-xs text-muted-foreground">{SUPPLIER_TYPE_LABELS[order.supplier?.type || ''] || order.supplier?.type}</p>
          {order.supplier?.kontakt_email && (
            <p className="text-sm text-muted-foreground mt-1">{order.supplier.kontakt_email}</p>
          )}
        </div>

        {/* Importer */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Importor (IOR)</h3>
          <p className="font-medium text-foreground">{order.importer?.legal_name || '-'}</p>
          {order.importer?.contact_email && (
            <p className="text-sm text-muted-foreground mt-1">{order.importer.contact_email}</p>
          )}
        </div>
      </div>

      {/* Compliance */}
      {compliance?.import_case_id && (
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Compliance (EU-order)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Import Status</span>
              <ImportStatusBadge status={compliance.import_status || 'NOT_REGISTERED'} size="sm" />
            </div>
            {compliance.ddl_status && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">DDL Status</span>
                <ImportStatusBadge status={compliance.ddl_status} size="sm" />
              </div>
            )}
            {compliance.latest_5369_version && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">5369 Doc</span>
                <span className="text-sm font-medium">v{compliance.latest_5369_version}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Lines */}
      <div className="bg-card rounded-lg border border-border overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-medium text-foreground">Orderrader ({lines.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Vin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Producent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Arg.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Land</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Antal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">A-pris</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Totalt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <Wine className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Inga orderrader</p>
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="hover:bg-accent/50">
                    <td className="px-4 py-3 text-muted-foreground">{line.line_number}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{line.wine_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{line.producer || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{line.vintage || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{line.country || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">{line.quantity} {line.unit}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {line.unit_price_sek ? `${line.unit_price_sek.toFixed(0)} kr` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {line.total_price_sek ? `${line.total_price_sek.toFixed(0)} kr` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="font-medium text-foreground mb-4">Handelselogg ({events.length})</h3>
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Inga handelser annu</p>
          ) : (
            events.map((event, index) => {
              const getEventStyle = (type: string) => {
                if (type.includes('CREATED')) return { color: 'bg-green-500', label: 'Order skapad' };
                if (type.includes('CONFIRMED')) return { color: 'bg-blue-500', label: 'Bekraftad' };
                if (type.includes('SHIPPED')) return { color: 'bg-indigo-500', label: 'Skickad' };
                if (type.includes('DELIVERED')) return { color: 'bg-green-600', label: 'Levererad' };
                if (type.includes('CANCELLED') || type.includes('DECLINED')) return { color: 'bg-red-500', label: 'Avbruten' };
                if (type.includes('FULFILLMENT')) return { color: 'bg-purple-500', label: 'I leverans' };
                return { color: 'bg-gray-500', label: type.replace(/_/g, ' ') };
              };

              const style = getEventStyle(event.event_type);
              const isExpanded = expandedEventId === event.id;
              const hasDetails = event.metadata && Object.keys(event.metadata).length > 0;

              return (
                <div key={event.id} className="flex gap-3">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 ${style.color} rounded-full`}></div>
                    {index < events.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1"></div>}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 pb-4">
                    <div
                      className={`bg-muted/50 rounded-lg p-3 ${hasDetails ? 'cursor-pointer hover:bg-muted' : ''}`}
                      onClick={() => hasDetails && setExpandedEventId(isExpanded ? null : event.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${style.color}`}>
                            {style.label}
                          </span>
                          {hasDetails && (
                            isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                      </div>

                      {event.from_status && event.to_status && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {getStatusLabel(event.from_status)} → <span className="text-foreground">{getStatusLabel(event.to_status)}</span>
                        </p>
                      )}

                      {event.note && (
                        <p className="text-sm text-foreground mt-2 italic">&ldquo;{event.note}&rdquo;</p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        Av: {event.actor_name || 'System'}
                      </p>

                      {/* Expanded details */}
                      {isExpanded && event.metadata && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground uppercase mb-2">Metadata</p>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
