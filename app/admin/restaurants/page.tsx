/**
 * ADMIN RESTAURANTS PAGE
 *
 * /admin/restaurants
 *
 * Shows all restaurants with filtering and sorting
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, RefreshCw, Search, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useActor } from '@/lib/hooks/useActor';

interface RestaurantStats {
  userCount: number;
  totalRequests: number;
  openRequests: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
}

interface Restaurant {
  id: string;
  name: string;
  orgNumber: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  stats: RestaurantStats;
}

export default function AdminRestaurantsPage() {
  const router = useRouter();
  const { actor, loading: actorLoading } = useActor();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Access Denied: Admin privileges required');
        setLoading(false);
        return;
      }
      fetchRestaurants();
    }
  }, [actor, actorLoading]);

  useEffect(() => {
    let filtered = restaurants;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.city?.toLowerCase().includes(query) ||
        r.orgNumber?.includes(query)
      );
    }

    if (activityFilter !== 'ALL') {
      if (activityFilter === 'HAS_ORDERS') {
        filtered = filtered.filter(r => r.stats.totalOrders > 0);
      } else if (activityFilter === 'NO_ORDERS') {
        filtered = filtered.filter(r => r.stats.totalOrders === 0);
      } else if (activityFilter === 'HAS_REQUESTS') {
        filtered = filtered.filter(r => r.stats.totalRequests > 0);
      }
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'city':
          aVal = (a.city || '').toLowerCase();
          bVal = (b.city || '').toLowerCase();
          break;
        case 'users':
          aVal = a.stats.userCount;
          bVal = b.stats.userCount;
          break;
        case 'requests':
          aVal = a.stats.totalRequests;
          bVal = b.stats.totalRequests;
          break;
        case 'orders':
          aVal = a.stats.totalOrders;
          bVal = b.stats.totalOrders;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredRestaurants(filtered);
  }, [restaurants, searchQuery, activityFilter, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ column, label, className = '' }: { column: string; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(column)}
      className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <div className="w-3" />
        )}
      </div>
    </th>
  );

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/restaurants', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        throw new Error('Failed to fetch restaurants');
      }

      const data = await response.json();
      setRestaurants(data.restaurants);
      setFilteredRestaurants(data.restaurants);
    } catch (err: any) {
      console.error('Failed to fetch restaurants:', err);
      setError(err.message || 'Kunde inte ladda restauranger');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nagot gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Tillbaka till Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Restauranger</h1>
          <p className="text-muted-foreground mt-1">
            {filteredRestaurants.length} av {restaurants.length} restauranger
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchRestaurants}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-card rounded-lg p-4 border border-border">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">Sok</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sok namn, stad, org.nr..."
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-foreground mb-1">Aktivitet</label>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">Alla</option>
              <option value="HAS_ORDERS">Har ordrar</option>
              <option value="NO_ORDERS">Inga ordrar</option>
              <option value="HAS_REQUESTS">Har forfragningar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Restaurants Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <SortableHeader column="name" label="Namn" className="text-left" />
                <SortableHeader column="city" label="Stad" className="text-left" />
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">Org.nr</th>
                <SortableHeader column="users" label="Anvandare" className="text-right" />
                <SortableHeader column="requests" label="Forfragningar" className="text-right" />
                <SortableHeader column="orders" label="Ordrar" className="text-right" />
                <SortableHeader column="createdAt" label="Registrerad" className="text-left" />
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Inga restauranger hittades</p>
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <tr
                    key={restaurant.id}
                    className="hover:bg-accent transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{restaurant.name}</div>
                      {restaurant.address && (
                        <div className="text-xs text-muted-foreground">{restaurant.address}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {restaurant.city || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                      {restaurant.orgNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-foreground">
                      {restaurant.stats.userCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-foreground">{restaurant.stats.totalRequests}</div>
                      {restaurant.stats.openRequests > 0 && (
                        <div className="text-xs text-green-600">{restaurant.stats.openRequests} oppna</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium text-foreground">{restaurant.stats.totalOrders}</div>
                      {restaurant.stats.pendingOrders > 0 && (
                        <div className="text-xs text-amber-600">{restaurant.stats.pendingOrders} pagaende</div>
                      )}
                      {restaurant.stats.deliveredOrders > 0 && (
                        <div className="text-xs text-green-600">{restaurant.stats.deliveredOrders} levererade</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(restaurant.createdAt).toLocaleDateString('sv-SE')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
