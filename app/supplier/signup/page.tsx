/**
 * SUPPLIER SIGNUP PAGE
 *
 * Public registration for swedish wine importers (SWEDISH_IMPORTER type).
 * Posts to /api/suppliers/onboard which creates supplier + auth user + supplier_users link
 * and sends a welcome email.
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { Building2, Mail, Lock, Loader2, Phone, Globe } from 'lucide-react';
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

export default function SupplierSignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [orgNumber, setOrgNumber] = useState('');

  const formatOrgNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 6) return digits;
    return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      setError('Ange företagsnamn');
      return;
    }
    if (!contactEmail.trim()) {
      setError('Ange en e-postadress');
      return;
    }
    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken');
      return;
    }
    if (orgNumber && orgNumber.length > 0 && orgNumber.length < 11) {
      setError('Organisationsnummer måste vara i format XXXXXX-XXXX');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/suppliers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contactEmail,
          password,
          supplierName,
          contactEmail,
          phone: phone || undefined,
          website: website || undefined,
          orgNumber: orgNumber || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registreringen misslyckades');
      }

      window.location.href = '/supplier/login?welcome=1';
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
        title="Skapa importörskonto"
        subtitle="För svenska vinimportörer. Gratis att lista sortimentet och ta emot förfrågningar — vi tar 4 % per accepterad offert (min 149 kr, max 1 995 kr per order). Faktureras månadsvis i efterskott."
        footer={
          <>
            Har du redan ett konto?{' '}
            <EditorialInlineLink href="/supplier/login">Logga in</EditorialInlineLink>
          </>
        }
      >
        <form onSubmit={handleSignup}>
          <EditorialFormError message={error} />

          <EditorialField label="Företagsnamn" htmlFor="supplier_name">
            <EditorialInput
              id="supplier_name"
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
              autoFocus
              placeholder="T.ex. Vinhuset Lindberg AB"
              leadingIcon={<Building2 className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialField
            label="Organisationsnummer"
            htmlFor="org_number"
            hint="Valfritt — kan läggas till senare i profilen."
          >
            <EditorialInput
              id="org_number"
              type="text"
              value={orgNumber}
              onChange={(e) => setOrgNumber(formatOrgNumber(e.target.value))}
              maxLength={11}
              placeholder="XXXXXX-XXXX"
            />
          </EditorialField>

          <EditorialField label="Telefon" htmlFor="phone" hint="Valfritt.">
            <EditorialInput
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+46 70 123 45 67"
              leadingIcon={<Phone className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialField label="Hemsida" htmlFor="website" hint="Valfritt.">
            <EditorialInput
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.dittforetag.se"
              leadingIcon={<Globe className="h-4 w-4" />}
            />
          </EditorialField>

          <EditorialDivider label="Inloggningsuppgifter" />

          <EditorialField
            label="E-postadress"
            htmlFor="email"
            hint="Används både som inloggning och kontaktadress för förfrågningar."
          >
            <EditorialInput
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              placeholder="namn@dittforetag.se"
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
