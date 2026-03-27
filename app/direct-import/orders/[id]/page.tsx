/**
 * IOR ORDER DETAIL PAGE
 *
 * /ior/orders/[id]
 *
 * Order detail view for IOR (Importer-of-Record).
 * Shows order summary, compliance status, order lines, and event timeline.
 * Allows status updates and import case creation.
 */

'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ImportStatusBadge } from '@/app/imports/components/ImportStatusBadge';
import { OrderStatusBadge } from '@/app/orders/components/StatusBadge';
import {
  ComplianceCard,
  ComplianceInline,
  checkImportCaseCompliance,
  checkOrderLineCompliance,
  getImportCaseSteps,
  ComplianceEditPanel,
  InlineMissingFields,
  type ComplianceStatus,
  type MissingField,
  type OrderLineComplianceData,
} from '@/components/compliance';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  Package,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn, getErrorMessage } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importör',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importör',
};

interface ActorContext {
  tenant_id: string;
  user_id: string;
  roles: string[];
  importer_id?: string;
  supplier_id?: string;
  restaurant_id?: string;
}

interface OrderRestaurant {
  name?: string;
  namn?: string;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
}

interface OrderSupplier {
  name?: string;
  namn?: string;
  type?: string;
  kontakt_email?: string;
}

interface OrderImporter {
  name?: string;
  legal_name?: string;
  org_number?: string;
  contact_email?: string;
  license_number?: string;
}

interface DeliveryLocation {
  delivery_address_line1?: string;
  postal_code?: string;
  city?: string;
}

interface ImportCase {
  id: string;
  delivery_location?: DeliveryLocation;
}

interface OrderCompliance {
  import_case_status?: string;
  ddl_status?: string;
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
    restaurant?: OrderRestaurant;
    supplier?: OrderSupplier;
    importer?: OrderImporter;
    delivery_location?: DeliveryLocation;
    import_case?: ImportCase;
    compliance?: OrderCompliance;
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
    gtin?: string | null;
    lwin?: string | null;
    abv?: number | null;
    volume_ml?: number | null;
    packaging_type?: string | null;
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

/**
 * Compliance Card Section for Import Case
 */
function ComplianceCardSection({
  order,
  lines,
  documents,
  formatDate,
}: {
  order: OrderDetail['order'];
  lines: OrderDetail['lines'];
  documents: OrderDetail['documents'];
  formatDate: (date: string) => string;
}) {
  const toast = useToast();

  const complianceResult = checkImportCaseCompliance({
    status: order.compliance?.import_case_status || 'NOT_REGISTERED',
    ddl_status: order.compliance?.ddl_status,
    has_document: documents && documents.length > 0,
    has_shipment: !!order.import_case?.delivery_location,
    lines: lines.map((l) => ({
      gtin: l.gtin,
      lwin: l.lwin,
      abv: l.abv,
      volume_ml: l.volume_ml,
      country: l.country,
    })),
  });

  const steps = getImportCaseSteps({
    status: order.compliance?.import_case_status || 'NOT_REGISTERED',
    has_identifiers: lines.some((l) => l.gtin || l.lwin),
    has_shipment: !!order.import_case?.delivery_location,
    has_required_fields: lines.every(
      (l) => (l.gtin || l.lwin) && l.abv && l.volume_ml && l.country
    ),
    has_document: documents && documents.length > 0,
  });

  const isBlocked = complianceResult.status === 'BLOCKED';

  return (
    <div className="space-y-4">
      {/* Main Compliance Card */}
      <ComplianceCard
        title="Import Case Compliance"
        status={complianceResult.status}
        missingFields={complianceResult.missingFields}
        blockReason={complianceResult.blockReason}
        steps={steps}
        collapsible={true}
        defaultExpanded={true}
        onActionClick={
          order.import_case
            ? () => (window.location.href = `/imports/${order.import_case!.id}`)
            : undefined
        }
        actionLabel="Åtgärda i Import Case"
      />

      {/* Import Case Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Import Case-detaljer
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import Case Info */}
          {order.import_case && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Import Case
                </span>
                <ImportStatusBadge
                  status={
                    order.compliance?.import_case_status || 'NOT_REGISTERED'
                  }
                  size="md"
                />
              </div>
              <p className="text-xs text-gray-600 mb-2">
                ID: {order.import_case.id.substring(0, 8)}...
              </p>
              <Link
                href={`/imports/${order.import_case.id}`}
                className="text-sm text-wine hover:underline font-medium"
              >
                Visa import case
              </Link>
            </div>
          )}

          {/* DDL Status */}
          {order.import_case?.delivery_location && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  DDL Status
                </span>
                <ImportStatusBadge
                  status={order.compliance?.ddl_status || 'UNKNOWN'}
                  size="md"
                />
              </div>
              <p className="text-sm text-gray-600">
                {order.import_case.delivery_location.delivery_address_line1}
              </p>
              <p className="text-sm text-gray-500">
                {order.import_case.delivery_location.postal_code}{' '}
                {order.import_case.delivery_location.city}
              </p>
            </div>
          )}
        </div>

        {/* 5369 Documents Section */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-700">5369 Dokument</span>
            <span className="text-sm text-gray-500">
              {documents?.length || 0} version(er)
            </span>
          </div>

          {documents && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.slice(0, 3).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">Version {doc.version}</p>
                    <p className="text-xs text-gray-500">
                      Genererad: {formatDate(doc.generated_at)}
                    </p>
                  </div>
                  {doc.file_path && (
                    <a
                      href={doc.file_path}
                      download
                      className={cn(
                        'inline-flex items-center gap-1 ml-4 px-3 py-1.5',
                        'bg-wine text-white text-xs font-medium rounded-lg',
                        'hover:bg-wine/90 transition-colors'
                      )}
                    >
                      <Download className="h-3 w-3" />
                      Ladda ner
                    </a>
                  )}
                </div>
              ))}

              {documents.length > 3 && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  + {documents.length - 3} fler version(er)
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-3">
                Inget 5369-dokument genererat ännu
              </p>
              <button
                onClick={() => {
                  if (isBlocked) return;
                  toast.info(
                    'Kommer snart',
                    '5369-generering är under utveckling'
                  );
                }}
                disabled={isBlocked}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  isBlocked
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-wine text-white hover:bg-wine/90'
                )}
                title={isBlocked ? complianceResult.blockReason : undefined}
              >
                <FileText className="h-4 w-4" />
                Generera 5369
              </button>
              {isBlocked && (
                <p className="text-xs text-red-600 mt-2">
                  Blockerad: {complianceResult.blockReason}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IOROrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const orderId = params.id;
  const toast = useToast();

  const [actor, setActor] = useState<ActorContext | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [creatingImport, setCreatingImport] = useState(false);

  // Compliance editing state
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [compliancePanelOpen, setCompliancePanelOpen] = useState(false);

  const fetchActor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/me/actor', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch actor context');

      const actorData = await response.json();
      setActor(actorData);

      const hasIORAccess =
        actorData.roles.includes('IOR') && actorData.importer_id;
      const isAdmin = actorData.roles.includes('ADMIN');

      if (!hasIORAccess && !isAdmin) {
        throw new Error(
          'Du saknar IOR-behörighet. Kontakta admin för att få åtkomst.'
        );
      }
    } catch (err) {
      console.error('Failed to fetch actor:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda användarprofil'));
      setLoading(false);
    }
  }, []);

  const fetchOrderDetail = useCallback(async () => {
    const isAdmin = actor?.roles.includes('ADMIN');
    if (!actor || (!actor.importer_id && !isAdmin)) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/direct-import/orders/${orderId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Order hittades inte');
        if (response.status === 403)
          throw new Error('Åtkomst nekad: Inte behörig för denna order');
        throw new Error('Kunde inte hämta orderdetaljer');
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
    fetchActor();
  }, [fetchActor]);

  useEffect(() => {
    const isAdmin = actor?.roles.includes('ADMIN');
    if (actor && (actor.importer_id || isAdmin)) {
      fetchOrderDetail();
    }
  }, [actor, fetchOrderDetail]);

  const updateOrderStatus = async (toStatus: string) => {
    if (!actor || !actor.importer_id) return;

    try {
      setUpdating(true);
      setUpdateSuccess(null);
      setError(null);

      const response = await fetch(`/api/direct-import/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to_status: toStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunde inte uppdatera status');
      }

      const data = await response.json();
      setUpdateSuccess(
        `Status uppdaterad: ${getStatusLabel(data.from_status)} → ${getStatusLabel(data.to_status)}`
      );

      await fetchOrderDetail();
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(getErrorMessage(err, 'Kunde inte uppdatera status'));
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

      const response = await fetch(
        `/api/direct-import/orders/${orderId}/create-import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            errorData.details ||
            'Kunde inte skapa import case'
        );
      }

      const data = await response.json();
      setUpdateSuccess(`Import case skapad: ${data.import_id}`);

      await fetchOrderDetail();
    } catch (err) {
      console.error('Failed to create import case:', err);
      setError(getErrorMessage(err, 'Kunde inte skapa import case'));
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
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'Bekräftad';
      case 'IN_FULFILLMENT':
        return 'I leverans';
      case 'SHIPPED':
        return 'Skickad';
      case 'DELIVERED':
        return 'Levererad';
      case 'CANCELLED':
        return 'Avbruten';
      default:
        return status;
    }
  };

  const getNextStatusOptions = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      CONFIRMED: ['IN_FULFILLMENT', 'CANCELLED'],
      IN_FULFILLMENT: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    return transitions[currentStatus] || [];
  };

  const calculateOrderTotal = () => {
    if (!orderDetail) return 0;
    return orderDetail.lines.reduce(
      (sum, line) => sum + (line.total_price_sek || 0),
      0
    );
  };

  const formatPrice = (amount: number, currency: string = 'SEK') => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatOrderId = (id: string) => {
    return `#${id.substring(0, 6).toUpperCase()}`;
  };

  const getEventDescription = (event: {
    event_type: string;
    from_status?: string;
    to_status?: string;
    note?: string;
  }) => {
    const descriptions: Record<string, string> = {
      ORDER_CREATED: 'Order skapad',
      ORDER_CONFIRMED: 'Order bekräftad',
      STATUS_CHANGED: event.to_status
        ? `Status ändrad till ${getStatusLabel(event.to_status)}`
        : 'Status uppdaterad',
      IMPORT_CASE_CREATED: 'Import case skapat',
      COMPLIANCE_UPDATED: 'Compliance-data uppdaterad',
      DOCUMENT_GENERATED: '5369-dokument genererat',
    };
    return descriptions[event.event_type] || event.event_type;
  };

  const toggleLineExpand = (lineId: string) => {
    setExpandedLines((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  const saveComplianceUpdates = async (
    updates: Array<{ lineId: string; data: Partial<OrderLineComplianceData> }>
  ) => {
    const response = await fetch(`/api/direct-import/orders/${orderId}/lines`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Kunde inte spara ändringar');
    }

    await fetchOrderDetail();
    setUpdateSuccess('Compliance-data uppdaterad');
  };

  const getLinesNeedingAction = () => {
    if (!orderDetail) return [];
    return orderDetail.lines.filter((line) => {
      const compliance = checkOrderLineCompliance({
        gtin: line.gtin,
        lwin: line.lwin,
        abv: line.abv,
        volume_ml: line.volume_ml,
        country: line.country,
        packaging_type: line.packaging_type,
      });
      return compliance.status !== 'OK';
    });
  };

  // Initial loading
  if (loading && !actor) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error before data loaded
  if (error && !orderDetail) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="mb-4">
          <Link
            href="/direct-import/orders"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-wine transition-colors font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till ordrar
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Fel</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setError(null);
                    if (error.includes('IOR-behörighet')) {
                      fetchActor();
                    } else {
                      fetchOrderDetail();
                    }
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-wine text-white hover:bg-wine/90'
                  )}
                >
                  Försök igen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    if (loading) {
      return (
        <div className="py-6 px-4 lg:px-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  const { order, lines, events } = orderDetail;
  const nextStatusOptions = getNextStatusOptions(order.status);

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/direct-import/orders"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-wine transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till ordrar
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Order {formatOrderId(orderId)}
            </h1>
            <OrderStatusBadge status={order.status} size="md" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {order.restaurant?.name || 'Okänd restaurang'} →{' '}
            {order.supplier?.namn || 'Okänd leverantör'}
          </p>
        </div>

        {/* Status actions */}
        {nextStatusOptions.length > 0 && (
          <div className="flex items-center gap-2">
            {nextStatusOptions.map((status) => (
              <button
                key={status}
                onClick={() => updateOrderStatus(status)}
                disabled={updating}
                className={cn(
                  'px-4 py-2 rounded-lg transition-colors text-sm font-medium',
                  status === 'CANCELLED'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-wine text-white hover:bg-wine/90',
                  updating && 'opacity-50 cursor-not-allowed'
                )}
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `→ ${getStatusLabel(status)}`
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Success message */}
        {updateSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
            {updateSuccess}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Orderöversikt
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Restaurant Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Restaurang
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-gray-900">
                  {order.restaurant?.name ||
                    order.restaurant?.namn ||
                    'Namn saknas'}
                </p>
                {order.restaurant?.contact_email && (
                  <p className="text-sm text-gray-600 mt-1">
                    {order.restaurant.contact_email}
                  </p>
                )}
                {order.restaurant?.contact_phone && (
                  <p className="text-sm text-gray-600">
                    {order.restaurant.contact_phone}
                  </p>
                )}
                {order.restaurant?.city && (
                  <p className="text-sm text-gray-500 mt-1">
                    {order.restaurant.city}
                  </p>
                )}
              </div>
            </div>

            {/* Supplier Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Leverantör
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-gray-900">
                  {order.supplier?.namn ||
                    order.supplier?.name ||
                    'Namn saknas'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {SUPPLIER_TYPE_LABELS[order.supplier?.type || ''] ||
                    order.supplier?.type ||
                    'Okänd typ'}
                </p>
                {order.supplier?.kontakt_email && (
                  <p className="text-sm text-gray-600 mt-1">
                    {order.supplier.kontakt_email}
                  </p>
                )}
              </div>
            </div>

            {/* IOR Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Importer-of-Record
              </h3>
              <div className="bg-wine/5 p-4 rounded-lg border border-wine/20">
                <p className="font-semibold text-gray-900">
                  {order.importer?.legal_name ||
                    order.importer?.name ||
                    'IOR saknas'}
                </p>
                {order.importer?.org_number && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Org.nr: {order.importer.org_number}
                  </p>
                )}
                {order.importer?.contact_email && (
                  <p className="text-sm text-gray-600 mt-1">
                    {order.importer.contact_email}
                  </p>
                )}
                {order.importer?.license_number && (
                  <p className="text-xs text-gray-500 mt-1">
                    Licens: {order.importer.license_number}
                  </p>
                )}
              </div>
            </div>

            {/* Order Metadata */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Orderinfo
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Antal rader:</span>
                  <span className="font-medium text-gray-900">
                    {order.total_lines}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Total kvantitet:
                  </span>
                  <span className="font-medium text-gray-900">
                    {order.total_quantity} fl
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-sm font-medium text-gray-700">
                    Ordervärde:
                  </span>
                  <span className="font-bold text-lg text-gray-900">
                    {formatPrice(calculateOrderTotal(), order.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Skapad:</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Section */}
        {order.import_case ? (
          <ComplianceCardSection
            order={order}
            lines={lines}
            documents={orderDetail?.documents || []}
            formatDate={formatDate}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Compliance & Import Case
            </h2>
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                <Package className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium mb-2">
                Ingen import case kopplad till denna order
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {order.supplier?.type === 'EU_PRODUCER' ||
                order.supplier?.type === 'EU_IMPORTER'
                  ? 'Detta är en EU-order och kräver en import case för compliance.'
                  : 'Import case krävs bara för EU-ordrar.'}
              </p>

              {(order.supplier?.type === 'EU_PRODUCER' ||
                order.supplier?.type === 'EU_IMPORTER') && (
                <button
                  onClick={createImportCase}
                  disabled={creatingImport}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors',
                    creatingImport
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-wine text-white hover:bg-wine/90'
                  )}
                >
                  {creatingImport ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Skapar...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Skapa Import Case
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Order Lines */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Orderrader ({lines.length})
            </h2>
            {getLinesNeedingAction().length > 0 && (
              <button
                onClick={() => setCompliancePanelOpen(true)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-amber-500 text-white hover:bg-amber-600'
                )}
              >
                <Edit3 className="h-4 w-4" />
                Åtgärda alla ({getLinesNeedingAction().length})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Vin
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Producent
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Årg.
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Land
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Compliance
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Antal
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Enhet
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Á-pris
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Totalt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => {
                  const lineCompliance = checkOrderLineCompliance({
                    gtin: line.gtin,
                    lwin: line.lwin,
                    abv: line.abv,
                    volume_ml: line.volume_ml,
                    country: line.country,
                    packaging_type: line.packaging_type,
                  });
                  const isExpanded = expandedLines.has(line.id);
                  const needsAction = lineCompliance.status !== 'OK';

                  return (
                    <React.Fragment key={line.id}>
                      <tr
                        className={cn(
                          'hover:bg-gray-50 transition-colors',
                          isExpanded && 'bg-amber-50'
                        )}
                      >
                        <td className="px-4 py-3 text-gray-600">
                          {line.line_number}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {line.wine_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {line.producer || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {line.vintage || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {line.country || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              needsAction && toggleLineExpand(line.id)
                            }
                            className={cn(
                              'inline-flex items-center gap-1',
                              needsAction
                                ? 'cursor-pointer hover:opacity-80'
                                : 'cursor-default'
                            )}
                            title={
                              needsAction
                                ? 'Klicka för att visa/redigera saknade fält'
                                : 'Alla fält ifyllda'
                            }
                          >
                            <ComplianceInline
                              status={lineCompliance.status}
                              missingCount={
                                lineCompliance.missingFields.filter(
                                  (f) => f.severity === 'required'
                                ).length
                              }
                            />
                            {needsAction &&
                              (isExpanded ? (
                                <ChevronUp className="h-3 w-3 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-gray-400" />
                              ))}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {line.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {line.unit_price_sek
                            ? `${line.unit_price_sek.toFixed(2)} kr`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {line.total_price_sek
                            ? `${line.total_price_sek.toFixed(2)} kr`
                            : '—'}
                        </td>
                      </tr>

                      {/* Expanded row showing missing fields */}
                      {isExpanded && (
                        <tr className="bg-amber-50 border-l-4 border-amber-400">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="flex items-start gap-4">
                              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium text-amber-800 mb-2">
                                  Saknade fält för compliance:
                                </p>
                                <InlineMissingFields
                                  fields={lineCompliance.missingFields}
                                  maxShow={10}
                                />

                                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div className="bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-500 text-xs">
                                      GTIN:
                                    </span>
                                    <p
                                      className={cn(
                                        'font-medium',
                                        line.gtin
                                          ? 'text-gray-900'
                                          : 'text-red-500'
                                      )}
                                    >
                                      {line.gtin || 'Saknas'}
                                    </p>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-500 text-xs">
                                      LWIN:
                                    </span>
                                    <p
                                      className={cn(
                                        'font-medium',
                                        line.lwin
                                          ? 'text-gray-900'
                                          : 'text-red-500'
                                      )}
                                    >
                                      {line.lwin || 'Saknas'}
                                    </p>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-500 text-xs">
                                      ABV:
                                    </span>
                                    <p
                                      className={cn(
                                        'font-medium',
                                        line.abv
                                          ? 'text-gray-900'
                                          : 'text-red-500'
                                      )}
                                    >
                                      {line.abv ? `${line.abv}%` : 'Saknas'}
                                    </p>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-gray-200">
                                    <span className="text-gray-500 text-xs">
                                      Volym:
                                    </span>
                                    <p
                                      className={cn(
                                        'font-medium',
                                        line.volume_ml
                                          ? 'text-gray-900'
                                          : 'text-red-500'
                                      )}
                                    >
                                      {line.volume_ml
                                        ? `${line.volume_ml} ml`
                                        : 'Saknas'}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={() =>
                                    setCompliancePanelOpen(true)
                                  }
                                  className={cn(
                                    'mt-3 inline-flex items-center gap-2 px-3 py-1.5',
                                    'bg-amber-500 text-white rounded-lg text-sm font-medium',
                                    'hover:bg-amber-600 transition-colors'
                                  )}
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Redigera
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance Edit Panel */}
        <ComplianceEditPanel
          isOpen={compliancePanelOpen}
          onClose={() => setCompliancePanelOpen(false)}
          lines={lines.map((line) => ({
            id: line.id,
            wine_name: line.wine_name,
            producer: line.producer,
            vintage: line.vintage,
            country: line.country,
            gtin: line.gtin,
            lwin: line.lwin,
            abv: line.abv,
            volume_ml: line.volume_ml,
            packaging_type: line.packaging_type,
          }))}
          onSave={saveComplianceUpdates}
          title="Redigera compliance-data"
        />

        {/* Events Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Händelselogg ({events.length})
          </h2>
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Inga händelser ännu
              </p>
            ) : (
              events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-wine rounded-full"></div>
                    {index < events.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {getEventDescription(event)}
                        </p>
                        {event.from_status && event.to_status && (
                          <p className="text-sm text-gray-500">
                            {getStatusLabel(event.from_status)} →{' '}
                            {getStatusLabel(event.to_status)}
                          </p>
                        )}
                        {event.note && (
                          <p className="text-sm text-gray-500 mt-1">
                            {event.note}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Av: {event.actor_name || 'System'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
