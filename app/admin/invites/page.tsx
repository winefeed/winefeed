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

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useActor } from '@/lib/hooks/useActor';
import { RefreshCw, ArrowLeft, Mail, UtensilsCrossed, Truck, Send, CheckCircle2, XCircle, Ban } from 'lucide-react';

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
  const { actor, loading: actorLoading } = useActor();
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
    if (!actorLoading && actor) {
      if (!actor.roles.includes('ADMIN')) {
        setError('Unauthorized: Admin access required');
        setLoading(false);
        return;
      }
      fetchData();
    }
  }, [actor, actorLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch invites
      const invitesResponse = await fetch('/api/admin/invites', {
        credentials: 'include'
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

    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda data'));
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
      const body: Record<string, string | null> = {
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create invite');
      }

      const data = await response.json();

      setSuccess(`Inbjudan skickad till ${email}!`);
      setEmail('');
      setSelectedEntityId('');

      // Refresh invites list
      await fetchData();

    } catch (err) {
      console.error('Failed to create invite:', err);
      setError(getErrorMessage(err, 'Kunde inte skapa inbjudan'));
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

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'used':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'expired':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const RoleIcon = ({ role }: { role: string }) => {
    const Icon = role === 'RESTAURANT' ? UtensilsCrossed : Truck;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Laddar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && invites.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Ban className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Åtkomst nekad</h2>
          <p className="text-muted-foreground mb-5">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till Dashboard
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
          <h1 className="text-2xl font-bold text-foreground">Inbjudningar</h1>
          <p className="text-muted-foreground mt-1">Bjud in restauranger och leverantörer</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
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

      {/* Status messages */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-emerald-800">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 text-destructive">
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Create Invite Form */}
      <div className="mb-8 bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Skapa ny inbjudan</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="namn@exempel.se"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Roll</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as 'RESTAURANT' | 'SUPPLIER');
                  setSelectedEntityId('');
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="RESTAURANT">Restaurang</option>
                <option value="SUPPLIER">Leverantör</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {role === 'RESTAURANT' ? 'Restaurang' : 'Leverantör'}
              </label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Välj...</option>
                {role === 'RESTAURANT'
                  ? restaurants.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))
                  : suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.namn}</option>
                    ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !email || !selectedEntityId}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Skickar...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Skicka inbjudan
              </>
            )}
          </button>
        </form>
      </div>

      {/* Invites List */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Senaste inbjudningar ({invites.length})
          </h2>
        </div>

        {invites.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            Inga inbjudningar ännu
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Roll</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Organisation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Skapad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Använd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-accent/50">
                    <td className="px-6 py-3 font-mono text-xs text-foreground">{invite.email}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                        <RoleIcon role={invite.role} />
                        {invite.role === 'RESTAURANT' ? 'Restaurang' : 'Leverantör'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-foreground">{invite.entity_name}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(invite.status)}`}
                      >
                        {invite.status === 'pending' ? 'Väntar' : invite.status === 'used' ? 'Använd' : 'Utgången'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{formatDate(invite.created_at)}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {invite.used_at ? formatDate(invite.used_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
