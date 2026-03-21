'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DEPRECATED: Old supplier requests page.
 * Redirects to /supplier/requests which is the current version.
 */
export default function DeprecatedRequestsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/supplier/requests');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Omdirigerar...</p>
    </div>
  );
}
