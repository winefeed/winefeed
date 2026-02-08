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
            className="inline-flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg hover:bg-wine-hover transition-colors text-sm font-medium"
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
          title="Åtgärd krävs"
          value={stats?.pendingOffers || 0}
          subtitle="Offerter att granska"
          icon={Mail}
          color="amber"
          href="/dashboard/offers"
          highlight={stats?.pendingOffers ? stats.pendingOffers > 0 : false}
        />
        <StatCard
          title="Pågående ärenden"
          value={stats?.pendingOrders || 0}
          subtitle="Under hantering"
          icon={Package}
          color="purple"
          href="/dashboard/orders"
        />
        <StatCard
          title="Estimerad månadsutgift"
          value={formatCurrency(stats?.totalSpentThisMonth || 0)}
          subtitle="Baserat på accepterade offerter"
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
                  className="text-sm font-medium text-wine hover:underline"
                >
                  Visa alla →
                </a>
              </div>

              <div className="divide-y divide-gray-100">
                {pendingOffers.slice(0, 4).map((offer) => (
                  <div
                    key={offer.id}
                    className="px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                            {offer.supplier_name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {offer.lines_count} {offer.lines_count === 1 ? 'vin' : 'viner'} • {formatCurrency(offer.total_amount)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Mottagen {formatDistanceToNow(new Date(offer.created_at), { addSuffix: false, locale: sv })} sedan
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`/dashboard/offers/${offer.id}`}
                          className="px-3 py-1.5 bg-wine text-white text-sm font-medium rounded-lg hover:bg-wine-hover transition-colors"
                        >
                          Granska
                        </a>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (confirm('Vill du avfärda denna offert?')) {
                              fetch(`/api/offers/${offer.id}/reject`, { method: 'POST' })
                                .then(() => window.location.reload())
                                .catch(err => console.error('Failed to reject:', err));
                            }
                          }}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Avfärda
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3 Steps to First Order - for new users */}
          {!hasActivity && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  3 steg till första beställning
                </h2>
                <span className="text-sm text-gray-500">0/3 klart</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div className="bg-wine h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="space-y-3">
                <OnboardingStep
                  number={1}
                  title="Skapa din första förfrågan"
                  description="Berätta vad du söker så matchar vi rätt leverantörer"
                  href="/dashboard/new-request"
                  completed={false}
                  current
                />
                <OnboardingStep
                  number={2}
                  title="Granska din första offert"
                  description="Jämför priser och villkor från leverantörer"
                  href="/dashboard/offers"
                  completed={false}
                />
                <OnboardingStep
                  number={3}
                  title="Skapa din första beställning"
                  description="Acceptera en offert för att lägga beställning"
                  href="/dashboard/offers"
                  completed={false}
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
                {stats.recentActivity
                  .filter((a) => ['offer', 'order'].includes(a.type)) // Only important events
                  .slice(0, 8) // Max 8 items
                  .map((activity) => (
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
                <span className="text-sm text-gray-600">Avslutade ärenden</span>
                <span className="font-semibold text-gray-900">{stats?.completedOrders || 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Estimerat inköp</span>
                <span className="font-bold text-wine">
                  {formatCurrency(stats?.totalSpentThisMonth || 0)}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Baserat på accepterade offerter</p>
          </div>

          {/* Help */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Behöver du hjälp?
            </h2>
            <a
              href="/dashboard/help"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-wine hover:bg-red-50 transition-colors"
            >
              <div className="p-2 bg-wine/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-wine" />
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
          ? 'border-wine bg-wine/5 hover:bg-wine/10'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className={`p-2 rounded-lg ${primary ? 'bg-wine/10' : 'bg-gray-100'}`}>
        <Icon className={`h-4 w-4 ${primary ? 'text-wine' : 'text-gray-600'}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${primary ? 'text-wine' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ArrowRight className={`h-4 w-4 ${primary ? 'text-wine' : 'text-gray-400'}`} />
    </a>
  );
}

interface OnboardingStepProps {
  number: number;
  title: string;
  description: string;
  href: string;
  completed: boolean;
  current?: boolean;
}

function OnboardingStep({ number, title, description, href, completed, current }: OnboardingStepProps) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        current
          ? 'border-wine bg-wine/5 hover:bg-wine/10'
          : completed
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          completed
            ? 'bg-green-500 text-white'
            : current
            ? 'bg-wine text-white'
            : 'bg-gray-200 text-gray-600'
        }`}
      >
        {completed ? <CheckCircle className="h-5 w-5" /> : number}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${current ? 'text-wine' : completed ? 'text-green-700' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {current && <ArrowRight className="h-4 w-4 text-wine flex-shrink-0" />}
    </a>
  );
}
