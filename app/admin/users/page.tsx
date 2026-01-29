/**
 * ADMIN USERS DASHBOARD
 *
 * /admin/users
 *
 * Shows all users in the tenant with roles, linked entities, and status.
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, RefreshCw, ArrowLeft } from 'lucide-react';
import { useActor } from '@/lib/hooks/useActor';

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
  const { actor, loading: actorLoading } = useActor();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Access Denied: Admin privileges required');
        setLoading(false);
        return;
      }
      fetchUsers();
    }
  }, [actor, actorLoading]);

  useEffect(() => {
    let filtered = users;

    if (searchQuery) {
      filtered = filtered.filter((u) =>
        u.email_masked.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Denied: Admin privileges required');
        }
        throw new Error('Failed to fetch users');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setFilteredUsers(data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda användare'));
    } finally {
      setLoading(false);
    }
  };

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
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
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
          <h2 className="text-xl font-bold text-foreground mb-2">Något gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            ← Tillbaka till Admin
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
          <h1 className="text-2xl font-bold text-foreground">Användare</h1>
          <p className="text-muted-foreground mt-1">Hantera användare och roller</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-card rounded-lg p-4 border border-border">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">
              Sök (email)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök email..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-foreground mb-1">
              Roll
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">Alla roller</option>
              <option value="ADMIN">Admin</option>
              <option value="RESTAURANT">Restaurant</option>
              <option value="SELLER">Leverantör</option>
              <option value="IOR">IOR</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          Visar {filteredUsers.length} av {users.length} användare
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Roller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Länkade Entiteter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Skapad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Inga användare hittades
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/users/${user.user_id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {user.email_masked}
                      </div>
                      <div className="text-xs text-muted-foreground">
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
                      <div className="text-xs text-muted-foreground space-y-1">
                        {user.linked_entities.restaurant_id && (
                          <div>Restaurant: {user.linked_entities.restaurant_id.substring(0, 8)}...</div>
                        )}
                        {user.linked_entities.supplier_id && (
                          <div>Supplier: {user.linked_entities.supplier_id.substring(0, 8)}...</div>
                        )}
                        {user.linked_entities.importer_id && (
                          <div>Importer: {user.linked_entities.importer_id.substring(0, 8)}...</div>
                        )}
                        {!user.linked_entities.restaurant_id &&
                          !user.linked_entities.supplier_id &&
                          !user.linked_entities.importer_id && (
                            <div className="text-muted-foreground/50">—</div>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
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
                        className="text-primary hover:text-primary/80"
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
    </div>
  );
}
