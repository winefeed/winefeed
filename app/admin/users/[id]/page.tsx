/**
 * ADMIN USER DETAIL PAGE
 *
 * /admin/users/[id]
 *
 * Shows detailed information about a specific user including:
 * - User profile and roles
 * - Linked entities (restaurant, supplier, importer)
 * - Recent activity (requests, offers, orders)
 *
 * Access Control:
 * - Admin-only
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface UserDetail {
  user_id: string;
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
  status: 'active';
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
        headers: {
          'x-tenant-id': TENANT_ID,
        },
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
    } catch (err: any) {
      console.error('Failed to fetch user detail:', err);
      setError(err.message || 'Kunde inte ladda användardetaljer');
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
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RESTAURANT':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'SELLER':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'IOR':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar användardetaljer...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">🚫</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error || 'Användare hittades inte'}</p>
            <button
              onClick={() => router.push('/admin/users')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ← Tillbaka till Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">👤</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">User Detail</h1>
                <p className="text-sm text-white/80">{user.email_masked}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/users')}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              ← Tillbaka till Users
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* User Profile */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Profil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">User ID</p>
              <p className="text-sm text-gray-900 font-mono">{user.user_id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email (masked)</p>
              <p className="text-sm text-gray-900">{user.email_masked}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created At</p>
              <p className="text-sm text-gray-900">
                {new Date(user.created_at).toLocaleString('sv-SE')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                {user.status}
              </span>
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Roller</h2>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border ${getRoleBadgeColor(role)}`}
              >
                {getRoleLabel(role)}
              </span>
            ))}
          </div>
        </div>

        {/* Linked Entities */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Länkade Entiteter</h2>
          <div className="space-y-3">
            {user.linked_entities.restaurant_id && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-2xl">🏪</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.linked_entities.restaurant_name || 'Restaurant'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{user.linked_entities.restaurant_id}</p>
                </div>
              </div>
            )}
            {user.linked_entities.supplier_id && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-2xl">📦</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.linked_entities.supplier_name || 'Supplier'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{user.linked_entities.supplier_id}</p>
                </div>
              </div>
            )}
            {user.linked_entities.importer_id && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-2xl">🇪🇺</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.linked_entities.importer_name || 'Importer'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{user.linked_entities.importer_id}</p>
                </div>
              </div>
            )}
            {!user.linked_entities.restaurant_id &&
              !user.linked_entities.supplier_id &&
              !user.linked_entities.importer_id && (
                <p className="text-sm text-gray-500">Inga länkade entiteter</p>
              )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Senaste Aktivitet</h2>

          {/* Recent Requests */}
          {user.recent_activity.recent_requests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Requests</h3>
              <div className="space-y-2">
                {user.recent_activity.recent_requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {req.title || `Request ${req.id.substring(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(req.created_at).toLocaleString('sv-SE')}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Offers */}
          {user.recent_activity.recent_offers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Offers</h3>
              <div className="space-y-2">
                {user.recent_activity.recent_offers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {offer.title || `Offer ${offer.id.substring(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(offer.created_at).toLocaleString('sv-SE')}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(offer.status)}`}>
                      {offer.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {user.recent_activity.recent_orders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Orders</h3>
              <div className="space-y-2">
                {user.recent_activity.recent_orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Order {order.id.substring(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleString('sv-SE')}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user.recent_activity.recent_requests.length === 0 &&
            user.recent_activity.recent_offers.length === 0 &&
            user.recent_activity.recent_orders.length === 0 && (
              <p className="text-sm text-gray-500">Ingen nylig aktivitet</p>
            )}
        </div>
      </main>
    </div>
  );
}
