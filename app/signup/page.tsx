/**
 * RESTAURANT SIGNUP PAGE
 *
 * Public registration for restaurants.
 * Step 1: Enter org number → fetch company info
 * Step 2: Confirm details + create account
 */

'use client';

import { useState } from 'react';
import { Wine, Building2, MapPin, Mail, Lock, AlertCircle, Loader2, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface CompanyInfo {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  status: 'active' | 'inactive' | 'not_found';
}

type Step = 'org_number' | 'details';

export default function SignupPage() {
  const [step, setStep] = useState<Step>('org_number');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [orgNumber, setOrgNumber] = useState('');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  // Lookup company info from org number
  const handleOrgLookup = async () => {
    if (orgNumber.length < 11) {
      setError('Ange ett giltigt organisationsnummer (XXXXXX-XXXX)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/org-lookup?org_number=${encodeURIComponent(orgNumber)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte hitta företaget');
      }

      if (data.status === 'not_found') {
        // Allow manual entry
        setCompanyInfo(null);
        setRestaurantName('');
        setCity('');
        setStep('details');
      } else {
        setCompanyInfo(data);
        setRestaurantName(data.name || '');
        setCity(data.city || '');
        setStep('details');
      }
    } catch (err: any) {
      // On error, still allow manual entry
      setCompanyInfo(null);
      setRestaurantName('');
      setCity('');
      setStep('details');
    } finally {
      setLoading(false);
    }
  };

  // Create account
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte');
      return;
    }

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

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/restaurants/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          org_number: orgNumber,
          name: restaurantName,
          city,
          address_line1: companyInfo?.address || null,
          postal_code: companyInfo?.postalCode || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registreringen misslyckades');
      }

      // Success - redirect to dashboard
      window.location.href = data.redirect_path || '/dashboard/new-request';
    } catch (err: any) {
      setError(err.message || 'Ett fel uppstod');
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
          {step === 'org_number'
            ? 'Ange ditt organisationsnummer för att komma igång'
            : 'Bekräfta uppgifterna och skapa konto'}
        </p>
      </div>

      {/* Form */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-200 sm:rounded-lg sm:px-10">
          {/* Step 1: Org Number */}
          {step === 'org_number' && (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="org_number" className="block text-sm font-medium text-gray-700">
                  Organisationsnummer
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
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="XXXXXX-XXXX"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Vi hämtar företagsinfo automatiskt
                </p>
              </div>

              <button
                onClick={handleOrgLookup}
                disabled={loading || orgNumber.length < 11}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Hämtar...
                  </>
                ) : (
                  <>
                    Fortsätt
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 'details' && (
            <form onSubmit={handleSignup} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Company info found */}
              {companyInfo && companyInfo.status === 'active' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-800">Företag hittat</p>
                    <p className="text-green-700">{companyInfo.name}</p>
                  </div>
                </div>
              )}

              {/* Org number display */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Org.nr:</span>
                  <span className="text-sm font-medium">{orgNumber}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('org_number')}
                  className="text-sm text-primary hover:underline"
                >
                  Ändra
                </button>
              </div>

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
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Restaurangens namn"
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
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="Stockholm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Används för att förifylla leveransort i förfrågningar
                </p>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Kontouppgifter</span>
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
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
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
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="Minst 8 tecken"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Bekräfta lösenord
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="Upprepa lösenord"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('org_number')}
                  className="flex-1 flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Tillbaka
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>
            </form>
          )}

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
