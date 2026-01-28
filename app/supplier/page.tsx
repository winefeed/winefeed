'use client';

/**
 * SUPPLIER DASHBOARD
 *
 * Main overview page for suppliers
 * Shows key metrics, notifications, matching suggestions, and activity
 */

import { useEffect, useState } from 'react';
import {
  Wine,
  Inbox,
  FileText,
  Package,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Building2,
  ArrowRight,
  Zap,
  Target,
  Clock,
} from 'lucide-react';
import { WineCard, type SupplierWine } from '@/components/supplier/WineCard';
import { WineDetailModal } from '@/components/supplier/WineDetailModal';
import { MatchingSuggestions } from '@/components/supplier/MatchingSuggestions';
import { LowStockAlert } from '@/components/supplier/LowStockAlert';
import { ActivityFeed } from '@/components/supplier/ActivityFeed';
import { UnansweredRequestsWidget } from '@/components/supplier/UnansweredRequestsWidget';
import { ExpiringOffersAlert } from '@/components/supplier/ExpiringOffersAlert';

interface DashboardStats {
  totalWines: number;
  activeWines: number;
  pendingRequests: number;
  activeOffers: number;
  pendingOrders: number;
  acceptedOffers: number;
  completedOrders: number;
  winRate: number;
  // Performance metrics
  avgResponseTimeHours: number;
  responseRate: number;
  conversionRate: number;
  totalAssignments: number;
  answeredAssignments: number;
  // Trends
  trends: {
    offersLast30: number;
    offersTrend: number;
    acceptedLast30: number;
    acceptedTrend: number;
  };
}

export default function SupplierDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [recentWines, setRecentWines] = useState<SupplierWine[]>([]);
  const [selectedWine, setSelectedWine] = useState<SupplierWine | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch supplier context
        const supplierRes = await fetch('/api/me/supplier');
        if (supplierRes.ok) {
          const supplierData = await supplierRes.json();
          setSupplierName(supplierData.supplierName);
          setSupplierId(supplierData.supplierId);

          // Fetch recent wines
          if (supplierData.supplierId) {
            const winesRes = await fetch(`/api/suppliers/${supplierData.supplierId}/wines?limit=6`);
            if (winesRes.ok) {
              const winesData = await winesRes.json();
              const sorted = (winesData.wines || [])
                .sort((a: SupplierWine, b: SupplierWine) =>
                  new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                )
                .slice(0, 6);
              setRecentWines(sorted);
            }
          }
        }

        // Fetch dashboard stats
        const statsRes = await fetch('/api/supplier/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        } else {
          setStats({
            totalWines: 0,
            activeWines: 0,
            pendingRequests: 0,
            activeOffers: 0,
            pendingOrders: 0,
            acceptedOffers: 0,
            completedOrders: 0,
            winRate: 0,
            avgResponseTimeHours: 0,
            responseRate: 0,
            conversionRate: 0,
            totalAssignments: 0,
            answeredAssignments: 0,
            trends: { offersLast30: 0, offersTrend: 0, acceptedLast30: 0, acceptedTrend: 0 },
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
          acceptedOffers: 0,
          completedOrders: 0,
          winRate: 0,
          avgResponseTimeHours: 0,
          responseRate: 0,
          conversionRate: 0,
          totalAssignments: 0,
          answeredAssignments: 0,
          trends: { offersLast30: 0, offersTrend: 0, acceptedLast30: 0, acceptedTrend: 0 },
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

  const hasActivity = stats && (stats.totalWines > 0 || stats.pendingRequests > 0 || stats.activeOffers > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Quick Stats */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Välkommen{supplierName ? `, ${supplierName}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">
              Här ser du en översikt av din verksamhet
            </p>
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-2">
            <a
              href="/supplier/wines"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg hover:bg-[#6B1818] transition-colors text-sm font-medium"
            >
              <Wine className="h-4 w-4" />
              Vinkatalog
            </a>
            <a
              href="/supplier/requests"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Inbox className="h-4 w-4" />
              Förfrågningar
              {stats?.pendingRequests ? (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-bold">
                  {stats.pendingRequests}
                </span>
              ) : null}
            </a>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Viner i katalog"
          value={stats?.totalWines || 0}
          subtitle={`${stats?.activeWines || 0} aktiva`}
          icon={Wine}
          color="wine"
          href="/supplier/wines"
        />
        <StatCard
          title="Nya förfrågningar"
          value={stats?.pendingRequests || 0}
          subtitle="Väntar på svar"
          icon={Inbox}
          color="amber"
          href="/supplier/requests"
          highlight={stats?.pendingRequests ? stats.pendingRequests > 0 : false}
        />
        <StatCard
          title="Aktiva offerter"
          value={stats?.activeOffers || 0}
          subtitle={`${stats?.acceptedOffers || 0} accepterade`}
          icon={FileText}
          color="blue"
          href="/supplier/offers"
        />
        <StatCard
          title="Ordrar"
          value={stats?.pendingOrders || 0}
          subtitle="Att behandla"
          icon={Package}
          color="purple"
          href="/supplier/orders"
          highlight={stats?.pendingOrders ? stats.pendingOrders > 0 : false}
        />
      </div>

      {/* Alerts Section */}
      <div className="space-y-4 mb-8">
        {/* Expiring Offers Alert */}
        <ExpiringOffersAlert />

        {/* Low Stock Alert */}
        <LowStockAlert />

        {/* Empty catalog warning */}
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Unanswered Requests with Quick Filter */}
          <UnansweredRequestsWidget />

          {/* Matching Suggestions */}
          <MatchingSuggestions limit={3} />

          {/* Onboarding Progress - shown for new users */}
          {!hasActivity && (
            <OnboardingProgress stats={stats} />
          )}

          {/* Recent Wines */}
          {recentWines.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Senast tillagda viner
                </h2>
                <a
                  href="/supplier/wines"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#7B1E1E] hover:text-[#7B1E1E]/80"
                >
                  Visa alla
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentWines.slice(0, 4).map((wine) => (
                  <WineCard
                    key={wine.id}
                    wine={wine}
                    onClick={() => setSelectedWine(wine)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Activity Feed */}
          <ActivityFeed limit={6} />

          {/* Performance Summary */}
          {hasActivity && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                Din prestation
              </h2>
              <div className="space-y-4">
                {/* Win rate */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Win rate</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {stats?.winRate || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (stats?.winRate || 0) >= 50 ? 'bg-green-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(stats?.winRate || 0, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Response rate */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Svarsfrekvens</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {stats?.responseRate || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (stats?.responseRate || 0) >= 80 ? 'bg-green-500' : (stats?.responseRate || 0) >= 50 ? 'bg-amber-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.min(stats?.responseRate || 0, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Avg response time */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Snitt svarstid
                  </span>
                  <span className={`text-sm font-semibold ${
                    (stats?.avgResponseTimeHours || 0) <= 24 ? 'text-green-600' :
                    (stats?.avgResponseTimeHours || 0) <= 48 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {stats?.avgResponseTimeHours ? (
                      stats.avgResponseTimeHours < 24
                        ? `${stats.avgResponseTimeHours}h`
                        : `${Math.round(stats.avgResponseTimeHours / 24)}d`
                    ) : '-'}
                  </span>
                </div>

                {/* Trend indicator */}
                {stats?.trends && stats.trends.offersLast30 > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Senaste 30 dagarna</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stats.trends.offersLast30} offerter</span>
                        {stats.trends.offersTrend !== 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            stats.trends.offersTrend > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.trends.offersTrend > 0 ? '+' : ''}{stats.trends.offersTrend}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100">
                  <a
                    href="/supplier/analytics"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#7B1E1E] hover:text-[#7B1E1E]/80"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Se detaljerad analys
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Help Widget */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Behöver du hjälp?
            </h2>
            <div className="space-y-3">
              <a
                href="/supplier/contact"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#7B1E1E] hover:bg-red-50 transition-colors"
              >
                <div className="p-2 bg-[#7B1E1E]/10 rounded-lg">
                  <HelpCircle className="h-4 w-4 text-[#7B1E1E]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Kontakta support</p>
                  <p className="text-xs text-gray-500">Frågor eller teknisk hjälp</p>
                </div>
              </a>
              <a
                href="/supplier/profile"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#7B1E1E] hover:bg-red-50 transition-colors"
              >
                <div className="p-2 bg-[#7B1E1E]/10 rounded-lg">
                  <Building2 className="h-4 w-4 text-[#7B1E1E]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Företagsprofil</p>
                  <p className="text-xs text-gray-500">Se dina företagsuppgifter</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Wine Detail Modal */}
      {selectedWine && (
        <WineDetailModal
          wine={selectedWine}
          supplierId={supplierId || undefined}
          onClose={() => setSelectedWine(null)}
          onUpdate={(updated) => {
            setRecentWines(wines => wines.map(w => w.id === updated.id ? updated : w));
            setSelectedWine(updated);
          }}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: 'wine' | 'blue' | 'amber' | 'green' | 'purple';
  href: string;
  highlight?: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, color, href, highlight }: StatCardProps) {
  const colorClasses = {
    wine: 'bg-[#7B1E1E]/10 text-[#7B1E1E]',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  const hoverColorClasses = {
    wine: 'group-hover:bg-[#7B1E1E]/20',
    blue: 'group-hover:bg-blue-100',
    amber: 'group-hover:bg-amber-100',
    green: 'group-hover:bg-green-100',
    purple: 'group-hover:bg-purple-100',
  };

  return (
    <a
      href={href}
      className={`group block bg-white rounded-lg border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
        highlight ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${colorClasses[color]} ${hoverColorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-gray-600">{title}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
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

// Onboarding steps configuration
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'account',
    title: 'Skapa konto',
    description: 'Registrera dig som leverantör',
    href: '/supplier/profile',
    icon: Building2,
  },
  {
    id: 'catalog',
    title: 'Ladda upp vinkatalog',
    description: 'Importera dina viner via Excel eller CSV',
    href: '/supplier/wines',
    icon: Wine,
  },
  {
    id: 'request',
    title: 'Svara på förfrågan',
    description: 'Besvara din första restaurangförfrågan',
    href: '/supplier/requests',
    icon: Inbox,
  },
  {
    id: 'offer',
    title: 'Skicka offert',
    description: 'Skicka ditt första prisförslag',
    href: '/supplier/offers',
    icon: FileText,
  },
];

interface OnboardingProgressProps {
  stats: DashboardStats | null;
}

function OnboardingProgress({ stats }: OnboardingProgressProps) {
  // Calculate which steps are done
  const completedSteps = {
    account: true, // Always done if they're logged in
    catalog: (stats?.totalWines || 0) > 0,
    request: false, // Would need backend tracking
    offer: (stats?.activeOffers || 0) > 0 || (stats?.acceptedOffers || 0) > 0,
  };

  // Find current step (first incomplete step)
  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    step => !completedSteps[step.id as keyof typeof completedSteps]
  );

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = (completedCount / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Kom igång
        </h2>
        <span className="text-sm text-gray-500">
          {completedCount} av {ONBOARDING_STEPS.length} klara
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-1">
        {ONBOARDING_STEPS.map((step, index) => {
          const isDone = completedSteps[step.id as keyof typeof completedSteps];
          const isCurrent = index === currentStepIndex;
          const Icon = step.icon;

          return (
            <a
              key={step.id}
              href={step.href}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isDone
                  ? 'bg-green-50 hover:bg-green-100'
                  : isCurrent
                  ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Step indicator */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isDone ? '✓' : index + 1}
              </div>

              {/* Icon */}
              <div
                className={`p-2 rounded-lg ${
                  isDone
                    ? 'bg-green-100'
                    : isCurrent
                    ? 'bg-amber-100'
                    : 'bg-gray-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isDone
                      ? 'text-green-600'
                      : isCurrent
                      ? 'text-amber-600'
                      : 'text-gray-400'
                  }`}
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isDone
                      ? 'text-green-800'
                      : isCurrent
                      ? 'text-amber-800'
                      : 'text-gray-600'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-gray-500 truncate">{step.description}</p>
              </div>

              {/* Status badge */}
              {isDone ? (
                <span className="text-xs font-medium text-green-600 flex-shrink-0">
                  Klar
                </span>
              ) : isCurrent ? (
                <span className="text-xs font-medium text-amber-600 flex-shrink-0 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  Du är här
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}
