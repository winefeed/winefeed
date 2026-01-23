/**
 * ADMIN INVITES PAGE - PILOT ONBOARDING 1.0
 *
 * /admin/invites
 *
 * Admin interface for managing user invites
 *
 * Features:
 * - Create new invites (form with email + role + entity dropdown)
 * - List recent invites with status (pending/used/expired)
 * - Copy invite link
 * - Resend invite email
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Note: This uses service role key, so only works server-side
// For production, move to API endpoint
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface Restaurant {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  namn: string;
}

interface Invite {
  id: string;
  email: string;
  role: 'RESTAURANT' | 'SUPPLIER';
  entity_name: string;
  status: 'pending' | 'used' | 'expired';
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export default function AdminInvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'RESTAURANT' | 'SUPPLIER'>('RESTAURANT');
  const [selectedEntityId, setSelectedEntityId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch invites
      const invitesResponse = await fetch('/api/admin/invites', {
        headers: {
          'x-tenant-id': TENANT_ID
        }
      });

      if (!invitesResponse.ok) {
        if (invitesResponse.status === 403) {
          throw new Error('Unauthorized: Admin access required. Set ADMIN_MODE=true in .env.local');
        }
        throw new Error('Failed to fetch invites');
      }

      const invitesData = await invitesResponse.json();
      setInvites(invitesData.invites || []);

      // Fetch restaurants and suppliers (direct Supabase for MVP)
      // In production, move this to API endpoints
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const [restaurantsRes, suppliersRes] = await Promise.all([
          supabase.from('restaurants').select('id, name').limit(100),
          supabase.from('suppliers').select('id, namn').limit(100)
        ]);

        setRestaurants(restaurantsRes.data || []);
        setSuppliers(suppliersRes.data || []);
      }

    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Kunde inte ladda data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const body: any = {
        email,
        role
      };

      if (role === 'RESTAURANT') {
        body.restaurant_id = selectedEntityId;
      } else {
        body.supplier_id = selectedEntityId;
      }

      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create invite');
      }

      const data = await response.json();

      setSuccess(`Invite sent to ${email}!`);
      setEmail('');
      setSelectedEntityId('');

      // Refresh invites list
      await fetchData();

    } catch (err: any) {
      console.error('Failed to create invite:', err);
      setError(err.message || 'Kunde inte skapa inbjudan');
    } finally {
      setSubmitting(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'used': return 'bg-green-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'RESTAURANT' ? '🍽️' : '🚚';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }

  if (error && invites.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-6xl mb-4 block">🚫</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ← Tillbaka till Dashboard
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
              <span className="text-4xl">📧</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">User Invites</h1>
                <p className="text-sm text-white/80">Bjud in restauranger och leverantörer</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => router.push('/admin/pilot')}
                className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-white/90 transition-colors text-sm font-medium"
              >
                ← Admin Console
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            ✗ {error}
          </div>
        )}

        {/* Create Invite Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Skapa ny inbjudan</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roll
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as 'RESTAURANT' | 'SUPPLIER');
                    setSelectedEntityId('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="RESTAURANT">🍽️ Restaurang</option>
                  <option value="SUPPLIER">🚚 Leverantör</option>
                </select>
              </div>

              {/* Entity (Restaurant or Supplier) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {role === 'RESTAURANT' ? 'Restaurang' : 'Leverantör'}
                </label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Välj...</option>
                  {role === 'RESTAURANT'
                    ? restaurants.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))
                    : suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.namn}</option>
                      ))
                  }
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email || !selectedEntityId}
              className="w-full md:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? 'Skickar...' : '📧 Skicka inbjudan'}
            </button>
          </form>
        </div>

        {/* Invites List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              Senaste inbjudningar ({invites.length})
            </h2>
          </div>

          {invites.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Inga inbjudningar ännu</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Roll</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Organisation</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Skapad</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Används</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{invite.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          {getRoleIcon(invite.role)}
                          <span className="text-xs">{invite.role}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">{invite.entity_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(invite.status)}`}>
                          {invite.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(invite.created_at)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {invite.used_at ? formatDate(invite.used_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
