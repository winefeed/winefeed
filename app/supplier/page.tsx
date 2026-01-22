'use client';

/**
 * SUPPLIER DASHBOARD
 *
 * Main overview page for suppliers
 * Shows key metrics and recent activity
 */

import { useEffect, useState } from 'react';
import { Wine, Inbox, FileText, Package, TrendingUp, AlertCircle, HelpCircle, Building2 } from 'lucide-react';

interface DashboardStats {
  totalWines: number;
  activeWines: number;
  pendingRequests: number;
  activeOffers: number;
  pendingOrders: number;
  recentActivity: Activity[];
}

interface Activity {
  id: string;
  type: 'request' | 'offer' | 'order';
  title: string;
  timestamp: string;
  status?: string;
}

export default function SupplierDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierName, setSupplierName] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch supplier context
        const supplierRes = await fetch('/api/me/supplier');
        if (supplierRes.ok) {
          const supplierData = await supplierRes.json();
          setSupplierName(supplierData.supplierName);
        }

        // Fetch dashboard stats
        const statsRes = await fetch('/api/supplier/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        } else {
          // Mock data for now
          setStats({
            totalWines: 0,
            activeWines: 0,
            pendingRequests: 0,
            activeOffers: 0,
            pendingOrders: 0,
            recentActivity: [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setStats({
          totalWines: 0,
          activeWines: 0,
          pendingRequests: 0,
          activeOffers: 0,
          pendingOrders: 0,
          recentActivity: [],
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Välkommen{supplierName ? `, ${supplierName}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">
          Här ser du en översikt av din verksamhet
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Viner i katalog"
          value={stats?.totalWines || 0}
          subtitle={`${stats?.activeWines || 0} aktiva`}
          icon={Wine}
          color="blue"
          href="/supplier/wines"
        />
        <StatCard
          title="Nya förfrågningar"
          value={stats?.pendingRequests || 0}
          subtitle="Väntar på svar"
          icon={Inbox}
          color="amber"
          href="/supplier/requests"
        />
        <StatCard
          title="Aktiva offerter"
          value={stats?.activeOffers || 0}
          subtitle="Skickade"
          icon={FileText}
          color="green"
          href="/supplier/offers"
        />
        <StatCard
          title="Ordrar"
          value={stats?.pendingOrders || 0}
          subtitle="Att behandla"
          icon={Package}
          color="purple"
          href="/supplier/orders"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Getting Started */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Kom igång
          </h2>
          <div className="space-y-3">
            <QuickAction
              title="Ladda upp vinkatalog"
              description="Importera dina viner via Excel eller CSV"
              href="/supplier/wines"
              icon={Wine}
              done={stats?.totalWines ? stats.totalWines > 0 : false}
            />
            <QuickAction
              title="Svara på förfrågningar"
              description="Se och besvara restaurangers förfrågningar"
              href="/supplier/requests"
              icon={Inbox}
              done={false}
            />
            <QuickAction
              title="Skapa offert"
              description="Skicka prisförslag till restauranger"
              href="/supplier/offers"
              icon={FileText}
              done={false}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Senaste aktivitet
          </h2>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  {activity.status && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {activity.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Ingen aktivitet ännu. Börja med att ladda upp din vinkatalog!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Help & Profile Widget */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Behöver du hjälp?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/supplier/contact"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-[#7B1E1E] hover:bg-red-50 transition-colors"
          >
            <div className="p-2 bg-[#7B1E1E]/10 rounded-lg">
              <HelpCircle className="h-5 w-5 text-[#7B1E1E]" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Kontakta support</p>
              <p className="text-sm text-gray-500">Frågor eller teknisk hjälp</p>
            </div>
          </a>
          <a
            href="/supplier/profile"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-[#7B1E1E] hover:bg-red-50 transition-colors"
          >
            <div className="p-2 bg-[#7B1E1E]/10 rounded-lg">
              <Building2 className="h-5 w-5 text-[#7B1E1E]" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Företagsprofil</p>
              <p className="text-sm text-gray-500">Se dina företagsuppgifter</p>
            </div>
          </a>
        </div>
      </div>

      {/* Alert for empty catalog */}
      {stats?.totalWines === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">Din vinkatalog är tom</h3>
            <p className="text-sm text-amber-700 mt-1">
              Ladda upp dina viner för att börja ta emot förfrågningar från restauranger.
            </p>
            <a
              href="/supplier/wines"
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 mt-2"
            >
              Gå till vinkatalog →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'amber' | 'green' | 'purple';
  href: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color, href }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <a
      href={href}
      className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </a>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  done: boolean;
}

function QuickAction({ title, description, href, icon: Icon, done }: QuickActionProps) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        done
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className={`p-2 rounded-lg ${done ? 'bg-green-100' : 'bg-gray-100'}`}>
        <Icon className={`h-4 w-4 ${done ? 'text-green-600' : 'text-gray-600'}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? 'text-green-800' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {done && (
        <span className="text-xs font-medium text-green-600">✓ Klar</span>
      )}
    </a>
  );
}
