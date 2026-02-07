/**
 * VINKOLL ACCESS - Login Page
 *
 * /admin/access/login
 *
 * Email input → magic link sent → check inbox
 */

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === 'invalid_token' ? 'Länken har redan använts eller gått ut. Försök igen.' :
    errorParam === 'missing_token' ? 'Ogiltig länk.' :
    errorParam === 'verification_failed' ? 'Verifiering misslyckades. Försök igen.' :
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/access/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirect }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Något gick fel');
      }

      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-[#722F37]" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">Kolla din inkorg!</h1>
          <p className="text-muted-foreground mb-2">
            Vi har skickat en inloggningslänk till
          </p>
          <p className="font-medium text-foreground mb-6">{email}</p>
          <p className="text-sm text-muted-foreground">
            Länken är giltig i 30 minuter. Hittar du den inte? Kolla skräpposten.
          </p>
          <button
            onClick={() => { setSent(false); setError(null); }}
            className="mt-6 text-sm text-[#722F37] hover:underline"
          >
            Använda en annan e-postadress
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Logga in</h1>
          <p className="text-muted-foreground mt-2">
            Ange din e-postadress så skickar vi en inloggningslänk.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              E-postadress
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.se"
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#722F37] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-[#722F37] text-white py-3 rounded-lg font-medium hover:bg-[#5a252c] transition-colors disabled:opacity-50"
          >
            {loading ? 'Skickar...' : 'Skicka inloggningslänk'}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Inget konto behövs — vi skapar ett automatiskt.
        </p>
      </div>
    </div>
  );
}

export default function AccessLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
