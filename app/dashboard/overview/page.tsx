'use client';

/**
 * RESTAURANT DASHBOARD OVERVIEW
 *
 * Main landing page for restaurant users showing:
 * - Key stats (requests, offers, orders)
 * - Recent activity
 * - Quick actions
 * - Pending offers requiring attention
 */

import { useEffect, useState } from 'react';
import {
  FileText,
  Mail,
  Package,
  TrendingUp,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  ShoppingCart,
  Building2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface DashboardStats {
  activeRequests: number;
  pendingOffers: number;
  acceptedOffers: number;
  pendingOrders: number;
  completedOrders: number;
  totalSpentThisMonth: number;
  recentActivity: Activity[];
}

interface Activity {
  id: string;
  type: 'offer' | 'order' | 'request';
  title: string;
  supplier?: string;
  status: string;
  timestamp: string;
}

interface PendingOffer {
  id: string;
  title: string;
  supplier_name: string;
  total_amount: number;
  lines_count: number;
  created_at: string;
  expires_at?: string;
}

export default function RestaurantOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch restaurant info
        const restaurantRes = await fetch('/api/me/restaurant');
        if (restaurantRes.ok) {
          const data = await restaurantRes.json();
          setRestaurantName(data.name || '');
        }

        // Fetch stats
        const statsRes = await fetch('/api/restaurant/stats');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        } else {
          setStats({
            activeRequests: 0,
            pendingOffers: 0,
            acceptedOffers: 0,
            pendingOrders: 0,
            completedOrders: 0,
            totalSpentThisMonth: 0,
            recentActivity: [],
          });
        }

        // Fetch pending offers
        const offersRes = await fetch('/api/offers?status=pending&limit=5');
        if (offersRes.ok) {
          const data = await offersRes.json();
          setPendingOffers(data.offers || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SENT: 'bg-blue-100 text-blue-700',
      pending: 'bg-blue-100 text-blue-700',
      ACCEPTED: 'bg-green-100 text-green-700',
      accepted: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      SENT: 'Ny',
      pending: 'Ny',
      ACCEPTED: 'Accepterad',
      accepted: 'Accepterad',
      REJECTED: 'Avböjd',
      rejected: 'Avböjd',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

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

  const hasActivity = stats && (stats.activeRequests > 0 || stats.pendingOffers > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Välkommen{restaurantName ? `, ${restaurantName}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">
              Här ser du en översikt av dina inköp
            </p>
          </div>

          {/* Quick action */}
          <a
            href="/dashboard/new-request"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg hover:bg-[#6B1818] transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny förfrågan
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Aktiva förfrågningar"
          value={stats?.activeRequests || 0}
          subtitle="Väntar på svar"
          icon={FileText}
          color="blue"
          href="/dashboard/my-requests"
        />
        <StatCard
          title="Nya offerter"
          value={stats?.pendingOffers || 0}
          subtitle="Att granska"
          icon={Mail}
          color="amber"
          href="/dashboard/offers"
          highlight={stats?.pendingOffers ? stats.pendingOffers > 0 : false}
        />
        <StatCard
          title="Pågående ordrar"
          value={stats?.pendingOrders || 0}
          subtitle="Under leverans"
          icon={Package}
          color="purple"
          href="/dashboard/orders"
        />
        <StatCard
          title="Denna månad"
          value={formatCurrency(stats?.totalSpentThisMonth || 0)}
          subtitle={`${stats?.completedOrders || 0} levererade`}
          icon={TrendingUp}
          color="green"
          href="/dashboard/analytics"
          isText
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Offers */}
          {pendingOffers.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-amber-600" />
                  <h2 className="font-semibold text-gray-900">
                    Offerter att granska
                  </h2>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                    {pendingOffers.length}
                  </span>
                </div>
                <a
                  href="/dashboard/offers"
                  className="text-sm font-medium text-[#7B1E1E] hover:underline"
                >
                  Visa alla →
                </a>
              </div>

              <div className="divide-y divide-gray-100">
                {pendingOffers.slice(0, 4).map((offer) => (
                  <a
                    key={offer.id}
                    href={`/dashboard/offers/${offer.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                            {offer.title || 'Offert'}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Ny
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Från {offer.supplier_name} • {offer.lines_count} {offer.lines_count === 1 ? 'rad' : 'rader'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true, locale: sv })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(offer.total_amount)}
                        </p>
                        <ArrowRight className="h-4 w-4 text-gray-400 mt-1 ml-auto" />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions for new users */}
          {!hasActivity && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Kom igång
              </h2>
              <div className="space-y-3">
                <QuickAction
                  title="Skapa din första förfrågan"
                  description="Berätta vad du söker så matchar vi rätt leverantörer"
                  href="/dashboard/new-request"
                  icon={FileText}
                  primary
                />
                <QuickAction
                  title="Lägg till leveransadresser"
                  description="Spara dina vanliga leveransadresser"
                  href="/dashboard/settings"
                  icon={Building2}
                />
                <QuickAction
                  title="Se hur det fungerar"
                  description="Guide till att använda Winefeed"
                  href="/dashboard/help"
                  icon={AlertCircle}
                />
              </div>
            </div>
          )}

          {/* How it works */}
          {hasActivity && (
            <div className="bg-gradient-to-br from-[#7B1E1E]/5 to-amber-50 rounded-lg border border-[#7B1E1E]/20 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Så fungerar det
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StepCard
                  number={1}
                  title="Skapa förfrågan"
                  description="Beskriv vad du letar efter"
                />
                <StepCard
                  number={2}
                  title="Få offerter"
                  description="Leverantörer skickar prisförslag"
                />
                <StepCard
                  number={3}
                  title="Beställ"
                  description="Välj bästa offerten och beställ"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Activity Feed */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Senaste aktivitet
            </h2>

            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="p-1.5 bg-gray-100 rounded-full">
                      {activity.type === 'offer' ? (
                        <Mail className="h-4 w-4 text-blue-500" />
                      ) : activity.type === 'order' ? (
                        <Package className="h-4 w-4 text-purple-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      {activity.supplier && (
                        <p className="text-xs text-gray-500">{activity.supplier}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                          locale: sv,
                        })}
                      </p>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Ingen aktivitet ännu
                </p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Denna månad
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Accepterade offerter</span>
                <span className="font-semibold text-gray-900">{stats?.acceptedOffers || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Levererade ordrar</span>
                <span className="font-semibold text-gray-900">{stats?.completedOrders || 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Totalt inköp</span>
                <span className="font-bold text-[#7B1E1E]">
                  {formatCurrency(stats?.totalSpentThisMonth || 0)}
                </span>
              </div>
            </div>
            <a
              href="/dashboard/analytics"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#7B1E1E] hover:underline"
            >
              <TrendingUp className="h-4 w-4" />
              Se fullständig statistik
            </a>
          </div>

          {/* Help */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Behöver du hjälp?
            </h2>
            <a
              href="/dashboard/help"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#7B1E1E] hover:bg-red-50 transition-colors"
            >
              <div className="p-2 bg-[#7B1E1E]/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-[#7B1E1E]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Kontakta support</p>
                <p className="text-xs text-gray-500">Vi hjälper dig gärna</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'amber' | 'green' | 'purple';
  href: string;
  highlight?: boolean;
  isText?: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, color, href, highlight, isText }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <a
      href={href}
      className={`block bg-white rounded-lg border p-5 transition-all hover:shadow-md ${
        highlight ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      <p className={`${isText ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </a>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  primary?: boolean;
}

function QuickAction({ title, description, href, icon: Icon, primary }: QuickActionProps) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        primary
          ? 'border-[#7B1E1E] bg-[#7B1E1E]/5 hover:bg-[#7B1E1E]/10'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className={`p-2 rounded-lg ${primary ? 'bg-[#7B1E1E]/10' : 'bg-gray-100'}`}>
        <Icon className={`h-4 w-4 ${primary ? 'text-[#7B1E1E]' : 'text-gray-600'}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${primary ? 'text-[#7B1E1E]' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ArrowRight className={`h-4 w-4 ${primary ? 'text-[#7B1E1E]' : 'text-gray-400'}`} />
    </a>
  );
}

interface StepCardProps {
  number: number;
  title: string;
  description: string;
}

function StepCard({ number, title, description }: StepCardProps) {
  return (
    <div className="text-center">
      <div className="w-8 h-8 bg-[#7B1E1E] text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2">
        {number}
      </div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
