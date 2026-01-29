/**
 * ADMIN SUPPLIER DETAIL PAGE
 *
 * /admin/suppliers/[id]
 *
 * Shows detailed info about a specific supplier
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowLeft, Users, Wine, ShoppingCart, Mail, Phone, MapPin, Globe, ExternalLink, Crown, Check } from 'lucide-react';
import { useActor } from '@/lib/hooks/useActor';

interface User {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface WineItem {
  id: string;
  name: string;
  producer: string;
  color: string;
  priceSek: number | null;
  isActive: boolean;
  createdAt: string;
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
  email: string | null;
  phone: string | null;
  website: string | null;
  orgNumber: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
}

interface WineStats {
  total: number;
  active: number;
  byColor: Record<string, number>;
}

interface SupplierData {
  supplier: Supplier;
  users: User[];
  wineStats: WineStats;
  recentWines: WineItem[];
  recentOrders: Order[];
}

interface SubscriptionData {
  subscription: {
    tier: 'free' | 'pro' | 'premium';
    status: string;
  };
  usage: {
    wines_count: number;
  };
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importor',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importor',
  'IOR': 'Importor',
};

const COLOR_LABELS: Record<string, { label: string; color: string }> = {
  red: { label: 'Rott', color: 'bg-red-500' },
  white: { label: 'Vitt', color: 'bg-amber-200' },
  rose: { label: 'Rose', color: 'bg-pink-300' },
  sparkling: { label: 'Mousserande', color: 'bg-yellow-300' },
  orange: { label: 'Orange', color: 'bg-orange-400' },
  fortified: { label: 'Starkvin', color: 'bg-amber-700' },
};

export default function AdminSupplierDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const { actor, loading: actorLoading } = useActor();
  const [data, setData] = useState<SupplierData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Access Denied: Admin privileges required');
        setLoading(false);
        return;
      }
      fetchSupplier();
    }
  }, [actor, actorLoading, supplierId]);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/suppliers/${supplierId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Leverantoren hittades inte');
        }
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        throw new Error('Failed to fetch supplier');
      }

      const result = await response.json();
      setData(result);

      // Also fetch subscription
      const subResponse = await fetch(`/api/admin/suppliers/${supplierId}/subscription`, {
        credentials: 'include'
      });
      if (subResponse.ok) {
        const subResult = await subResponse.json();
        setSubscription(subResult);
      }
    } catch (err) {
      console.error('Failed to fetch supplier:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda leverantor'));
    } finally {
      setLoading(false);
    }
  };

  const upgradeTier = async (newTier: 'free' | 'pro' | 'premium') => {
    try {
      setUpgrading(true);
      const response = await fetch(`/api/admin/suppliers/${supplierId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier: newTier }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      const result = await response.json();
      setSubscription({
        subscription: result.subscription,
        usage: subscription?.usage || { wines_count: 0 },
      });
      alert(result.message);
    } catch (err) {
      console.error('Failed to upgrade:', err);
      alert(`Kunde inte uppgradera: ${getErrorMessage(err)}`);
    } finally {
      setUpgrading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_SUPPLIER_CONFIRMATION':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">Vantande</span>;
      case 'CONFIRMED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">Bekraftad</span>;
      case 'DELIVERED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">Levererad</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">Avbruten</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-48 bg-muted rounded-lg mb-6"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nagot gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin/suppliers')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Leverantorer
          </button>
        </div>
      </div>
    );
  }

  const { supplier, users, wineStats, recentWines, recentOrders } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{supplier.name}</h1>
              {!supplier.isActive && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-destructive/10 text-destructive">
                  Inaktiv
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              {SUPPLIER_TYPE_LABELS[supplier.type || ''] || supplier.type || 'Leverantor'}
            </p>
          </div>
        </div>
        <Link
          href="/admin/suppliers"
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
      </div>

      {/* Subscription */}
      <div className="bg-card rounded-lg border border-border p-6 mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Prenumeration
        </h2>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-sm text-muted-foreground">Nuvarande plan: </span>
            <span className={`ml-2 px-3 py-1 text-sm font-medium rounded-full ${
              subscription?.subscription.tier === 'premium' ? 'bg-purple-100 text-purple-800' :
              subscription?.subscription.tier === 'pro' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {subscription?.subscription.tier === 'premium' ? 'Premium' :
               subscription?.subscription.tier === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Viner: {subscription?.usage.wines_count || wineStats.active} / {
              subscription?.subscription.tier === 'free' ? '10' : 'obegransat'
            }
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          {['free', 'pro', 'premium'].map((tier) => {
            const isCurrentTier = subscription?.subscription.tier === tier;
            return (
              <button
                key={tier}
                onClick={() => !isCurrentTier && upgradeTier(tier as 'free' | 'pro' | 'premium')}
                disabled={isCurrentTier || upgrading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isCurrentTier
                    ? 'bg-primary text-primary-foreground cursor-default'
                    : 'bg-muted text-foreground hover:bg-accent'
                } ${upgrading ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isCurrentTier && <Check className="h-4 w-4" />}
                {tier === 'premium' ? 'Premium' : tier === 'pro' ? 'Pro' : 'Free'}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Free = max 10 viner | Pro = obegransat | Premium = obegransat + prioritet
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{wineStats.total}</div>
          <div className="text-sm text-muted-foreground">Viner totalt</div>
          <div className="text-xs text-green-600">{wineStats.active} aktiva</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{users.length}</div>
          <div className="text-sm text-muted-foreground">Anvandare</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{recentOrders.length}</div>
          <div className="text-sm text-muted-foreground">Ordrar</div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Contact Info */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Kontaktuppgifter
          </h2>
          <div className="space-y-3">
            {supplier.orgNumber && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Org.nr:</span>
                <span className="text-sm font-mono text-foreground">{supplier.orgNumber}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{supplier.address}</p>
                  {(supplier.postalCode || supplier.city) && (
                    <p className="text-sm text-muted-foreground">
                      {supplier.postalCode} {supplier.city}
                    </p>
                  )}
                  {supplier.country && (
                    <p className="text-sm text-muted-foreground">{supplier.country}</p>
                  )}
                </div>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${supplier.email}`} className="text-sm text-primary hover:underline">
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${supplier.phone}`} className="text-sm text-foreground">
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {supplier.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {!supplier.address && !supplier.email && !supplier.phone && !supplier.website && (
              <p className="text-sm text-muted-foreground">Inga kontaktuppgifter registrerade</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Registrerad: {formatDate(supplier.createdAt)}
            </p>
          </div>
        </div>

        {/* Users */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Anvandare ({users.length})
          </h2>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga anvandare registrerade</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name || user.email}</p>
                    {user.name && <p className="text-xs text-muted-foreground">{user.email}</p>}
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded bg-muted text-muted-foreground">
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Wine Color Distribution */}
      {Object.keys(wineStats.byColor).length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Viner per farg</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(wineStats.byColor).map(([color, count]) => {
              const colorInfo = COLOR_LABELS[color] || { label: color, color: 'bg-muted' };
              return (
                <div key={color} className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${colorInfo.color}`}></div>
                  <span className="text-sm font-medium text-foreground">{colorInfo.label}</span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Wines */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Wine className="h-5 w-5 text-muted-foreground" />
              Senaste viner
            </h2>
            <Link
              href={`/admin/wines?supplier=${supplierId}`}
              className="text-sm text-primary hover:underline"
            >
              Visa alla
            </Link>
          </div>
          {recentWines.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Inga viner annu
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {recentWines.map((wine) => {
                const colorInfo = COLOR_LABELS[wine.color] || { color: 'bg-muted' };
                return (
                  <div key={wine.id} className="px-6 py-3 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded ${colorInfo.color}`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{wine.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{wine.producer}</p>
                      </div>
                      <div className="text-right">
                        {wine.priceSek && (
                          <p className="text-sm font-medium text-foreground">{wine.priceSek} kr</p>
                        )}
                        {!wine.isActive && (
                          <span className="text-xs text-destructive">Inaktiv</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              Senaste ordrar
            </h2>
            <span className="text-sm text-muted-foreground">{recentOrders.length} st</span>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Inga ordrar annu
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="px-6 py-3 hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-primary">
                      {order.id.substring(0, 8)}...
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
