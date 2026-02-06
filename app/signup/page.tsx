/**
 * RESTAURANT SIGNUP PAGE
 *
 * Simplified single-step registration for restaurants.
 * Org number is optional - required at first order instead.
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { Wine, Building2, MapPin, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgNumber, setOrgNumber] = useState('');

  // Format org number as user types (XXXXXX-XXXX)
  const formatOrgNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 6) return digits;
    return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
  };

  const handleOrgNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatOrgNumber(e.target.value);
    setOrgNumber(formatted);
  };

  // Create account
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken');
      return;
    }

    if (!restaurantName.trim()) {
      setError('Ange restaurangens namn');
      return;
    }

    if (!city.trim()) {
      setError('Ange stad');
      return;
    }

    // Validate org number format if provided
    if (orgNumber && orgNumber.length > 0 && orgNumber.length < 11) {
      setError('Organisationsnummer måste vara i format XXXXXX-XXXX');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/restaurants/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          org_number: orgNumber || null,
          name: restaurantName,
          city,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registreringen misslyckades');
      }

      // Success - redirect to dashboard
      window.location.href = data.redirect_path || '/dashboard/new-request';
    } catch (err) {
      setError(getErrorMessage(err, 'Ett fel uppstod'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Logo & Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Wine className="h-7 w-7 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          Registrera restaurang
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Kom igång på under en minut
        </p>
      </div>

      {/* Form */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-200 sm:rounded-lg sm:px-10">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Restaurant name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Restaurangens namn
              </label>
              <input
                id="name"
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
                autoFocus
                className="mt-1 appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="T.ex. Restaurang Solsidan"
              />
            </div>

            {/* City */}
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                Stad
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Stockholm"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Inloggningsuppgifter</span>
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                E-postadress
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="din@email.se"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Lösenord
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Minst 8 tecken"
                />
              </div>
            </div>

            {/* Org number - optional */}
            <div className="pt-2">
              <label htmlFor="org_number" className="block text-sm font-medium text-gray-700">
                Organisationsnummer
                <span className="ml-2 text-xs font-normal text-gray-400">(valfritt)</span>
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="org_number"
                  type="text"
                  value={orgNumber}
                  onChange={handleOrgNumberChange}
                  maxLength={11}
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="XXXXXX-XXXX"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Krävs för att lägga beställningar. Kan läggas till senare.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Skapar konto...
                </>
              ) : (
                'Skapa konto'
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Har du redan ett konto?{' '}
              <a href="/login" className="font-medium text-primary hover:text-primary/80">
                Logga in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
