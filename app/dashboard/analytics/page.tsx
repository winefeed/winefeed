/**
 * RESTAURANT ANALYTICS DASHBOARD
 *
 * /dashboard/analytics
 *
 * Shows:
 * - Request & order statistics
 * - Spending over time
 * - Savings vs budget
 * - Top suppliers
 * - Wine type breakdown
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  FileText,
  Truck,
  Wine,
  Users,
  Calendar,
  RefreshCw,
  PiggyBank,
} from 'lucide-react';

interface MonthlyData {
  month: string;
  count: number;
  amount: number;
}

interface TopSupplier {
  supplier_id: string;
  supplier_name: string;
  total_amount: number;
  order_count: number;
  avg_delivery_days: number | null;
  acceptance_rate: number | null;
}

interface WineTypeData {
  type: string;
  count: number;
  quantity: number;
}

interface AnalyticsData {
  total_requests: number;
  total_orders: number;
  total_spent: number;
  total_budget: number;
  savings: number;
  avg_delivery_days: number | null;
  requests_by_month: MonthlyData[];
  spending_by_month: MonthlyData[];
  top_suppliers: TopSupplier[];
  top_wine_types: WineTypeData[];
  period: {
    start: string;
    end: string;
  };
}

function formatCurrency(ore: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(ore / 100);
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${year.slice(2)}`;
}

export default function RestaurantAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(12);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dashboard/analytics?months=${months}`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Kunde inte ladda statistik');
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Försök igen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const savingsPercent = data.total_budget > 0
    ? Math.round((data.savings / data.total_budget) * 100)
    : 0;

  const maxSpending = Math.max(...data.spending_by_month.map(m => m.amount), 1);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Statistik</h1>
            <p className="text-sm text-gray-500">
              {data.period.start} - {data.period.end}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={3}>Senaste 3 månader</option>
              <option value={6}>Senaste 6 månader</option>
              <option value={12}>Senaste 12 månader</option>
              <option value={24}>Senaste 24 månader</option>
            </select>

            <button
              onClick={fetchAnalytics}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Uppdatera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Requests */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Förfrågningar</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data.total_requests}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ordrar</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data.total_orders}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Spent */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total spenderat</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(data.total_spent)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Besparing vs budget</p>
                <p className={`text-3xl font-bold mt-1 ${data.savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.savings >= 0 ? '+' : ''}{formatCurrency(data.savings)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {savingsPercent >= 0 ? '+' : ''}{savingsPercent}% av budget
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${data.savings >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <PiggyBank className={`w-6 h-6 ${data.savings >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spending Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Utgifter per månad</h2>

            {data.spending_by_month.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400">
                Ingen data för vald period
              </div>
            ) : (
              <div className="space-y-3">
                {data.spending_by_month.map((month) => (
                  <div key={month.month} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-16">{formatMonth(month.month)}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-[#7B1E1E] h-full rounded-full transition-all duration-500"
                        style={{ width: `${(month.amount / maxSpending) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-24 text-right">
                      {formatCurrency(month.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery Stats */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Leveransstatistik</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Genomsnittlig leveranstid</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {data.avg_delivery_days !== null ? `${data.avg_delivery_days} dagar` : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Ordrar/månad (snitt)</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {data.spending_by_month.length > 0
                    ? (data.total_orders / data.spending_by_month.length).toFixed(1)
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Third Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Suppliers */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Topp-leverantörer</h2>
            </div>

            {data.top_suppliers.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-400">
                Inga ordrar ännu
              </div>
            ) : (
              <div className="space-y-3">
                {data.top_suppliers.map((supplier, index) => (
                  <div
                    key={supplier.supplier_id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-[#7B1E1E] text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{supplier.supplier_name}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>{supplier.order_count} ordrar</span>
                        {supplier.avg_delivery_days !== null && (
                          <span>{supplier.avg_delivery_days}d leverans</span>
                        )}
                        {supplier.acceptance_rate !== null && (
                          <span>{supplier.acceptance_rate}% svarsfrekvens</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(supplier.total_amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Wine Types */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Wine className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Mest beställda viner</h2>
            </div>

            {data.top_wine_types.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-400">
                Ingen data ännu
              </div>
            ) : (
              <div className="space-y-3">
                {data.top_wine_types.map((wine) => {
                  const maxQty = Math.max(...data.top_wine_types.map(w => w.quantity), 1);
                  return (
                    <div key={wine.type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{wine.type}</span>
                        <span className="text-gray-500">{wine.quantity} flaskor</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#7B1E1E] h-full rounded-full"
                          style={{ width: `${(wine.quantity / maxQty) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
