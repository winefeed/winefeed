'use client';

/**
 * PORTAL SELECTOR PAGE
 *
 * Shows available portals based on user's roles.
 * Used when a user has multiple roles (e.g., both SELLER and IOR).
 */

import { useEffect, useState } from 'react';
import {
  Wine,
  Building2,
  Truck,
  Shield,
  ArrowRight,
  Loader2,
  LogOut
} from 'lucide-react';

interface RoleInfo {
  role: string;
  label: string;
  path: string;
  entityId?: string;
  entityName?: string;
}

interface SessionData {
  user: {
    id: string;
    email: string;
  };
  roles: RoleInfo[];
}

const roleIcons: Record<string, typeof Wine> = {
  ADMIN: Shield,
  SELLER: Wine,
  IOR: Truck,
  RESTAURANT: Building2,
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-500',
  SELLER: 'bg-primary',
  IOR: 'bg-blue-500',
  RESTAURANT: 'bg-green-500',
};

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Hantera användare, leverantörer och systemkonfiguration',
  SELLER: 'Hantera dina viner och ta emot förfrågningar',
  IOR: 'Hantera importer och orderflöden till Sverige',
  RESTAURANT: 'Sök viner och skicka förfrågningar till leverantörer',
};

export default function PortalSelectPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have session data in localStorage (set after login)
    const storedSession = localStorage.getItem('winefeed_login_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setSession(parsed);
      } catch {
        setError('Kunde inte läsa sessiondata');
      }
    } else {
      // No session data - redirect to login
      window.location.href = '/login';
      return;
    }
    setLoading(false);
  }, []);

  function handleSelectPortal(path: string) {
    // Clear the temporary session storage
    localStorage.removeItem('winefeed_login_session');
    // Navigate to selected portal
    window.location.href = path;
  }

  function handleLogout() {
    localStorage.removeItem('winefeed_login_session');
    // Clear cookies by calling logout endpoint
    fetch('/api/auth/logout', { method: 'POST' })
      .finally(() => {
        window.location.href = '/login';
      });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Ingen session hittades'}</p>
          <a href="/login" className="text-primary hover:underline">
            Gå till inloggning
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              <Wine className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Välkommen, {session.user.email}
          </h1>
          <p className="mt-2 text-gray-600">
            Du har åtkomst till flera portaler. Välj vilken du vill öppna.
          </p>
        </div>

        {/* Portal Cards */}
        <div className="space-y-4">
          {session.roles.map((roleInfo) => {
            const Icon = roleIcons[roleInfo.role] || Wine;
            const colorClass = roleColors[roleInfo.role] || 'bg-gray-500';

            return (
              <button
                key={roleInfo.role}
                onClick={() => handleSelectPortal(roleInfo.path)}
                className="w-full bg-white rounded-xl border border-gray-200 p-6 hover:border-primary hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {roleInfo.label}
                      </h2>
                      {roleInfo.entityName && (
                        <span className="text-sm text-gray-500">
                          – {roleInfo.entityName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {roleDescriptions[roleInfo.role]}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <div className="mt-8 text-center">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </button>
        </div>
      </div>
    </div>
  );
}
