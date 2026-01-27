/**
 * ADMIN DASHBOARD
 *
 * /admin
 *
 * Operational clarity dashboard - identify stalled workflows
 * Main landing page for admin users
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Wine, Users, Building2, TrendingUp, ExternalLink, RefreshCw, ShoppingCart, FileText, Inbox, Store, AlertTriangle, Clock, ChevronRight, Filter } from 'lucide-react';
import { ComplianceStatusBadge, type ComplianceStatus } from '@/components/compliance';

// ============================================================================
// PENDING ACTIONS TYPES
// ============================================================================

interface PendingItem {
  id: string;
  type: 'request' | 'order' | 'import_case';
  status: string;
  reason: string;
  owner: {
    role: string;
    name: string;
    id: string;
  };
  ageHours: number;
  ageLabel: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

interface PendingSummary {
  requests: number;
  orders: number;
  importCases: number;
  total: number;
  byAgeBucket: {
    today: number;
    '1-2d': number;
    '3-7d': number;
    '7d+': number;
  };
  byOwnerRole: {
    SUPPLIER: number;
    RESTAURANT: number;
    IOR: number;
  };
}

interface PendingActionsData {
  items: PendingItem[];
  summary: PendingSummary;
  timestamp: string;
}

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

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  inFulfillment: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

interface RequestStats {
  total: number;
  open: number;
  closed: number;
}

interface OfferStats {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
}

interface Stats {
  overview: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalWines: number;
    activeWines: number;
    totalUsers: number;
    totalRestaurants: number;
  };
  orders: OrderStats;
  requests: RequestStats;
  offers: OfferStats;
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
  const [pendingActions, setPendingActions] = useState<PendingActionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for pending actions
  const [typeFilter, setTypeFilter] = useState<'all' | 'request' | 'order' | 'import_case'>('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'SUPPLIER' | 'RESTAURANT' | 'IOR'>('all');
  const [ageFilter, setAgeFilter] = useState<'all' | 'today' | '1-2d' | '3-7d' | '7d+'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both stats and pending actions in parallel
      const [statsRes, pendingRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/pending-actions'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      if (!pendingRes.ok) throw new Error('Failed to fetch pending actions');

      const [statsData, pendingData] = await Promise.all([
        statsRes.json(),
        pendingRes.json(),
      ]);

      setStats(statsData);
      setPendingActions(pendingData);
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
      setError(err.message || 'Kunde inte ladda data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = fetchData; // Alias for backward compatibility

  // Filter pending items
  const filteredPendingItems = useMemo(() => {
    if (!pendingActions) return [];
    return pendingActions.items.filter(item => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (ownerFilter !== 'all' && item.owner.role !== ownerFilter) return false;
      if (ageFilter !== 'all') {
        const bucket = item.ageHours < 24 ? 'today' :
                       item.ageHours < 48 ? '1-2d' :
                       item.ageHours < 168 ? '3-7d' : '7d+';
        if (bucket !== ageFilter) return false;
      }
      return true;
    });
  }, [pendingActions, typeFilter, ownerFilter, ageFilter]);

  // Get link for pending item
  const getItemLink = (item: PendingItem): string => {
    switch (item.type) {
      case 'request': return `/dashboard/requests/${item.id}`;
      case 'order': return `/admin/reports`;
      case 'import_case': return `/ior/orders`;
      default: return '#';
    }
  };

  // Get type label
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'request': return 'Förfrågan';
      case 'order': return 'Order';
      case 'import_case': return 'Importärende';
      default: return type;
    }
  };

  // Get owner role label
  const getOwnerRoleLabel = (role: string): string => {
    switch (role) {
      case 'SUPPLIER': return 'Leverantör';
      case 'RESTAURANT': return 'Restaurang';
      case 'IOR': return 'IOR';
      default: return role;
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Operativ översikt - identifiera vad som behöver åtgärdas</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Uppdatera
        </button>
      </div>

      {/* ================================================================== */}
      {/* PENDING ACTIONS - System Overview Counts */}
      {/* ================================================================== */}
      {pendingActions && pendingActions.summary.total > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-amber-900">Kräver åtgärd</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => { setTypeFilter('request'); setOwnerFilter('all'); setAgeFilter('all'); }}
              className={`p-3 rounded-lg border transition-colors ${
                typeFilter === 'request' ? 'bg-amber-100 border-amber-300' : 'bg-white border-amber-200 hover:bg-amber-50'
              }`}
            >
              <div className="text-2xl font-bold text-amber-900">{pendingActions.summary.requests}</div>
              <div className="text-sm text-amber-700">Förfrågningar</div>
            </button>
            <button
              onClick={() => { setTypeFilter('order'); setOwnerFilter('all'); setAgeFilter('all'); }}
              className={`p-3 rounded-lg border transition-colors ${
                typeFilter === 'order' ? 'bg-amber-100 border-amber-300' : 'bg-white border-amber-200 hover:bg-amber-50'
              }`}
            >
              <div className="text-2xl font-bold text-amber-900">{pendingActions.summary.orders}</div>
              <div className="text-sm text-amber-700">Ordrar</div>
            </button>
            <button
              onClick={() => { setTypeFilter('import_case'); setOwnerFilter('all'); setAgeFilter('all'); }}
              className={`p-3 rounded-lg border transition-colors ${
                typeFilter === 'import_case' ? 'bg-amber-100 border-amber-300' : 'bg-white border-amber-200 hover:bg-amber-50'
              }`}
            >
              <div className="text-2xl font-bold text-amber-900">{pendingActions.summary.importCases}</div>
              <div className="text-sm text-amber-700">Importärenden</div>
            </button>
          </div>
        </div>
      )}

      {/* No pending actions - success state */}
      {pendingActions && pendingActions.summary.total === 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-lg">✓</div>
          <div>
            <p className="font-medium text-green-800">Inga väntande åtgärder</p>
            <p className="text-sm text-green-700">Alla processer flyter på som de ska.</p>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* PENDING ACTIONS LIST */}
      {/* ================================================================== */}
      {pendingActions && pendingActions.summary.total > 0 && (
        <div className="mb-8 bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Väntande åtgärder
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredPendingItems.length} av {pendingActions.summary.total})
                </span>
              </h2>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />

                {/* Type filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="text-sm border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="all">Alla typer</option>
                  <option value="request">Förfrågningar</option>
                  <option value="order">Ordrar</option>
                  <option value="import_case">Importärenden</option>
                </select>

                {/* Owner filter */}
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value as any)}
                  className="text-sm border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="all">Alla ägare</option>
                  <option value="SUPPLIER">Leverantör</option>
                  <option value="RESTAURANT">Restaurang</option>
                  <option value="IOR">IOR</option>
                </select>

                {/* Age filter */}
                <select
                  value={ageFilter}
                  onChange={(e) => setAgeFilter(e.target.value as any)}
                  className="text-sm border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="all">Alla åldrar</option>
                  <option value="today">Idag</option>
                  <option value="1-2d">1-2 dagar</option>
                  <option value="3-7d">3-7 dagar</option>
                  <option value="7d+">7+ dagar</option>
                </select>

                {(typeFilter !== 'all' || ownerFilter !== 'all' || ageFilter !== 'all') && (
                  <button
                    onClick={() => { setTypeFilter('all'); setOwnerFilter('all'); setAgeFilter('all'); }}
                    className="text-sm text-primary hover:underline"
                  >
                    Rensa
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {filteredPendingItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Inga objekt matchar dina filter
              </div>
            ) : (
              filteredPendingItems.map((item) => (
                <a
                  key={`${item.type}-${item.id}`}
                  href={getItemLink(item)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-accent transition-colors"
                >
                  {/* Type badge */}
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    item.type === 'request' ? 'bg-blue-100 text-blue-800' :
                    item.type === 'order' ? 'bg-orange-100 text-orange-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {getTypeLabel(item.type)}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{item.reason}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {item.type === 'request' && item.metadata.fritext && (
                        <span>&quot;{item.metadata.fritext}&quot; - {item.metadata.restaurantName}</span>
                      )}
                      {item.type === 'order' && (
                        <span>{item.metadata.restaurantName} → {item.metadata.supplierName}</span>
                      )}
                      {item.type === 'import_case' && (
                        <span className="flex items-center gap-2">
                          <span>IOR: {item.metadata.importerName}</span>
                          {item.metadata.complianceStatus && (
                            <ComplianceStatusBadge
                              status={item.metadata.complianceStatus as ComplianceStatus}
                              size="sm"
                            />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Owner */}
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{item.owner.name}</div>
                    <div className="text-xs text-muted-foreground">{getOwnerRoleLabel(item.owner.role)} måste agera</div>
                  </div>

                  {/* Age */}
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    item.ageHours >= 168 ? 'bg-red-100 text-red-800' :
                    item.ageHours >= 72 ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.ageLabel}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* EXISTING STATS SECTION */}
      {/* ================================================================== */}

        {/* Overview Stats - Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard
            title="Leverantörer"
            value={stats.overview.totalSuppliers}
            subtitle={`${stats.overview.activeSuppliers} aktiva`}
            icon={Building2}
            color="blue"
            href="/admin/suppliers"
          />
          <StatCard
            title="Restauranger"
            value={stats.overview.totalRestaurants}
            subtitle="Registrerade"
            icon={Store}
            color="green"
            href="/admin/restaurants"
          />
          <StatCard
            title="Viner totalt"
            value={stats.overview.totalWines}
            subtitle={`${stats.overview.activeWines} aktiva`}
            icon={Wine}
            color="red"
            href="/admin/wines"
          />
          <StatCard
            title="Användare"
            value={stats.overview.totalUsers}
            subtitle="Leverantörkonton"
            icon={Users}
            color="purple"
            href="/admin/users"
          />
        </div>

        {/* Overview Stats - Row 2: Orders, Requests, Offers */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/orders"
            className="bg-card rounded-lg border border-border p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer block"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Ordrar</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.orders.total}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                {stats.orders.pending} väntande
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                {stats.orders.confirmed + stats.orders.inFulfillment} bekräftade
              </span>
              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                {stats.orders.delivered} levererade
              </span>
            </div>
          </Link>

          <Link
            href="/admin/requests"
            className="bg-card rounded-lg border border-border p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer block"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                <Inbox className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Förfrågningar</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.requests.total}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                {stats.requests.open} öppna
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded">
                {stats.requests.closed} avslutade
              </span>
            </div>
          </Link>

          <Link
            href="/admin/offers"
            className="bg-card rounded-lg border border-border p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer block"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Offerter</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.offers.total}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                {stats.offers.sent} skickade
              </span>
              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                {stats.offers.accepted} accepterade
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded">
                {stats.offers.draft} utkast
              </span>
            </div>
          </Link>
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
                      {supplier.website && (
                        <div className="flex gap-2 mt-3">
                          <a
                            href={supplier.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Hemsida
                          </a>
                        </div>
                      )}
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
  href?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color, suffix = '', href }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    red: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
  };

  const content = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}{suffix}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-card rounded-lg border border-border p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer block"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      {content}
    </div>
  );
}
