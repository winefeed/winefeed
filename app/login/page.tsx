/**
 * UNIFIED LOGIN PAGE
 *
 * Main entry point for all users.
 * Uses the unified /api/auth/login which resolves roles via ActorService.
 *
 * Redirects based on user's roles:
 * - Single role: Direct redirect to that portal
 * - Multiple roles: Portal selector page
 * - Admin: Direct to admin portal
 */

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';
import {
  EditorialFormPage,
  EditorialFormShell,
  EditorialField,
  EditorialInput,
  EditorialPrimaryButton,
  EditorialSecondaryButton,
  EditorialInlineLink,
  EditorialFormError,
  EditorialDivider,
} from '@/components/landing/EditorialForm';

function LoginForm() {
  const searchParams = useSearchParams();
  const intendedRedirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Inloggningen misslyckades');
        return;
      }

      if (data.roles.length > 1) {
        localStorage.setItem(
          'winefeed_login_session',
          JSON.stringify({ user: data.user, roles: data.roles }),
        );
        window.location.href = '/portal-select';
      } else {
        const targetPath = intendedRedirect || data.redirectPath;
        window.location.href = targetPath;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EditorialFormPage>
      <EditorialHeader />

      <EditorialFormShell
        title="Logga in"
        subtitle="Logga in för att fortsätta. Endast för restauranger, importörer och adminstratörer."
        footer={
          <>
            Har du problem att logga in?{' '}
            <EditorialInlineLink href="mailto:hej@winefeed.se">Kontakta support</EditorialInlineLink>
          </>
        }
      >
        <form onSubmit={handleLogin}>
          <EditorialFormError message={error} />

          <EditorialField label="E-postadress" htmlFor="email">
            <EditorialInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.se"
              leadingIcon={<Mail className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialField label="Lösenord" htmlFor="password">
            <EditorialInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leadingIcon={<Lock className="h-4 w-4" />}
            />
          </EditorialField>

          <div className="flex justify-end mb-5">
            <EditorialInlineLink href="/forgot-password" className="text-sm">
              Glömt lösenord?
            </EditorialInlineLink>
          </div>

          <EditorialPrimaryButton type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loggar in…
              </>
            ) : (
              'Logga in'
            )}
          </EditorialPrimaryButton>
        </form>

        <EditorialDivider label="Ny restaurang?" />

        <a href="/signup" className="block">
          <EditorialSecondaryButton type="button">Skapa restaurangkonto</EditorialSecondaryButton>
        </a>
      </EditorialFormShell>

      <EditorialFooter />
    </EditorialFormPage>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbfaf7] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#722F37]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
