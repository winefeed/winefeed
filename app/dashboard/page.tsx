'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Dashboard Landing Page
 *
 * Redirects users to the appropriate sub-page based on their role:
 * - ADMIN -> /admin
 * - SELLER -> /supplier
 * - IOR -> /ior/orders
 * - RESTAURANT -> /dashboard/new-request
 */
export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveAndRedirect() {
      try {
        // Fetch actor info to determine role
        const response = await fetch('/api/me/actor');

        if (!response.ok) {
          throw new Error('Failed to fetch user info');
        }

        const data = await response.json();
        const roles = data.roles || [];

        // Redirect based on primary role (priority order)
        if (roles.includes('ADMIN')) {
          router.replace('/admin');
        } else if (roles.includes('IOR')) {
          router.replace('/ior/orders');
        } else if (roles.includes('SELLER')) {
          router.replace('/supplier');
        } else if (roles.includes('RESTAURANT')) {
          router.replace('/dashboard/overview');
        } else {
          // No recognized role - show error
          setError('Ditt konto har ingen behörighet. Kontakta administratören.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error resolving role:', err);
        // Fallback to restaurant dashboard
        router.replace('/dashboard/overview');
      }
    }

    resolveAndRedirect();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ingen behörighet</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Laddar...</p>
      </div>
    </div>
  );
}
