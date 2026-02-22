/**
 * ADMIN USER DETAIL PAGE
 *
 * /admin/users/[id]
 *
 * Shows detailed information about a specific user including:
 * - User profile and roles
 * - Linked entities (restaurant, supplier, importer) — clickable
 * - Quick stats (if roles exist)
 * - Supplier wines (if SELLER)
 * - Recent activity with clickable rows
 *
 * Access Control:
 * - Admin-only
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Store,
  Package,
  Globe,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Wine,
  ShoppingCart,
  FileText,
  Send,
  ChevronRight,
  Calendar,
  Hash,
  Mail,
  Shield,
} from 'lucide-react';

interface SupplierWine {
  id: string;
  name: string;
  producer: string;
  grape: string | null;
  vintage: number | null;
  price_ex_vat_sek: number;
  stock_qty: number | null;
}

interface QuickStats {
  seller?: {
    wine_count: number;
    order_count: number;
    latest_offer: { id: string; created_at: string; status: string } | null;
  };
  restaurant?: {
    request_count: number;
    order_count: number;
    latest_request: { id: string; created_at: string; status: string } | null;
  };
}

interface UserDetail {
  user_id: string;
  email: string;
  email_masked: string;
  created_at: string;
  roles: string[];
  linked_entities: {
    restaurant_id?: string;
    restaurant_name?: string;
    supplier_id?: string;
    supplier_name?: string;
    importer_id?: string;
    importer_name?: string;
  };
  status: string;
  recent_activity: {
    recent_requests: Array<{
      id: string;
      created_at: string;
      status: string;
      title?: string;
    }>;
    recent_offers: Array<{
      id: string;
      created_at: string;
      status: string;
      title?: string;
    }>;
    recent_orders: Array<{
      id: string;
      created_at: string;
      status: string;
    }>;
  };
  supplier_wines: {
    wines: SupplierWine[];
    total_count: number;
  } | null;
  quick_stats: QuickStats;
  timestamp: string;
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to fetch user detail');
      }

      const data: UserDetail = await response.json();
      setUser(data);
    } catch (err) {
      console.error('Failed to fetch user detail:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda användardetaljer'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'RESTAURANT':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'SELLER':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'IOR':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Admin';
      case 'RESTAURANT':
        return 'Restaurant';
      case 'SELLER':
        return 'Leverantör';
      case 'IOR':
        return 'IOR';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="h-3.5 w-3.5" />;
      case 'RESTAURANT':
        return <Store className="h-3.5 w-3.5" />;
      case 'SELLER':
        return <Package className="h-3.5 w-3.5" />;
      case 'IOR':
        return <Globe className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACCEPTED':
      case 'DELIVERED':
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'SENT':
      case 'PENDING':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Något gick fel</h2>
          <p className="text-muted-foreground mb-4">{error || 'Användare hittades inte'}</p>
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 inline mr-1" />
            Tillbaka till Users
          </button>
        </div>
      </div>
    );
  }

  const hasActivity =
    user.recent_activity.recent_requests.length > 0 ||
    user.recent_activity.recent_offers.length > 0 ||
    user.recent_activity.recent_orders.length > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Användardetaljer</h1>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchUserDetail}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Uppdatera
            </button>
            <button
              onClick={() => router.push('/admin/users')}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Alla användare
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats (if roles exist) */}
      {(user.quick_stats.seller || user.quick_stats.restaurant) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {user.quick_stats.seller && (
            <>
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  <Wine className="h-3.5 w-3.5" />
                  Viner
                </div>
                <p className="text-2xl font-bold text-foreground">{user.quick_stats.seller.wine_count}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Ordrar
                </div>
                <p className="text-2xl font-bold text-foreground">{user.quick_stats.seller.order_count}</p>
              </div>
              {user.quick_stats.seller.latest_offer && (
                <div className="bg-card rounded-lg border border-border p-4 col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                    <Send className="h-3.5 w-3.5" />
                    Senaste offert
                  </div>
                  <p className="text-sm text-foreground">
                    {new Date(user.quick_stats.seller.latest_offer.created_at).toLocaleDateString('sv-SE')}
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadgeColor(user.quick_stats.seller.latest_offer.status)}`}>
                      {user.quick_stats.seller.latest_offer.status}
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
          {user.quick_stats.restaurant && (
            <>
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  Förfrågningar
                </div>
                <p className="text-2xl font-bold text-foreground">{user.quick_stats.restaurant.request_count}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Ordrar
                </div>
                <p className="text-2xl font-bold text-foreground">{user.quick_stats.restaurant.order_count}</p>
              </div>
              {user.quick_stats.restaurant.latest_request && (
                <div className="bg-card rounded-lg border border-border p-4 col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    Senaste förfrågan
                  </div>
                  <p className="text-sm text-foreground">
                    {new Date(user.quick_stats.restaurant.latest_request.created_at).toLocaleDateString('sv-SE')}
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadgeColor(user.quick_stats.restaurant.latest_request.status)}`}>
                      {user.quick_stats.restaurant.latest_request.status}
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile + Roles + Entities */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Profil</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Email
                </p>
                <p className="text-sm text-foreground mt-0.5">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3 w-3" /> User ID
                </p>
                <p className="text-sm text-foreground font-mono mt-0.5">{user.user_id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Skapad
                </p>
                <p className="text-sm text-foreground mt-0.5">
                  {new Date(user.created_at).toLocaleString('sv-SE')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Roller</h2>
            {user.roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border ${getRoleBadgeColor(role)}`}
                  >
                    {getRoleIcon(role)}
                    {getRoleLabel(role)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga roller tilldelade</p>
            )}
          </div>

          {/* Linked Entities */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Länkade Entiteter</h2>
            <div className="space-y-3">
              {user.linked_entities.restaurant_id && (
                <Link
                  href={`/admin/restaurants/${user.linked_entities.restaurant_id}`}
                  className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors group"
                >
                  <Store className="h-5 w-5 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-green-700 transition-colors">
                      {user.linked_entities.restaurant_name || 'Restaurant'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{user.linked_entities.restaurant_id}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-green-600 transition-colors" />
                </Link>
              )}
              {user.linked_entities.supplier_id && (
                <Link
                  href={`/admin/suppliers/${user.linked_entities.supplier_id}`}
                  className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
                >
                  <Package className="h-5 w-5 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-blue-700 transition-colors">
                      {user.linked_entities.supplier_name || 'Supplier'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{user.linked_entities.supplier_id}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                </Link>
              )}
              {user.linked_entities.importer_id && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <Globe className="h-5 w-5 text-orange-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {user.linked_entities.importer_name || 'Importer'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{user.linked_entities.importer_id}</p>
                  </div>
                </div>
              )}
              {!user.linked_entities.restaurant_id &&
                !user.linked_entities.supplier_id &&
                !user.linked_entities.importer_id && (
                  <p className="text-sm text-muted-foreground">Inga länkade entiteter</p>
                )}
            </div>
          </div>
        </div>

        {/* Right column: Activity + Wines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Wines */}
          {user.supplier_wines && user.supplier_wines.wines.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <Wine className="h-4 w-4 text-primary" />
                  Viner ({user.supplier_wines.total_count})
                </h2>
                {user.linked_entities.supplier_id && (
                  <Link
                    href={`/admin/suppliers/${user.linked_entities.supplier_id}`}
                    className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                  >
                    Visa alla viner
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Namn</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Producent</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Druva</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Årg.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Pris (ex moms)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Lager</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {user.supplier_wines.wines.map((wine) => (
                      <tr key={wine.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-foreground font-medium">{wine.name}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{wine.producer}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{wine.grape || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground text-right">{wine.vintage || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-foreground text-right font-medium">
                          {wine.price_ex_vat_sek.toLocaleString('sv-SE')} kr
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground text-right">
                          {wine.stock_qty != null ? wine.stock_qty : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Senaste Aktivitet</h2>

            {!hasActivity && (
              <p className="text-sm text-muted-foreground">Ingen nylig aktivitet</p>
            )}

            {/* Recent Requests */}
            {user.recent_activity.recent_requests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Förfrågningar
                </h3>
                <div className="space-y-1.5">
                  {user.recent_activity.recent_requests.map((req) => (
                    <Link
                      key={req.id}
                      href={`/admin/requests?highlight=${req.id}`}
                      className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {req.title || `Request ${req.id.substring(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleString('sv-SE')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(req.status)}`}>
                          {req.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Offers */}
            {user.recent_activity.recent_offers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  Offerter
                </h3>
                <div className="space-y-1.5">
                  {user.recent_activity.recent_offers.map((offer) => (
                    <Link
                      key={offer.id}
                      href={`/admin/offers?highlight=${offer.id}`}
                      className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {offer.title || `Offert ${offer.id.substring(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(offer.created_at).toLocaleString('sv-SE')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(offer.status)}`}>
                          {offer.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            {user.recent_activity.recent_orders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Ordrar
                </h3>
                <div className="space-y-1.5">
                  {user.recent_activity.recent_orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders?highlight=${order.id}`}
                      className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          Order {order.id.substring(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString('sv-SE')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(order.status)}`}>
                          {order.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
