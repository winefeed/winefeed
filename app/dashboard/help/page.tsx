'use client';

/**
 * RESTAURANT HELP PAGE
 *
 * FAQ and support contact for restaurants
 */

import {
  HelpCircle,
  FileText,
  Mail,
  Package,
  CreditCard,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: 'Förfrågningar',
    question: 'Hur skapar jag en förfrågan?',
    answer: 'Klicka på "Ny förfrågan" i menyn. Beskriv vilken typ av vin du söker, önskad kvantitet, budget och leveransdatum. Ju mer detaljer du ger, desto bättre förslag får du från leverantörerna.',
  },
  {
    category: 'Förfrågningar',
    question: 'Hur många leverantörer får min förfrågan?',
    answer: 'Winefeed matchar din förfrågan mot lämpliga leverantörer baserat på deras sortiment. Vanligtvis skickas förfrågan till 3-10 relevanta leverantörer.',
  },
  {
    category: 'Offerter',
    question: 'Hur jämför jag offerter?',
    answer: 'Gå till "Inkomna offerter" för att se alla offerter du fått. Du kan jämföra priser, leveranstider och villkor sida vid sida innan du accepterar.',
  },
  {
    category: 'Offerter',
    question: 'Kan jag förhandla på en offert?',
    answer: 'Just nu stöder inte plattformen förhandling direkt. Men du kan avböja en offert och skapa en ny förfrågan med justerade krav.',
  },
  {
    category: 'Ordrar',
    question: 'Vad händer när jag accepterar en offert?',
    answer: 'När du accepterar skapas en order automatiskt. Leverantören får en notifikation och bekräftar ordern. Du kan följa leveransstatus under "Ordrar".',
  },
  {
    category: 'Ordrar',
    question: 'Kan jag avbryta en order?',
    answer: 'Kontakta Winefeed support så snart som möjligt om du behöver avbryta. Möjligheten att avbryta beror på hur långt leverantören kommit i processen.',
  },
  {
    category: 'Betalning',
    question: 'Hur fungerar betalningen?',
    answer: 'Betalning sker direkt till leverantören enligt deras betalningsvillkor. Winefeed hanterar inte betalningar mellan er.',
  },
  {
    category: 'Konto',
    question: 'Hur ändrar jag mina leveransadresser?',
    answer: 'Gå till "Inställningar" i menyn för att lägga till, redigera eller ta bort leveransadresser.',
  },
];

export default function HelpPage() {
  const [openItem, setOpenItem] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(FAQ_ITEMS.map(item => item.category))];

  const filteredItems = selectedCategory === 'all'
    ? FAQ_ITEMS
    : FAQ_ITEMS.filter(item => item.category === selectedCategory);

  const categoryIcons: Record<string, React.ElementType> = {
    'Förfrågningar': FileText,
    'Offerter': Mail,
    'Ordrar': Package,
    'Betalning': CreditCard,
    'Konto': HelpCircle,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Hjälp & Support</h1>
        <p className="text-gray-500 mt-1">
          Vanliga frågor och kontaktinformation
        </p>
      </div>

      {/* Contact Card */}
      <div className="bg-gradient-to-br from-[#7B1E1E] to-[#5B1616] rounded-xl p-6 text-white mb-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-2">Behöver du personlig hjälp?</h2>
            <p className="text-white/80 mb-4">
              Vårt supportteam hjälper dig gärna med frågor om plattformen.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:support@winefeed.se"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#7B1E1E] rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
              >
                <Mail className="h-4 w-4" />
                support@winefeed.se
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Vanliga frågor
          </h2>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#7B1E1E] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Alla
            </button>
            {categories.filter(c => c !== 'all').map((category) => {
              const Icon = categoryIcons[category] || HelpCircle;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedCategory === category
                      ? 'bg-[#7B1E1E] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ Items */}
        <div className="divide-y divide-gray-100">
          {filteredItems.map((item, index) => (
            <div key={index}>
              <button
                onClick={() => setOpenItem(openItem === index ? null : index)}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                  <span className="font-medium text-gray-900">{item.question}</span>
                </div>
                {openItem === index ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {openItem === index && (
                <div className="px-4 pb-4">
                  <p className="text-gray-600 pl-[72px]">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink
          title="Skapa förfrågan"
          description="Börja här för att hitta vin"
          href="/dashboard/new-request"
          icon={FileText}
        />
        <QuickLink
          title="Mina ordrar"
          description="Se leveransstatus"
          href="/dashboard/orders"
          icon={Package}
        />
        <QuickLink
          title="Inställningar"
          description="Hantera ditt konto"
          href="/dashboard/settings"
          icon={HelpCircle}
        />
      </div>
    </div>
  );
}

interface QuickLinkProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

function QuickLink({ title, description, href, icon: Icon }: QuickLinkProps) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-[#7B1E1E] hover:bg-red-50 transition-colors"
    >
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </a>
  );
}
