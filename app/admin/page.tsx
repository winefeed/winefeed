/**
 * ADMIN DASHBOARD - LANDING PAGE
 *
 * /admin
 *
 * Overview dashboard for administrators
 *
 * Features:
 * - Key metrics (restaurants, suppliers, users, requests, offers, orders)
 * - Recent activity timeline
 * - Quick links to admin tools (pilot console, invites)
 * - Alerts summary
 *
 * Access Control:
 * - Dev: ADMIN_MODE=true in .env.local
 * - Prod: Admin role required (TODO: implement role check)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface Stats {
  counts: {
    restaurants: number;
    suppliers: number;
    users: number;
    requests: number;
    offers: number;
    orders: number;
    imports: number;
  };
  recent_activity: Array<{
    id: string;
    type: 'request' | 'offer' | 'order';
    status: string;
    created_at: string;
  }>;
  alerts: {
    eu_orders_without_import: number;
  };
  timestamp: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/stats', {
        headers: {
          'x-tenant-id': TENANT_ID,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required. Set ADMIN_MODE=true in .env.local');
        }
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch admin stats:', err);
      setError(err.message || 'Kunde inte ladda statistik');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">🚫</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard/new-request')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ← Tillbaka
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const activityIcons = {
    request: '📋',
    offer: '📄',
    order: '📦',
  };

  const activityLabels = {
    request: 'Request',
    offer: 'Offer',
    order: 'Order',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">👨‍💼</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-sm text-white/80">Översikt och systemstatus</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchStats}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Links */}
        <div className="mb-8 flex gap-3">
          <button
            onClick={() => router.push('/admin/pilot')}
            className="px-6 py-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 font-medium text-gray-700"
          >
            🔧 Pilot Console
          </button>
          <button
            onClick={() => router.push('/admin/invites')}
            className="px-6 py-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 font-medium text-gray-700"
          >
            ✉️ Invites
          </button>
          <button
            onClick={() => router.push('/admin/users')}
            className="px-6 py-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 font-medium text-gray-700"
          >
            👥 Users
          </button>
        </div>

        {/* Alerts Summary */}
        {stats.alerts.eu_orders_without_import > 0 && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-800">Viktiga varningar</h3>
                <p className="text-sm text-red-700">
                  {stats.alerts.eu_orders_without_import} EU-orders saknar importärende
                </p>
              </div>
              <button
                onClick={() => router.push('/admin/pilot')}
                className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Visa detaljer →
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Restaurants */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">🏪</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.counts.restaurants}</div>
                <div className="text-sm text-gray-500">Restauranger</div>
              </div>
            </div>
          </div>

          {/* Suppliers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">📦</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.counts.suppliers}</div>
                <div className="text-sm text-gray-500">Leverantörer</div>
              </div>
            </div>
          </div>

          {/* Requests */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">📋</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.counts.requests}</div>
                <div className="text-sm text-gray-500">Requests</div>
              </div>
            </div>
          </div>

          {/* Offers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">📄</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.counts.offers}</div>
                <div className="text-sm text-gray-500">Offerter</div>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">📦</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.counts.orders}</div>
                <div className="text-sm text-gray-500">Orders</div>
              </div>
            </div>
          </div>

          {/* Imports */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">🇪🇺</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.counts.imports}</div>
                <div className="text-sm text-gray-500">Importärenden</div>
              </div>
            </div>
          </div>

          {/* Users (placeholder) */}
          <div className="bg-white rounded-lg shadow-md p-6 opacity-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">👥</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">—</div>
                <div className="text-sm text-gray-500">Användare</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">Ej implementerat</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Senaste aktivitet</h2>
          </div>

          {stats.recent_activity.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Ingen aktivitet ännu</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {stats.recent_activity.map((item) => (
                <div key={`${item.type}-${item.id}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{activityIcons[item.type]}</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {activityLabels[item.type]} {item.id.substring(0, 8)}...
                        </div>
                        <div className="text-sm text-gray-500">
                          Status: {item.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString('sv-SE')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Timestamp */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Uppdaterad: {new Date(stats.timestamp).toLocaleString('sv-SE')}
        </div>
      </main>
    </div>
  );
}
