'use client';

/**
 * CONTACT WINEFEED PAGE
 *
 * Contact information and support links
 * Uses mailto link with pre-filled context
 */

import { useEffect, useState } from 'react';
import { Mail, MessageSquare, FileQuestion, AlertTriangle, Clock } from 'lucide-react';

interface SupplierContext {
  supplierName: string;
  userEmail: string;
}

const SUPPORT_EMAIL = 'markus@esima.se';

export default function ContactPage() {
  const [context, setContext] = useState<SupplierContext | null>(null);

  useEffect(() => {
    async function fetchContext() {
      try {
        const res = await fetch('/api/supplier/profile');
        if (res.ok) {
          const data = await res.json();
          setContext({
            supplierName: data.supplierName,
            userEmail: data.userEmail,
          });
        }
      } catch {
        // Continue without context
      }
    }
    fetchContext();
  }, []);

  const buildMailtoLink = (subject: string, body: string) => {
    const supplierInfo = context
      ? `Leverantör: ${context.supplierName}\nEmail: ${context.userEmail}\n\n`
      : '';

    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(supplierInfo + body)}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Kontakta Winefeed</h1>
        <p className="text-gray-500 mt-1">
          Vi hjälper dig gärna med frågor och support
        </p>
      </div>

      {/* Contact Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-wine to-wine-active p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Mail className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Support via e-post</h2>
              <p className="text-white/80">Vi svarar vanligtvis inom 24 timmar</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <a
            href={buildMailtoLink(
              context ? `Support: ${context.supplierName}` : 'Support',
              'Hej,\n\nJag behöver hjälp med:\n\n'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-wine text-white px-6 py-3 rounded-lg font-medium hover:bg-wine-hover transition-colors"
          >
            <Mail className="h-5 w-5" />
            Skicka e-post till support
          </a>
          <p className="text-sm text-gray-500 mt-3">
            Öppnar din e-postklient med förifylld information
          </p>
        </div>
      </div>

      {/* Quick Topics */}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Vanliga ärenden</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <ContactTopic
          icon={FileQuestion}
          title="Teknisk fråga"
          description="Problem med inloggning, import, eller systemfel"
          href={buildMailtoLink(
            context ? `Teknisk fråga: ${context.supplierName}` : 'Teknisk fråga',
            'Hej,\n\nJag har en teknisk fråga:\n\nBeskrivning av problemet:\n\n\nSteg för att återskapa problemet:\n1. \n2. \n3. \n\n'
          )}
        />
        <ContactTopic
          icon={MessageSquare}
          title="Allmän fråga"
          description="Frågor om tjänsten, priser, eller samarbete"
          href={buildMailtoLink(
            context ? `Fråga: ${context.supplierName}` : 'Allmän fråga',
            'Hej,\n\nJag har en fråga:\n\n'
          )}
        />
        <ContactTopic
          icon={AlertTriangle}
          title="Rapportera fel"
          description="Något fungerar inte som det ska"
          href={buildMailtoLink(
            context ? `Felrapport: ${context.supplierName}` : 'Felrapport',
            'Hej,\n\nJag vill rapportera ett fel:\n\nVad hände:\n\n\nVad förväntade jag mig:\n\n\nNär hände det:\n\n'
          )}
        />
        <ContactTopic
          icon={Clock}
          title="Uppdatera uppgifter"
          description="Ändra företagsinfo, kontaktperson, etc."
          href={buildMailtoLink(
            context ? `Uppdatera uppgifter: ${context.supplierName}` : 'Uppdatera uppgifter',
            'Hej,\n\nJag vill uppdatera följande uppgifter:\n\nNuvarande:\n\nNytt:\n\n'
          )}
        />
      </div>

      {/* Direct Contact Info */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Direktkontakt
        </h3>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <Mail className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">E-post</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-wine hover:underline font-medium"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ContactTopicProps {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}

function ContactTopic({ icon: Icon, title, description, href }: ContactTopicProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div>
        <h4 className="font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </a>
  );
}
