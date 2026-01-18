/**
 * ADMIN USERS DASHBOARD
 *
 * /admin/users
 *
 * Shows all users in the tenant with roles, linked entities, and status.
 *
 * Features:
 * - User table with search and filters
 * - Role badges
 * - Click to view user detail
 * - Admin-only access
 *
 * Access Control:
 * - Dev: ADMIN_MODE=true in .env.local
 * - Prod: Admin role required
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface User {
  user_id: string;
  email_masked: string;
  created_at: string;
  roles: string[];
  linked_entities: {
    restaurant_id?: string;
    supplier_id?: string;
    importer_id?: string;
  };
  status: 'active';
}

interface UsersResponse {
  users: User[];
  count: number;
  timestamp: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = users;

    // Search filter (email)
    if (searchQuery) {
      filtered = filtered.filter((u) =>
        u.email_masked.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter((u) => u.roles.includes(roleFilter));
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/users', {
        headers: {
          'x-tenant-id': TENANT_ID,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required. Set ADMIN_MODE=true in .env.local');
        }
        throw new Error('Failed to fetch users');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setFilteredUsers(data.users);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.message || 'Kunde inte ladda användare');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar användare...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">🚫</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/admin')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ← Tillbaka till Admin
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
              <span className="text-4xl">👥</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                <p className="text-sm text-white/80">Hantera användare och roller</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                ← Admin Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sök (email)
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Role Filter */}
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roll
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">Alla roller</option>
                <option value="ADMIN">Admin</option>
                <option value="RESTAURANT">Restaurant</option>
                <option value="SELLER">Leverantör</option>
                <option value="IOR">IOR</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-3 text-sm text-gray-600">
            Visar {filteredUsers.length} av {users.length} användare
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Länkade Entiteter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skapad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Åtgärder
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Inga användare hittades
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.user_id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/users/${user.user_id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.email_masked}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.user_id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getRoleBadgeColor(role)}`}
                            >
                              {getRoleLabel(role)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-600 space-y-1">
                          {user.linked_entities.restaurant_id && (
                            <div>🏪 Restaurant: {user.linked_entities.restaurant_id.substring(0, 8)}...</div>
                          )}
                          {user.linked_entities.supplier_id && (
                            <div>📦 Supplier: {user.linked_entities.supplier_id.substring(0, 8)}...</div>
                          )}
                          {user.linked_entities.importer_id && (
                            <div>🇪🇺 Importer: {user.linked_entities.importer_id.substring(0, 8)}...</div>
                          )}
                          {!user.linked_entities.restaurant_id &&
                            !user.linked_entities.supplier_id &&
                            !user.linked_entities.importer_id && (
                              <div className="text-gray-400">—</div>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/users/${user.user_id}`);
                          }}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Visa detaljer →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
