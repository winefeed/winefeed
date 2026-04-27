/**
 * RESTAURANT SIGNUP PAGE
 *
 * Simplified single-step registration for restaurants.
 * Org number is optional — required at first order instead.
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { Building2, MapPin, Mail, Lock, Loader2, FileCheck } from 'lucide-react';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';
import {
  EditorialFormPage,
  EditorialFormShell,
  EditorialField,
  EditorialInput,
  EditorialPrimaryButton,
  EditorialInlineLink,
  EditorialFormError,
  EditorialDivider,
} from '@/components/landing/EditorialForm';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [licenseMunicipality, setLicenseMunicipality] = useState('');
  const [licenseCaseNumber, setLicenseCaseNumber] = useState('');
  const [licenseAttested, setLicenseAttested] = useState(false);

  const formatOrgNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 6) return digits;
    return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
  };

  const handleOrgNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrgNumber(formatOrgNumber(e.target.value));
  };

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
    if (orgNumber && orgNumber.length > 0 && orgNumber.length < 11) {
      setError('Organisationsnummer måste vara i format XXXXXX-XXXX');
      return;
    }
    if (!licenseAttested) {
      setError('Du måste intyga att restaurangen har giltigt serveringstillstånd');
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
          license_municipality: licenseMunicipality || null,
          license_case_number: licenseCaseNumber || null,
          license_attested: licenseAttested,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registreringen misslyckades');
      }

      window.location.href = data.redirect_path || '/dashboard/new-request';
    } catch (err) {
      setError(getErrorMessage(err, 'Ett fel uppstod'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <EditorialFormPage>
      <EditorialHeader />

      <EditorialFormShell
        eyebrow="Registrering"
        title="Skapa restaurangkonto"
        subtitle="Endast för restauranger, hotell och vinbarer. Kom igång på under en minut — vi godkänner manuellt."
        footer={
          <>
            Har du redan ett konto?{' '}
            <EditorialInlineLink href="/login">Logga in</EditorialInlineLink>
          </>
        }
      >
        <form onSubmit={handleSignup}>
          <EditorialFormError message={error} />

          <EditorialField label="Restaurangens namn" htmlFor="name">
            <EditorialInput
              id="name"
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
              autoFocus
              placeholder="T.ex. Restaurang Solsidan"
            />
          </EditorialField>

          <EditorialField label="Stad" htmlFor="city">
            <EditorialInput
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="Stockholm"
              leadingIcon={<MapPin className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialDivider label="Inloggningsuppgifter" />

          <EditorialField label="E-postadress" htmlFor="email">
            <EditorialInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="din@email.se"
              leadingIcon={<Mail className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialField label="Lösenord" htmlFor="password">
            <EditorialInput
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minst 8 tecken"
              leadingIcon={<Lock className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialField
            label="Organisationsnummer"
            htmlFor="org_number"
            hint="Krävs för att lägga beställningar. Kan läggas till senare."
          >
            <EditorialInput
              id="org_number"
              type="text"
              value={orgNumber}
              onChange={handleOrgNumberChange}
              maxLength={11}
              placeholder="XXXXXX-XXXX (valfritt)"
              leadingIcon={<Building2 className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialDivider label="Serveringstillstånd" />

          <EditorialField
            label="Kommun där tillståndet är utfärdat"
            htmlFor="license_municipality"
            hint="Valfritt — kan läggas till senare."
          >
            <EditorialInput
              id="license_municipality"
              type="text"
              value={licenseMunicipality}
              onChange={(e) => setLicenseMunicipality(e.target.value)}
              placeholder="t.ex. Stockholm"
            />
          </EditorialField>

          <EditorialField
            label="Diarienummer"
            htmlFor="license_case_number"
            hint="Finns på kommunens beslut. Krävs innan du kan skicka förfrågningar."
          >
            <EditorialInput
              id="license_case_number"
              type="text"
              value={licenseCaseNumber}
              onChange={(e) => setLicenseCaseNumber(e.target.value)}
              placeholder="t.ex. SÄR 2024/1234"
            />
          </EditorialField>

          {/* Attestation — Riesling-tonad varningsruta enligt brand-profilen */}
          <div className="flex items-start gap-3 rounded-[10px] bg-[#f2e2b6]/60 border border-[#f2e2b6] p-3.5 mb-5">
            <input
              id="license_attested"
              type="checkbox"
              checked={licenseAttested}
              onChange={(e) => setLicenseAttested(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 rounded border-[#722F37]/30 text-[#722F37] focus:ring-[#722F37]"
            />
            <label htmlFor="license_attested" className="text-sm text-[#161412] leading-snug cursor-pointer">
              <span className="flex items-center gap-1.5 font-medium mb-1">
                <FileCheck className="h-4 w-4 text-[#722F37]" />
                Jag intygar att restaurangen har giltigt serveringstillstånd
              </span>
              <span className="text-xs text-[#828181]">
                enligt alkohollagen (2010:1622) 8 kap. Felaktigt intygande är straffbart.
              </span>
            </label>
          </div>

          <EditorialPrimaryButton type="submit" disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Skapar konto…
              </>
            ) : (
              'Skapa konto'
            )}
          </EditorialPrimaryButton>
        </form>
      </EditorialFormShell>

      <EditorialFooter />
    </EditorialFormPage>
  );
}
