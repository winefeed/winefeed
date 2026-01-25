/**
 * ADMIN COMPLIANCE PAGE
 *
 * /admin/compliance
 *
 * Tax reporting and compliance tools:
 * - Alcohol tax (alkoholskatt)
 * - VAT (moms)
 * - Import traceability
 * - Transaction history
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Wine,
  Receipt,
  Globe,
  List,
  AlertTriangle,
} from 'lucide-react';

type ReportType = 'summary' | 'alcohol-tax' | 'vat' | 'imports' | 'transactions';

interface SummaryReport {
  report_type: 'summary';
  period: { start_date: string; end_date: string };
  overview: {
    order_count: number;
    total_bottles: number;
    unique_restaurants: number;
    unique_suppliers: number;
    unique_importers: number;
  };
  financial: {
    total_goods_sek: number;
    total_shipping_sek: number;
    total_order_value_sek: number;
  };
  alcohol: {
    total_liters_wine: number;
    total_liters_pure_alcohol: number;
    estimated_alcohol_tax_sek: number;
  };
  vat: {
    vat_rate_percent: number;
    estimated_vat_sek: number;
  };
  imports: {
    eu_supplier_orders: number;
    domestic_supplier_orders: number;
  };
  tax_summary: {
    estimated_alcohol_tax_sek: number;
    estimated_vat_sek: number;
    estimated_total_tax_sek: number;
  };
}

interface AlcoholTaxReport {
  report_type: 'alcohol-tax';
  period: { start_date: string; end_date: string };
  tax_rate_info: {
    rate_per_liter_pure_alcohol: number;
    description: string;
  };
  totals: {
    order_count: number;
    total_liters_wine: number;
    total_liters_pure_alcohol: number;
    total_alcohol_tax_sek: number;
  };
  items: any[];
}

interface VatReport {
  report_type: 'vat';
  period: { start_date: string; end_date: string };
  vat_rate_percent: number;
  totals: {
    order_count: number;
    total_goods_excl_vat_sek: number;
    total_vat_sek: number;
    total_incl_vat_sek: number;
  };
  by_restaurant: any[];
}

interface ImportsReport {
  report_type: 'imports';
  period: { start_date: string; end_date: string };
  totals: {
    total_imports: number;
    eu_imports: number;
    domestic_imports: number;
    by_status: {
      not_registered: number;
      submitted: number;
      approved: number;
      rejected: number;
    };
  };
  eu_imports: any[];
  domestic_imports: any[];
}

interface TransactionsReport {
  report_type: 'transactions';
  period: { start_date: string; end_date: string };
  totals: {
    transaction_count: number;
    total_bottles: number;
    total_goods_sek: number;
    total_shipping_sek: number;
    total_sek: number;
  };
  transactions: any[];
}

type Report = SummaryReport | AlcoholTaxReport | VatReport | ImportsReport | TransactionsReport;

const REPORT_TABS: { id: ReportType; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Sammanfattning', icon: FileText },
  { id: 'alcohol-tax', label: 'Alkoholskatt', icon: Wine },
  { id: 'vat', label: 'Moms', icon: Receipt },
  { id: 'imports', label: 'Importer', icon: Globe },
  { id: 'transactions', label: 'Transaktioner', icon: List },
];

export default function AdminCompliancePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportType>('summary');

  // Filter state
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const defaultEndDate = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
        reportType: activeTab,
      });

      const response = await fetch(`/api/admin/compliance?${params}`);
      const data = await response.json();

      if (!response.ok) {
        // Show details first (more specific), then error message
        throw new Error(data.details || data.error || 'Failed to fetch report');
      }

      setReport(data);
    } catch (err: any) {
      console.error('Failed to fetch compliance report:', err);
      setError(err.message || 'Kunde inte ladda rapport');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, activeTab]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (exportType: 'alcohol-tax' | 'vat' | 'transactions') => {
    try {
      setExporting(true);

      const params = new URLSearchParams({
        startDate,
        endDate,
        reportType: exportType,
      });

      const response = await fetch(`/api/admin/compliance/export?${params}`);

      if (!response.ok) {
        throw new Error('Failed to export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const filename = exportType === 'alcohol-tax'
        ? `alkoholskatt-${startDate}-till-${endDate}.csv`
        : exportType === 'vat'
        ? `moms-${startDate}-till-${endDate}.csv`
        : `transaktioner-${startDate}-till-${endDate}.csv`;

      a.download = filename;
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Compliance & Skatterapportering</h1>
        <p className="text-muted-foreground mt-1">Underlag för bokföring och revision</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
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

          <div className="flex gap-2">
            <button onClick={() => setDateRange('thisMonth')} className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg">
              Denna månad
            </button>
            <button onClick={() => setDateRange('lastMonth')} className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg">
              Förra månaden
            </button>
            <button onClick={() => setDateRange('thisQuarter')} className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg">
              Detta kvartal
            </button>
            <button onClick={() => setDateRange('thisYear')} className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-lg">
              I år
            </button>
          </div>

          <div className="flex-1"></div>

          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1 -mb-px">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center mb-6">
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
          {/* Summary View */}
          {report.report_type === 'summary' && (
            <SummaryView report={report as SummaryReport} formatSEK={formatSEK} onExport={handleExport} exporting={exporting} />
          )}

          {/* Alcohol Tax View */}
          {report.report_type === 'alcohol-tax' && (
            <AlcoholTaxView report={report as AlcoholTaxReport} formatSEK={formatSEK} onExport={() => handleExport('alcohol-tax')} exporting={exporting} />
          )}

          {/* VAT View */}
          {report.report_type === 'vat' && (
            <VatView report={report as VatReport} formatSEK={formatSEK} onExport={() => handleExport('vat')} exporting={exporting} />
          )}

          {/* Imports View */}
          {report.report_type === 'imports' && (
            <ImportsView report={report as ImportsReport} />
          )}

          {/* Transactions View */}
          {report.report_type === 'transactions' && (
            <TransactionsView report={report as TransactionsReport} formatSEK={formatSEK} onExport={() => handleExport('transactions')} exporting={exporting} />
          )}
        </>
      )}
    </div>
  );
}

// Summary View Component
function SummaryView({ report, formatSEK, onExport, exporting }: {
  report: SummaryReport;
  formatSEK: (n: number) => string;
  onExport: (type: 'alcohol-tax' | 'vat' | 'transactions') => void;
  exporting: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Ordrar" value={report.overview.order_count.toString()} />
        <StatCard title="Flaskor" value={report.overview.total_bottles.toString()} />
        <StatCard title="Restauranger" value={report.overview.unique_restaurants.toString()} />
        <StatCard title="Leverantörer" value={report.overview.unique_suppliers.toString()} />
        <StatCard title="Importörer" value={report.overview.unique_importers.toString()} />
      </div>

      {/* Tax Summary */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Skattesammanställning</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Wine className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Alkoholskatt</span>
            </div>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {formatSEK(report.tax_summary.estimated_alcohol_tax_sek)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {report.alcohol.total_liters_wine.toFixed(1)} liter vin ({report.alcohol.total_liters_pure_alcohol.toFixed(2)} liter ren alkohol)
            </p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Moms ({report.vat.vat_rate_percent}%)</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatSEK(report.tax_summary.estimated_vat_sek)}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              På varubelopp {formatSEK(report.financial.total_goods_sek)}
            </p>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Total skatt</span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {formatSEK(report.tax_summary.estimated_total_tax_sek)}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Alkoholskatt + moms
            </p>
          </div>
        </div>
      </div>

      {/* Import Distribution */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Leverantörstyper</h2>
        <div className="flex gap-4">
          <div className="flex-1 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">EU-leverantörer</p>
            <p className="text-2xl font-bold">{report.imports.eu_supplier_orders}</p>
          </div>
          <div className="flex-1 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Svenska leverantörer</p>
            <p className="text-2xl font-bold">{report.imports.domestic_supplier_orders}</p>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Exportera underlag</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onExport('alcohol-tax')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Alkoholskatt (CSV)
          </button>
          <button
            onClick={() => onExport('vat')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Momsunderlag (CSV)
          </button>
          <button
            onClick={() => onExport('transactions')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Transaktioner (CSV)
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Observera</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Skatteberäkningarna är uppskattningar baserade på registrerade uppgifter.
            Alkoholskatten beräknas med 2026 års skattesatser (56,32 kr/liter ren alkohol för stillvin).
            Kontakta din revisor för exakta skatteunderlag.
          </p>
        </div>
      </div>
    </div>
  );
}

// Alcohol Tax View
function AlcoholTaxView({ report, formatSEK, onExport, exporting }: {
  report: AlcoholTaxReport;
  formatSEK: (n: number) => string;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Skattesats: {report.tax_rate_info.rate_per_liter_pure_alcohol} kr/liter ren alkohol
          </p>
        </div>
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm"
        >
          <Download className="h-4 w-4" />
          Exportera CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Ordrar" value={report.totals.order_count.toString()} />
        <StatCard title="Liter vin" value={report.totals.total_liters_wine.toFixed(1)} />
        <StatCard title="Liter ren alkohol" value={report.totals.total_liters_pure_alcohol.toFixed(2)} />
        <StatCard title="Total alkoholskatt" value={formatSEK(report.totals.total_alcohol_tax_sek)} highlight />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Ordrar med alkoholskatt</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Datum</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Leverantör</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Importör</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Liter vin</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Ren alkohol</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Skatt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.items.map((item) => (
                <tr key={item.order_id} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm">{new Date(item.order_date).toLocaleDateString('sv-SE')}</td>
                  <td className="px-6 py-4 text-sm">{item.supplier_name}</td>
                  <td className="px-6 py-4 text-sm">{item.importer_name}</td>
                  <td className="px-6 py-4 text-sm text-right">{item.order_liters_wine.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-right">{item.order_liters_pure_alcohol.toFixed(3)}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">{formatSEK(item.order_alcohol_tax_sek)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// VAT View
function VatView({ report, formatSEK, onExport, exporting }: {
  report: VatReport;
  formatSEK: (n: number) => string;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Momssats: {report.vat_rate_percent}%</p>
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm"
        >
          <Download className="h-4 w-4" />
          Exportera CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Ordrar" value={report.totals.order_count.toString()} />
        <StatCard title="Varor exkl moms" value={formatSEK(report.totals.total_goods_excl_vat_sek)} />
        <StatCard title="Moms" value={formatSEK(report.totals.total_vat_sek)} highlight />
        <StatCard title="Totalt inkl moms" value={formatSEK(report.totals.total_incl_vat_sek)} />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Per restaurang</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Restaurang</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Orgnr</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Ordrar</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Exkl moms</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Moms</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Totalt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.by_restaurant.map((item, idx) => (
                <tr key={idx} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm">{item.restaurant_name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{item.restaurant_org_number}</td>
                  <td className="px-6 py-4 text-sm text-right">{item.order_count}</td>
                  <td className="px-6 py-4 text-sm text-right">{formatSEK(item.total_goods_excl_vat_sek)}</td>
                  <td className="px-6 py-4 text-sm text-right">{formatSEK(item.total_vat_sek)}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">{formatSEK(item.total_incl_vat_sek)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Imports View
function ImportsView({ report }: { report: ImportsReport }) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    NOT_REGISTERED: { label: 'Ej registrerad', color: 'bg-gray-100 text-gray-800' },
    SUBMITTED: { label: 'Inskickad', color: 'bg-blue-100 text-blue-800' },
    APPROVED: { label: 'Godkänd', color: 'bg-green-100 text-green-800' },
    REJECTED: { label: 'Avvisad', color: 'bg-red-100 text-red-800' },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Totalt importer" value={report.totals.total_imports.toString()} />
        <StatCard title="EU-importer" value={report.totals.eu_imports.toString()} />
        <StatCard title="Inrikes" value={report.totals.domestic_imports.toString()} />
        <StatCard title="Godkända" value={report.totals.by_status.approved.toString()} />
      </div>

      {/* Status breakdown */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="font-semibold mb-4">Status-fördelning</h2>
        <div className="flex flex-wrap gap-3">
          <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
            Ej registrerad: {report.totals.by_status.not_registered}
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            Inskickad: {report.totals.by_status.submitted}
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            Godkänd: {report.totals.by_status.approved}
          </span>
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
            Avvisad: {report.totals.by_status.rejected}
          </span>
        </div>
      </div>

      {/* EU Imports */}
      {report.eu_imports.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">EU-importer (kräver 5369-anmälan)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Datum</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Restaurang</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Leverantör</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Importör</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.eu_imports.map((item) => {
                  const status = statusLabels[item.status] || { label: item.status, color: 'bg-gray-100' };
                  return (
                    <tr key={item.import_id} className="hover:bg-accent">
                      <td className="px-6 py-4 text-sm">{new Date(item.created_at).toLocaleDateString('sv-SE')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-6 py-4 text-sm">{item.restaurant_name}</td>
                      <td className="px-6 py-4 text-sm">{item.supplier_name}</td>
                      <td className="px-6 py-4 text-sm">{item.importer_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Transactions View
function TransactionsView({ report, formatSEK, onExport, exporting }: {
  report: TransactionsReport;
  formatSEK: (n: number) => string;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{report.totals.transaction_count} transaktioner</p>
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm"
        >
          <Download className="h-4 w-4" />
          Exportera CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Transaktioner" value={report.totals.transaction_count.toString()} />
        <StatCard title="Flaskor" value={report.totals.total_bottles.toString()} />
        <StatCard title="Varor" value={formatSEK(report.totals.total_goods_sek)} />
        <StatCard title="Frakt" value={formatSEK(report.totals.total_shipping_sek)} />
        <StatCard title="Totalt" value={formatSEK(report.totals.total_sek)} highlight />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Datum</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Restaurang</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Leverantör</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Importör</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Flaskor</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Totalt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.transactions.map((t) => (
                <tr key={t.order_id} className="hover:bg-accent">
                  <td className="px-6 py-4 text-sm">{new Date(t.order_date).toLocaleDateString('sv-SE')}</td>
                  <td className="px-6 py-4 text-sm">{t.restaurant.name}</td>
                  <td className="px-6 py-4 text-sm">{t.supplier.name}</td>
                  <td className="px-6 py-4 text-sm">{t.importer.name}</td>
                  <td className="px-6 py-4 text-sm text-right">{t.total_bottles}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">{formatSEK(t.total_sek)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-card rounded-lg border p-4 ${highlight ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
