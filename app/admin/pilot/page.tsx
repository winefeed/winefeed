/**
 * PILOT ADMIN CONSOLE
 *
 * /admin/pilot
 *
 * Shows recent requests, offers, and events for debugging pilot flows
 * without needing direct DB access.
 *
 * Features:
 * - Three tabs: Requests | Offers | Events
 * - Email masking in events
 * - Links to detailed views
 * - Auto-refresh capability
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertBadge } from '../components/AlertBadge';
import { getAlertColor } from '@/lib/design-system/alert-colors';
import { RefreshCw, ArrowLeft, AlertTriangle, ChevronRight, ChevronDown, Package, FileText, Lightbulb, TrendingUp, Inbox, Bell, XCircle, Check, X } from 'lucide-react';

interface Request {
  id: string;
  fritext: string;
  restaurant_name: string;
  restaurant_email: string;
  created_at: string;
}

interface Offer {
  id: string;
  title: string;
  status: string;
  restaurant_name: string;
  supplier_name: string;
  request_id: string | null;
  accepted_at: string | null;
  created_at: string;
}

interface Event {
  id: string;
  offer_id: string;
  event_type: string;
  payload: {
    type?: string;
    to?: string;
    success?: boolean;
    error?: string;
    note?: string;
  };
  created_at: string;
}

interface AlertItem {
  id?: string; // For backwards compatibility
  created_at?: string;
  updated_at?: string;
  status?: string;
  ddl_status?: string;
  to?: string; // Legacy field (for old offer_events format)
  error?: string;
  offer_id?: string; // Legacy field (for old offer_events format)
  // New fields for unified email failures
  source?: 'offer_events' | 'order_events';
  event_id?: string;
  template?: string;
  to_masked?: string;
  success?: boolean;
  entity?: {
    offer_id?: string;
    order_id?: string;
  };
  action_hint?: string;
}

interface Alerts {
  eu_orders_without_import_case: { count: number; items: AlertItem[] };
  import_cases_missing_ddl_or_not_approved: { count: number; items: AlertItem[] };
  approved_import_cases_missing_5369: { count: number; items: AlertItem[] };
  orders_stuck_over_3_days: { count: number; items: AlertItem[] };
  email_failures_last_24h: { count: number; items: AlertItem[] };
}

interface TimingStat {
  median_hours: number | null;
  p90_hours: number | null;
  sample_size: number;
}

interface PilotMetrics {
  counts: {
    requests_created: number;
    offers_created: number;
    offers_sent: number;
    offers_accepted: number;
    orders_created: number;
    imports_created: number;
    imports_approved: number;
    orders_shipped: number;
  };
  timings: {
    request_to_offer_created: TimingStat;
    offer_created_to_accepted: TimingStat;
    accept_to_order_created: TimingStat;
    order_created_to_import_approved: TimingStat;
  };
}

interface OverviewData {
  tenant_id: string;
  recent_requests: Request[];
  recent_offers: Offer[];
  recent_events: Event[];
  alerts: Alerts;
  pilot_metrics: PilotMetrics;
  timestamp: string;
}

type TabType = 'requests' | 'offers' | 'events';

export default function PilotAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/pilot/overview', {
        headers: {
          
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Unauthorized: Admin access required. Set ADMIN_MODE=true in .env.local');
        }
        throw new Error('Failed to fetch pilot overview');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch pilot overview:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda pilot overview'));
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-500';
      case 'DRAFT': return 'bg-muted-foreground';
      case 'SENT': return 'bg-yellow-500';
      case 'ACCEPTED': return 'bg-green-500';
      case 'REJECTED': return 'bg-red-500';
      case 'CLOSED': return 'bg-foreground';
      default: return 'bg-muted-foreground';
    }
  };

  const getEventTypeBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'CREATED': return 'bg-blue-500';
      case 'UPDATED': return 'bg-yellow-500';
      case 'ACCEPTED': return 'bg-green-500';
      case 'REJECTED': return 'bg-red-500';
      case 'MAIL_SENT': return 'bg-primary';
      default: return 'bg-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Laddar pilot overview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-5">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pilot Konsol</h1>
          <p className="text-muted-foreground mt-1">Övervaka flöden: förfrågningar → offerter → ordrar</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchOverview}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mb-6 text-sm text-muted-foreground">
        Senast uppdaterad: {formatDate(data.timestamp)}
      </div>

      {/* Pilot Ops Alerts Section */}
      {data.alerts && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-foreground">Driftsvarningar</h2>
            <span className="text-sm text-muted-foreground">(Operationella varningar för pilotövervakning)</span>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Alert 1: EU Orders Without Import Case */}
              <div className={`bg-card rounded-lg border overflow-hidden ${getAlertColor('ERROR').borderClass}`}>
                <button
                  onClick={() => setExpandedAlert(expandedAlert === 'eu_orders' ? null : 'eu_orders')}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-red-600 uppercase mb-1">EU-ordrar</div>
                      <div className="text-sm text-foreground">Saknar importärende</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertBadge
                        count={data.alerts.eu_orders_without_import_case.count}
                        severity={data.alerts.eu_orders_without_import_case.count > 0 ? 'ERROR' : 'OK'}
                      />
                      {expandedAlert === 'eu_orders' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {expandedAlert === 'eu_orders' && data.alerts.eu_orders_without_import_case.items.length > 0 && (
                  <div className="px-4 py-3 bg-muted border-t border-border">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.alerts.eu_orders_without_import_case.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          onClick={() => item.id && router.push(`/direct-import/orders/${item.id}`)}
                          className="text-xs bg-card p-2 rounded border border-border cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-primary">{item.id?.substring(0, 16) || 'N/A'}...</div>
                            <ChevronRight className="h-3 w-3 text-primary" />
                          </div>
                          <div className="text-muted-foreground mt-1">Created: {formatDate(item.created_at!)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alert 2: Import Cases Missing DDL */}
              <div className={`bg-card rounded-lg border overflow-hidden ${getAlertColor('WARNING').borderClass}`}>
                <button
                  onClick={() => setExpandedAlert(expandedAlert === 'missing_ddl' ? null : 'missing_ddl')}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-orange-600 uppercase mb-1">Importärenden</div>
                      <div className="text-sm text-foreground">Saknar/ej godkänd DDL</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertBadge
                        count={data.alerts.import_cases_missing_ddl_or_not_approved.count}
                        severity={data.alerts.import_cases_missing_ddl_or_not_approved.count > 0 ? 'WARNING' : 'OK'}
                      />
                      {expandedAlert === 'missing_ddl' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {expandedAlert === 'missing_ddl' && data.alerts.import_cases_missing_ddl_or_not_approved.items.length > 0 && (
                  <div className="px-4 py-3 bg-muted border-t border-border">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.alerts.import_cases_missing_ddl_or_not_approved.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          onClick={() => item.id && router.push(`/direct-import/orders/${item.id}`)}
                          className="text-xs bg-card p-2 rounded border border-border cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-primary">{item.id?.substring(0, 16) || 'N/A'}...</div>
                            <ChevronRight className="h-3 w-3 text-primary" />
                          </div>
                          <div className="text-muted-foreground mt-1">
                            DDL Status: <span className="font-medium">{item.ddl_status || 'MISSING'}</span>
                          </div>
                          <div className="text-muted-foreground">Created: {formatDate(item.created_at!)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alert 3: Approved Imports Missing 5369 */}
              <div className={`bg-card rounded-lg border overflow-hidden ${getAlertColor('INFO').borderClass}`}>
                <button
                  onClick={() => setExpandedAlert(expandedAlert === 'missing_5369' ? null : 'missing_5369')}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-yellow-600 uppercase mb-1">Godkända importer</div>
                      <div className="text-sm text-foreground">Saknar 5369-dok</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertBadge
                        count={data.alerts.approved_import_cases_missing_5369.count}
                        severity={data.alerts.approved_import_cases_missing_5369.count > 0 ? 'INFO' : 'OK'}
                      />
                      {expandedAlert === 'missing_5369' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {expandedAlert === 'missing_5369' && data.alerts.approved_import_cases_missing_5369.items.length > 0 && (
                  <div className="px-4 py-3 bg-muted border-t border-border">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.alerts.approved_import_cases_missing_5369.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          onClick={() => item.id && router.push(`/direct-import/orders/${item.id}`)}
                          className="text-xs bg-card p-2 rounded border border-border cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-primary">{item.id?.substring(0, 16) || 'N/A'}...</div>
                            <ChevronRight className="h-3 w-3 text-primary" />
                          </div>
                          <div className="text-muted-foreground mt-1">Created: {formatDate(item.created_at!)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alert 4: Orders Stuck Over 3 Days */}
              <div className={`bg-card rounded-lg border overflow-hidden ${getAlertColor('SPECIAL').borderClass}`}>
                <button
                  onClick={() => setExpandedAlert(expandedAlert === 'stuck_orders' ? null : 'stuck_orders')}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-primary uppercase mb-1">Fastnade ordrar</div>
                      <div className="text-sm text-foreground">Ingen uppdatering &gt; 3 dagar</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertBadge
                        count={data.alerts.orders_stuck_over_3_days.count}
                        severity={data.alerts.orders_stuck_over_3_days.count > 0 ? 'SPECIAL' : 'OK'}
                      />
                      {expandedAlert === 'stuck_orders' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {expandedAlert === 'stuck_orders' && data.alerts.orders_stuck_over_3_days.items.length > 0 && (
                  <div className="px-4 py-3 bg-muted border-t border-border">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.alerts.orders_stuck_over_3_days.items.map((item, index) => (
                        <div
                          key={item.id || index}
                          onClick={() => item.id && router.push(`/direct-import/orders/${item.id}`)}
                          className="text-xs bg-card p-2 rounded border border-border cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-primary">{item.id?.substring(0, 16) || 'N/A'}...</div>
                            <ChevronRight className="h-3 w-3 text-primary" />
                          </div>
                          <div className="text-muted-foreground mt-1">Status: <span className="font-medium">{item.status}</span></div>
                          <div className="text-muted-foreground">Last Update: {formatDate(item.updated_at!)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alert 5: Email Failures Last 24h */}
              <div className={`bg-card rounded-lg border overflow-hidden ${getAlertColor('EMAIL_FAILURE').borderClass}`}>
                <button
                  onClick={() => setExpandedAlert(expandedAlert === 'email_failures' ? null : 'email_failures')}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-pink-600 uppercase mb-1">E-postfel</div>
                      <div className="text-sm text-foreground">Senaste 24 timmar</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertBadge
                        count={data.alerts.email_failures_last_24h.count}
                        severity={data.alerts.email_failures_last_24h.count > 0 ? 'EMAIL_FAILURE' : 'OK'}
                      />
                      <span className="text-muted-foreground">{expandedAlert === 'email_failures' ? '▼' : '▶'}</span>
                    </div>
                  </div>
                </button>
                {expandedAlert === 'email_failures' && data.alerts.email_failures_last_24h.items.length > 0 && (
                  <div className="px-4 py-3 bg-muted border-t border-border">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {data.alerts.email_failures_last_24h.items.map((item, index) => {
                        // Determine display values based on source
                        const entityId = item.entity?.offer_id || item.entity?.order_id || item.offer_id || item.id;
                        const entityType = item.source === 'order_events' ? 'Order' : item.source === 'offer_events' ? 'Offer' : 'Entity';
                        const linkPath = item.source === 'order_events' && item.entity?.order_id
                          ? `/direct-import/orders/${item.entity.order_id}`
                          : item.entity?.offer_id
                          ? `/offers/${item.entity.offer_id}`
                          : item.offer_id
                          ? `/offers/${item.offer_id}`
                          : null;
                        const emailTo = item.to_masked || item.to || 'N/A';

                        return (
                          <div
                            key={item.event_id || item.id || index}
                            onClick={() => linkPath && router.push(linkPath)}
                            className={`text-xs bg-card p-3 rounded border border-border ${
                              linkPath ? 'cursor-pointer hover:bg-accent hover:border-primary transition-colors' : ''
                            }`}
                          >
                            {/* Header: Source badge + Template */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {item.source && (
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                    getAlertColor(item.source === 'order_events' ? 'SPECIAL' : 'NEUTRAL').badgeClass
                                  }`}>
                                    <span className="inline-flex items-center gap-1">
                                      {item.source === 'order_events' ? <Package className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                      {item.source === 'order_events' ? 'Order' : 'Offer'}
                                    </span>
                                  </span>
                                )}
                                {item.template && (
                                  <span className="text-muted-foreground font-medium">
                                    {item.template}
                                  </span>
                                )}
                              </div>
                              {linkPath && (
                                <span className="text-primary text-xs">→</span>
                              )}
                            </div>

                            {/* Entity ID */}
                            <div className="font-mono text-primary mb-1 text-sm">
                              {entityType}: {entityId?.substring(0, 16)}...
                            </div>

                            {/* Email recipient */}
                            <div className="text-muted-foreground mb-1">
                              To: <span className="font-mono">{emailTo}</span>
                            </div>

                            {/* Error message */}
                            {item.error && (
                              <div className="text-red-600 mb-2">
                                <span className="inline-flex items-center gap-1.5"><XCircle className="h-3 w-3" /> {item.error || 'Unknown error'}</span>
                              </div>
                            )}

                            {/* Action hint */}
                            {item.action_hint && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium text-primary inline-flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Åtgärd:</span> {item.action_hint}
                                </div>
                              </div>
                            )}

                            {/* Timestamp */}
                            <div className="text-muted-foreground text-xs mt-2">
                              {formatDate(item.created_at!)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pilot KPI Section */}
        {data.pilot_metrics && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Pilot KPI</h2>
              <span className="text-sm text-muted-foreground">(Senaste 30 dagar)</span>
            </div>

            {/* Funnel Cards */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h3 className="text-sm font-semibold text-foreground uppercase mb-4">Konverteringstratt</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Requests */}
                <div className="bg-muted rounded-lg p-4 text-center border border-border">
                  <div className="text-2xl font-bold text-primary">{data.pilot_metrics.counts.requests_created}</div>
                  <div className="text-xs text-muted-foreground mt-1">Förfrågningar</div>
                </div>

                {/* Offers Created */}
                <div className="bg-muted rounded-lg p-4 text-center border border-border">
                  <div className="text-2xl font-bold text-primary">{data.pilot_metrics.counts.offers_created}</div>
                  <div className="text-xs text-muted-foreground mt-1">Offerter skapade</div>
                </div>

                {/* Offers Sent */}
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{data.pilot_metrics.counts.offers_sent}</div>
                  <div className="text-xs text-muted-foreground mt-1">Offerter skickade</div>
                </div>

                {/* Offers Accepted */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{data.pilot_metrics.counts.offers_accepted}</div>
                  <div className="text-xs text-muted-foreground mt-1">Accepterade</div>
                </div>

                {/* Orders */}
                <div className="bg-muted rounded-lg p-4 text-center border border-border">
                  <div className="text-2xl font-bold text-primary">{data.pilot_metrics.counts.orders_created}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ordrar</div>
                </div>

                {/* Imports Created */}
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-pink-700">{data.pilot_metrics.counts.imports_created}</div>
                  <div className="text-xs text-muted-foreground mt-1">Importer</div>
                </div>

                {/* Imports Approved */}
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-teal-700">{data.pilot_metrics.counts.imports_approved}</div>
                  <div className="text-xs text-muted-foreground mt-1">Godkända</div>
                </div>

                {/* Orders Shipped */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{data.pilot_metrics.counts.orders_shipped}</div>
                  <div className="text-xs text-muted-foreground mt-1">Skickade</div>
                </div>
              </div>
            </div>

            {/* Timing Metrics */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-foreground uppercase mb-4">Tidsmått (timmar)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Request to Offer Created */}
                <div className="border border-border rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">Request → Offer Created</div>
                  {data.pilot_metrics.timings.request_to_offer_created.sample_size >= 5 ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Median</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.request_to_offer_created.median_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">P90</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.request_to_offer_created.p90_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Sample</div>
                        <div className="text-sm text-muted-foreground">
                          {data.pilot_metrics.timings.request_to_offer_created.sample_size}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-600">
                      INSUFFICIENT DATA (n={data.pilot_metrics.timings.request_to_offer_created.sample_size})
                    </div>
                  )}
                </div>

                {/* Offer Created to Accepted */}
                <div className="border border-border rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">Offer Created → Accepted</div>
                  {data.pilot_metrics.timings.offer_created_to_accepted.sample_size >= 5 ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Median</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.offer_created_to_accepted.median_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">P90</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.offer_created_to_accepted.p90_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Sample</div>
                        <div className="text-sm text-muted-foreground">
                          {data.pilot_metrics.timings.offer_created_to_accepted.sample_size}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-600">
                      INSUFFICIENT DATA (n={data.pilot_metrics.timings.offer_created_to_accepted.sample_size})
                    </div>
                  )}
                </div>

                {/* Accept to Order Created */}
                <div className="border border-border rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">Accept → Order Created</div>
                  {data.pilot_metrics.timings.accept_to_order_created.sample_size >= 5 ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Median</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.accept_to_order_created.median_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">P90</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.accept_to_order_created.p90_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Sample</div>
                        <div className="text-sm text-muted-foreground">
                          {data.pilot_metrics.timings.accept_to_order_created.sample_size}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-600">
                      INSUFFICIENT DATA (n={data.pilot_metrics.timings.accept_to_order_created.sample_size})
                    </div>
                  )}
                </div>

                {/* Order Created to Import Approved */}
                <div className="border border-border rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">Order → Import Approved</div>
                  {data.pilot_metrics.timings.order_created_to_import_approved.sample_size >= 5 ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Median</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.order_created_to_import_approved.median_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">P90</div>
                        <div className="text-lg font-semibold text-primary">
                          {data.pilot_metrics.timings.order_created_to_import_approved.p90_hours}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Sample</div>
                        <div className="text-sm text-muted-foreground">
                          {data.pilot_metrics.timings.order_created_to_import_approved.sample_size}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-600">
                      INSUFFICIENT DATA (n={data.pilot_metrics.timings.order_created_to_import_approved.sample_size})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'bg-accent text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <span className="inline-flex items-center gap-2"><Inbox className="h-4 w-4" /> Requests ({data.recent_requests.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('offers')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'offers'
                  ? 'bg-accent text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Offers ({data.recent_offers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'events'
                  ? 'bg-accent text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <span className="inline-flex items-center gap-2"><Bell className="h-4 w-4" /> Events ({data.recent_events.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div>
                {data.recent_requests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Inga requests ännu</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-foreground">ID</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Fritext</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Restaurant</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Email</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Created</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.recent_requests.map((req) => (
                          <tr key={req.id} className="hover:bg-accent">
                            <td className="px-4 py-3 font-mono text-xs">{req.id.substring(0, 8)}...</td>
                            <td className="px-4 py-3 max-w-xs truncate">{req.fritext}</td>
                            <td className="px-4 py-3">{req.restaurant_name}</td>
                            <td className="px-4 py-3 font-mono text-xs">{req.restaurant_email}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(req.created_at)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/dashboard/requests/${req.id}`)}
                                className="text-primary hover:text-primary/80 text-sm font-medium"
                              >
                                View →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Offers Tab */}
            {activeTab === 'offers' && (
              <div>
                {data.recent_offers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Inga offers ännu</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-foreground">ID</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Title</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Status</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Restaurant</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Supplier</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Created</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.recent_offers.map((offer) => (
                          <tr key={offer.id} className="hover:bg-accent">
                            <td className="px-4 py-3 font-mono text-xs">{offer.id.substring(0, 8)}...</td>
                            <td className="px-4 py-3">{offer.title}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusBadgeColor(offer.status)}`}>
                                {offer.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{offer.restaurant_name}</td>
                            <td className="px-4 py-3">{offer.supplier_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(offer.created_at)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/offers/${offer.id}`)}
                                className="text-primary hover:text-primary/80 text-sm font-medium"
                              >
                                View →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Events Tab */}
            {activeTab === 'events' && (
              <div>
                {data.recent_events.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Inga events ännu</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Event Type</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Offer ID</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Details</th>
                          <th className="px-4 py-3 text-left font-medium text-foreground">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.recent_events.map((event) => (
                          <tr key={event.id} className="hover:bg-accent">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getEventTypeBadgeColor(event.event_type)}`}>
                                {event.event_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/offers/${event.offer_id}`)}
                                className="font-mono text-xs text-primary hover:text-primary/80"
                              >
                                {event.offer_id.substring(0, 8)}...
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              {event.event_type === 'MAIL_SENT' && event.payload ? (
                                <div className="space-y-1">
                                  <div className="text-xs">
                                    <span className="font-medium">Type:</span> {event.payload.type || 'N/A'}
                                  </div>
                                  <div className="text-xs">
                                    <span className="font-medium">To:</span> <span className="font-mono">{event.payload.to || 'N/A'}</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="font-medium">Success:</span>{' '}
                                    <span className={event.payload.success ? 'text-green-600' : 'text-red-600'}>
                                      <span className="inline-flex items-center gap-1">{event.payload.success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {event.payload.success ? 'Yes' : 'No'}</span>
                                    </span>
                                  </div>
                                  {event.payload.error && (
                                    <div className="text-xs text-red-600">
                                      <span className="font-medium">Error:</span> {event.payload.error}
                                    </div>
                                  )}
                                </div>
                              ) : event.payload.note ? (
                                <div className="text-xs text-muted-foreground">{event.payload.note}</div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(event.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
