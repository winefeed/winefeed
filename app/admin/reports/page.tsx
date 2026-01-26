/**
 * ADMIN ORDER REPORTS PAGE
 *
 * /admin/reports
 *
 * View order value reports for billing/invoicing
 * Filter by date range, export to CSV
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  Package,
  Truck,
  Building2,
  Store,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ReportTotals {
  order_count: number;
  total_goods_sek: number;
  total_shipping_sek: number;
  total_order_value_sek: number;
  total_service_fee_sek: number;
}

interface AggregatedGroup {
  group_key: string;
  group_name: string;
  order_count: number;
  total_goods_sek: number;
  total_shipping_sek: number;
  total_order_value_sek: number;
  total_service_fee_sek: number;
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  restaurant_id: string;
  restaurant_name: string;
  seller_supplier_id: string;
  supplier_name: string;
  total_goods_amount_ore: number | null;
  shipping_cost_ore: number | null;
  total_order_value_ore: number | null;
  service_fee_mode: string;
  service_fee_amount_ore: number;
  currency: string;
}

interface ReportData {
  period: {
    start_date: string;
    end_date: string;
  };
  totals: ReportTotals;
  grouped_by: string;
  groups: AggregatedGroup[] | null;
  orders: OrderRow[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_SUPPLIER_CONFIRMATION: { label: 'Väntar på leverantör', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Bekräftad', color: 'bg-blue-100 text-blue-800' },
  IN_FULFILLMENT: { label: 'Under hantering', color: 'bg-indigo-100 text-indigo-800' },
  SHIPPED: { label: 'Skickad', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: 'Levererad', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Avbruten', color: 'bg-red-100 text-red-800' },
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const defaultEndDate = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [groupBy, setGroupBy] = useState<'none' | 'restaurant' | 'supplier' | 'month'>('none');

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy,
      });

      const response = await fetch(`/api/admin/orders/reports?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error('Failed to fetch report:', err);
      setError(err.message || 'Kunde inte ladda rapport');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    try {
      setExporting(true);

      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      const response = await fetch(`/api/admin/orders/reports/export?${params}`);

      if (!response.ok) {
        throw new Error('Failed to export');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `winefeed-ordrar-${startDate}-till-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to export:', err);
      alert('Kunde inte exportera rapport');
    } finally {
      setExporting(false);
    }
  };

  const formatSEK = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Quick date range presets
  const setDateRange = (preset: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear') => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarterStart = Math.floor(today.getMonth() / 3) * 3;
        start = new Date(today.getFullYear(), quarterStart, 1);
        end = today;
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordervärde-rapporter</h1>
          <p className="text-muted-foreground mt-1">Faktureringsunderlag och statistik</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporterar...' : 'Exportera CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-6 mb-8">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Från</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
              />
            </div>
            <span className="text-muted-foreground">-</span>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Till</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Quick date presets */}
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange('thisMonth')}
              className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Denna månad
            </button>
            <button
              onClick={() => setDateRange('lastMonth')}
              className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Förra månaden
            </button>
            <button
              onClick={() => setDateRange('thisQuarter')}
              className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Detta kvartal
            </button>
            <button
              onClick={() => setDateRange('thisYear')}
              className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              I år
            </button>
          </div>

          {/* Group By */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Gruppera</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
            >
              <option value="none">Ingen gruppering</option>
              <option value="restaurant">Per restaurang</option>
              <option value="supplier">Per leverantör</option>
              <option value="month">Per månad</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center mb-8">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      )}

      {/* Report Content */}
      {!loading && report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              title="Antal ordrar"
              value={report.totals.order_count.toString()}
              icon={Package}
              color="blue"
            />
            <SummaryCard
              title="Varubelopp"
              value={formatSEK(report.totals.total_goods_sek)}
              icon={TrendingUp}
              color="green"
            />
            <SummaryCard
              title="Frakt"
              value={formatSEK(report.totals.total_shipping_sek)}
              icon={Truck}
              color="orange"
            />
            <SummaryCard
              title="Totalt ordervärde"
              value={formatSEK(report.totals.total_order_value_sek)}
              icon={FileText}
              color="purple"
              highlight
            />
          </div>

          {/* Grouped Data */}
          {report.groups && report.groups.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  {groupBy === 'restaurant' && 'Per restaurang'}
                  {groupBy === 'supplier' && 'Per leverantör'}
                  {groupBy === 'month' && 'Per månad'}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                        {groupBy === 'restaurant' && 'Restaurang'}
                        {groupBy === 'supplier' && 'Leverantör'}
                        {groupBy === 'month' && 'Månad'}
                      </th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Ordrar</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Varubelopp</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Frakt</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Totalt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.groups.map((group) => (
                      <tr key={group.group_key} className="hover:bg-accent transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {groupBy === 'restaurant' && <Store className="h-4 w-4 text-muted-foreground" />}
                            {groupBy === 'supplier' && <Building2 className="h-4 w-4 text-muted-foreground" />}
                            {group.group_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-muted-foreground">
                          {group.order_count}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-muted-foreground">
                          {formatSEK(group.total_goods_sek)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-muted-foreground">
                          {formatSEK(group.total_shipping_sek)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-foreground">
                          {formatSEK(group.total_order_value_sek)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Alla ordrar</h2>
              <span className="text-sm text-muted-foreground">{report.orders.length} st</span>
            </div>

            {report.orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Inga ordrar under denna period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Ref</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Datum</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Restaurang</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Leverantör</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Varor</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Frakt</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Totalt</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.orders.map((order) => {
                      const statusInfo = STATUS_LABELS[order.status] || {
                        label: order.status,
                        color: 'bg-gray-100 text-gray-800',
                      };
                      const shortRef = order.id.slice(0, 8).toUpperCase();
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-accent transition-colors cursor-pointer group"
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          <td className="px-6 py-4 text-sm">
                            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-primary">
                              {shortRef}
                            </code>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('sv-SE')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">{order.restaurant_name}</td>
                          <td className="px-6 py-4 text-sm text-foreground">{order.supplier_name}</td>
                          <td className="px-6 py-4 text-sm text-right text-muted-foreground">
                            {formatSEK((order.total_goods_amount_ore || 0) / 100)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-muted-foreground">
                            {formatSEK((order.shipping_cost_ore || 0) / 100)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-foreground">
                            {formatSEK((order.total_order_value_ore || 0) / 100)}
                          </td>
                          <td className="px-6 py-4">
                            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-sm text-muted-foreground text-center">
            Period: {report.period.start_date} - {report.period.end_date}
          </div>
        </>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'orange' | 'purple';
  highlight?: boolean;
}

function SummaryCard({ title, value, icon: Icon, color, highlight }: SummaryCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    orange: 'bg-orange-500/10 text-orange-600',
    purple: 'bg-purple-500/10 text-purple-600',
  };

  return (
    <div className={`bg-card rounded-lg border p-5 ${highlight ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
