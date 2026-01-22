/**
 * ADMIN DASHBOARD
 *
 * /admin
 *
 * Overview of all suppliers and wines in the system
 * Main landing page for admin users
 */

'use client';

import { useEffect, useState } from 'react';
import { Wine, Users, Building2, Package, TrendingUp, ExternalLink, RefreshCw, ChevronRight } from 'lucide-react';

interface SupplierStats {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  email: string | null;
  phone: string | null;
  website: string | null;
  orgNumber: string | null;
  createdAt: string;
  totalWines: number;
  activeWines: number;
  userCount: number;
  avgPriceSek: number;
  colorBreakdown: Record<string, number>;
}

interface RecentWine {
  id: string;
  name: string;
  producer: string;
  color: string;
  priceSek: number | null;
  supplierName: string;
  createdAt: string;
}

interface Stats {
  overview: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalWines: number;
    activeWines: number;
    totalUsers: number;
  };
  suppliers: SupplierStats[];
  recentWines: RecentWine[];
  colorDistribution: Record<string, number>;
  typeDistribution: Record<string, { count: number; label: string }>;
  timestamp: string;
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importör',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importör',
};

const COLOR_LABELS: Record<string, { label: string; color: string }> = {
  red: { label: 'Rött', color: 'bg-red-500' },
  white: { label: 'Vitt', color: 'bg-amber-200' },
  rose: { label: 'Rosé', color: 'bg-pink-300' },
  sparkling: { label: 'Mousserande', color: 'bg-yellow-300' },
  orange: { label: 'Orange', color: 'bg-orange-400' },
  fortified: { label: 'Starkvin', color: 'bg-amber-700' },
};

export default function AdminDashboardPage() {
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

      const response = await fetch('/api/admin/stats');

      if (!response.ok) {
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
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Något gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Systemöversikt</h1>
          <p className="text-muted-foreground mt-1">Alla leverantörer och viner</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Uppdatera
        </button>
      </div>
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Leverantörer"
            value={stats.overview.totalSuppliers}
            subtitle={`${stats.overview.activeSuppliers} aktiva`}
            icon={Building2}
            color="blue"
          />
          <StatCard
            title="Viner totalt"
            value={stats.overview.totalWines}
            subtitle={`${stats.overview.activeWines} aktiva`}
            icon={Wine}
            color="red"
          />
          <StatCard
            title="Användare"
            value={stats.overview.totalUsers}
            subtitle="Leverantörkonton"
            icon={Users}
            color="green"
          />
          <StatCard
            title="Snittbelopp"
            value={stats.suppliers.length > 0
              ? Math.round(stats.suppliers.reduce((sum, s) => sum + s.avgPriceSek, 0) / stats.suppliers.length)
              : 0}
            subtitle="SEK/vin"
            icon={TrendingUp}
            color="purple"
            suffix=" kr"
          />
        </div>

        {/* Color Distribution */}
        <div className="bg-card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Fördelning per färg</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.colorDistribution).map(([color, count]) => {
              const colorInfo = COLOR_LABELS[color] || { label: color, color: 'bg-muted' };
              const percentage = stats.overview.totalWines > 0
                ? Math.round((count / stats.overview.totalWines) * 100)
                : 0;
              return (
                <div key={color} className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${colorInfo.color}`}></div>
                  <span className="text-sm font-medium text-foreground">{colorInfo.label}</span>
                  <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Suppliers List */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Alla leverantörer</h2>
                <span className="text-sm text-muted-foreground">{stats.suppliers.length} st</span>
              </div>

              {stats.suppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">Inga leverantörer ännu</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.suppliers.map((supplier) => (
                    <div key={supplier.id} className="px-6 py-4 hover:bg-accent transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{supplier.name}</h3>
                            {!supplier.isActive && (
                              <span className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded">
                                Inaktiv
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {SUPPLIER_TYPE_LABELS[supplier.type] || supplier.type}
                          </p>
                          {supplier.email && (
                            <p className="text-sm text-muted-foreground/70 mt-1">{supplier.email}</p>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-foreground">{supplier.totalWines}</div>
                              <div className="text-xs text-muted-foreground">viner</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-foreground">{supplier.userCount}</div>
                              <div className="text-xs text-muted-foreground">användare</div>
                            </div>
                          </div>

                          {/* Color breakdown mini-chart */}
                          {supplier.totalWines > 0 && (
                            <div className="flex gap-1 mt-2 justify-end">
                              {Object.entries(supplier.colorBreakdown).map(([color, count]) => {
                                const colorInfo = COLOR_LABELS[color] || { color: 'bg-muted' };
                                return (
                                  <div
                                    key={color}
                                    className={`h-2 rounded ${colorInfo.color}`}
                                    style={{ width: `${Math.max(8, (count / supplier.totalWines) * 60)}px` }}
                                    title={`${color}: ${count}`}
                                  ></div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-2 mt-3">
                        {supplier.website && (
                          <a
                            href={supplier.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Hemsida
                          </a>
                        )}
                        <a
                          href={`/supplier/wines?supplier=${supplier.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <ChevronRight className="h-3 w-3" />
                          Visa viner
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Wines */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Senast tillagda viner</h2>
              </div>

              {stats.recentWines.length === 0 ? (
                <div className="text-center py-12">
                  <Wine className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">Inga viner ännu</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.recentWines.map((wine) => {
                    const colorInfo = COLOR_LABELS[wine.color] || { color: 'bg-muted' };
                    return (
                      <div key={wine.id} className="px-6 py-3 hover:bg-accent transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-full min-h-[40px] rounded ${colorInfo.color}`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{wine.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{wine.producer}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground/70">{wine.supplierName}</span>
                              {wine.priceSek && (
                                <span className="text-xs font-medium text-foreground">
                                  {wine.priceSek} kr
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Type Distribution */}
            <div className="bg-card rounded-lg border border-border p-6 mt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Leverantörstyper</h2>
              <div className="space-y-3">
                {Object.entries(stats.typeDistribution).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{data.label}</span>
                    <span className="text-sm font-semibold text-foreground">{data.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        Uppdaterad: {new Date(stats.timestamp).toLocaleString('sv-SE')}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'red' | 'green' | 'purple';
  suffix?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color, suffix = '' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    red: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}{suffix}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
