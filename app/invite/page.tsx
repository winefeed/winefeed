/**
 * INVITE ACCEPTANCE PAGE - PILOT ONBOARDING 1.0
 *
 * /invite?token=...
 *
 * User accepts invite and creates account
 *
 * Flow:
 * 1. Extract token from URL
 * 2. Verify token (show invite details)
 * 3. Show form: password + name
 * 4. On submit: Accept invite (creates user)
 * 5. Redirect to login or dashboard
 */

'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils';

interface InviteDetails {
  is_valid: boolean;
  email?: string;  // Masked
  role?: 'RESTAURANT' | 'SUPPLIER';
  entity_name?: string;
  expires_at?: string;
  error?: string;
}

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const verifyInvite = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/invites/verify?token=${encodeURIComponent(token!)}`);
      const data = await response.json();

      if (!response.ok || !data.is_valid) {
        throw new Error(data.error || 'Invalid invite token');
      }

      setInviteDetails(data);
    } catch (err) {
      console.error('Failed to verify invite:', err);
      setError(getErrorMessage(err, 'Kunde inte verifiera inbjudan'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError('Missing invite token. Please check your email link.');
      setLoading(false);
      return;
    }

    verifyInvite();
  }, [token, verifyInvite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate passwords match
      if (password !== confirmPassword) {
        throw new Error('Lösenorden matchar inte');
      }

      if (password.length < 8) {
        throw new Error('Lösenordet måste vara minst 8 tecken');
      }

      // Accept invite
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password,
          name: name || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invite');
      }

      const data = await response.json();

      // Success - redirect to login page
      router.push(`/login?email=${encodeURIComponent(data.email)}&invited=true`);

    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError(getErrorMessage(err, 'Kunde inte acceptera inbjudan'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleText = (role: string) => {
    return role === 'RESTAURANT' ? 'Restaurang' : 'Leverantör';
  };

  const getRoleIcon = (role: string) => {
    return role === 'RESTAURANT' ? '🍽️' : '🚚';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Verifierar inbjudan...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <span className="text-6xl mb-4 block">❌</span>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Ogiltig inbjudan</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <p className="text-sm text-gray-500 mb-6">
              Detta kan bero på att inbjudan har använts, utgått, eller är ogiltig.
              Kontakta den som bjöd in dig för en ny inbjudan.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              → Gå till login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!inviteDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-8 text-center">
          <span className="text-6xl mb-4 block">🍷</span>
          <h1 className="text-2xl font-bold">Välkommen till Winefeed!</h1>
          <p className="text-sm text-white/80 mt-2">Du har blivit inbjuden</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Invite Details */}
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{inviteDetails.role && getRoleIcon(inviteDetails.role)}</span>
              <div>
                <p className="text-sm font-medium text-gray-600">Du bjuds in som</p>
                <p className="text-lg font-bold text-purple-700">
                  {inviteDetails.role && getRoleText(inviteDetails.role)}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Organisation:</span>
                <span className="font-medium">{inviteDetails.entity_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-mono text-xs">{inviteDetails.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Giltig till:</span>
                <span className="text-xs">{inviteDetails.expires_at && formatDate(inviteDetails.expires_at)}</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              ✗ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ditt namn (valfritt)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="För- och efternamn"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lösenord *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Minst 8 tecken"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bekräfta lösenord *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Upprepa lösenord"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !password || password !== confirmPassword}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? 'Skapar konto...' : '✓ Acceptera inbjudan'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Genom att acceptera inbjudan godkänner du Winefeeds användarvillkor.
          </p>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Laddar...</p>
        </div>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}
