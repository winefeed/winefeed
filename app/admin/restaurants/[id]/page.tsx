/**
 * ADMIN RESTAURANT DETAIL PAGE
 *
 * /admin/restaurants/[id]
 *
 * Shows detailed info about a specific restaurant
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, ArrowLeft, Users, Inbox, ShoppingCart, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { useActor } from '@/lib/hooks/useActor';

interface User {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

interface Request {
  id: string;
  status: string;
  fritext: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
}

interface Restaurant {
  id: string;
  name: string;
  orgNumber: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

interface RestaurantData {
  restaurant: Restaurant;
  users: User[];
  recentRequests: Request[];
  recentOrders: Order[];
}

export default function AdminRestaurantDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const restaurantId = params.id;
  const { actor, loading: actorLoading } = useActor();
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Access Denied: Admin privileges required');
        setLoading(false);
        return;
      }
      fetchRestaurant();
    }
  }, [actor, actorLoading, restaurantId]);

  const fetchRestaurant = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/restaurants/${restaurantId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Restaurangen hittades inte');
        }
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        throw new Error('Failed to fetch restaurant');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Failed to fetch restaurant:', err);
      setError(err.message || 'Kunde inte ladda restaurang');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">Oppen</span>;
      case 'CLOSED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">Avslutad</span>;
      case 'PENDING_SUPPLIER_CONFIRMATION':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">Vantande</span>;
      case 'CONFIRMED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">Bekraftad</span>;
      case 'DELIVERED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">Levererad</span>;
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
            onClick={() => router.push('/admin/restaurants')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Restauranger
          </button>
        </div>
      </div>
    );
  }

  const { restaurant, users, recentRequests, recentOrders } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-600">
            <Store className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{restaurant.name}</h1>
            {restaurant.orgNumber && (
              <p className="text-muted-foreground font-mono">{restaurant.orgNumber}</p>
            )}
          </div>
        </div>
        <Link
          href="/admin/restaurants"
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
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
            {restaurant.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{restaurant.address}</p>
                  {(restaurant.postalCode || restaurant.city) && (
                    <p className="text-sm text-muted-foreground">
                      {restaurant.postalCode} {restaurant.city}
                    </p>
                  )}
                  {restaurant.country && (
                    <p className="text-sm text-muted-foreground">{restaurant.country}</p>
                  )}
                </div>
              </div>
            )}
            {restaurant.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${restaurant.email}`} className="text-sm text-primary hover:underline">
                  {restaurant.email}
                </a>
              </div>
            )}
            {restaurant.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${restaurant.phone}`} className="text-sm text-foreground">
                  {restaurant.phone}
                </a>
              </div>
            )}
            {!restaurant.address && !restaurant.email && !restaurant.phone && (
              <p className="text-sm text-muted-foreground">Inga kontaktuppgifter registrerade</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Registrerad: {formatDate(restaurant.createdAt)}
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              Senaste forfragningar
            </h2>
            <span className="text-sm text-muted-foreground">{recentRequests.length} st</span>
          </div>
          {recentRequests.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Inga forfragningar annu
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => router.push(`/dashboard/requests/${request.id}`)}
                  className="px-6 py-3 hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-primary">
                      {request.id.substring(0, 8)}...
                    </span>
                    {getStatusBadge(request.status)}
                  </div>
                  {request.fritext && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{request.fritext}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(request.createdAt)}</p>
                </div>
              ))}
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
