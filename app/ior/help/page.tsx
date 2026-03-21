'use client';

/**
 * IOR HELP PAGE
 * FAQ and support contact for IOR (importers/operators)
 */

import {
  HelpCircle,
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Upload,
  FileText,
  DollarSign,
  Package,
} from 'lucide-react';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: 'Producenter',
    question: 'Hur lägger jag till en producent?',
    answer: 'Gå till "Producenter" i menyn och klicka på "Lägg till producent". Fyll i producentens namn, land, region och kontaktuppgifter. Producenten kopplas automatiskt till ditt konto och du kan sedan lägga till viner under denna producent.',
  },
  {
    category: 'Producenter',
    question: 'Kan jag redigera en producent i efterhand?',
    answer: 'Ja, klicka på producenten i listan och välj "Redigera". Du kan uppdatera all information inklusive kontaktuppgifter, region och beskrivning.',
  },
  {
    category: 'Katalog',
    question: 'Hur importerar jag en katalog?',
    answer: 'Under "Katalog" kan du lägga till viner manuellt eller importera via CSV/Excel. Klicka på "Importera" och ladda upp din fil. Se till att kolumnerna matchar formatet (vinnamn, producent, druva, årgång, pris). Kontakta support om du behöver hjälp med filformatet.',
  },
  {
    category: 'Katalog',
    question: 'Hur uppdaterar jag priser i katalogen?',
    answer: 'Du kan uppdatera priser direkt i vinlistan genom att klicka på priset för respektive vin. Du kan också göra en ny import med uppdaterade priser - befintliga viner matchas automatiskt och priserna uppdateras.',
  },
  {
    category: 'Ärenden',
    question: 'Hur skapar jag ett ärende?',
    answer: 'Ärenden skapas automatiskt när en restaurang skickar en förfrågan som matchar ditt sortiment. Du ser inkommande ärenden under "Ärenden" i menyn. Därifrån kan du granska förfrågan, skapa en offert och följa upp.',
  },
  {
    category: 'Ärenden',
    question: 'Hur svarar jag på en förfrågan?',
    answer: 'Öppna ärendet och klicka "Skapa offert". Välj vilka viner du vill offerera, ange pris och kvantitet. Du kan lägga till flera viner i samma offert. När du är nöjd klickar du "Skicka offert" - restaurangen får då ett mejl med din offert.',
  },
  {
    category: 'Prislistor',
    question: 'Hur fungerar prislistor?',
    answer: 'Prislistor kopplas till dina viner och bestämmer vilka priser som visas för restauranger. Du kan ha olika prislistor för olika kundsegment eller regioner. Standardprislistan används om ingen specifik prislista finns.',
  },
  {
    category: 'Prislistor',
    question: 'Kan jag ha olika priser för olika kunder?',
    answer: 'Ja, du kan skapa separata prislistor och koppla dem till specifika kundgrupper. Kontakta support om du behöver hjälp att sätta upp kundspecifika prislistor.',
  },
  {
    category: 'Ordrar',
    question: 'Hur hanterar jag ordrar?',
    answer: 'När en restaurang accepterar din offert skapas en order automatiskt. Du ser den under "Ordrar" i menyn. Bekräfta ordern, uppdatera leveransstatus och markera som levererad när vinet nått kunden.',
  },
  {
    category: 'Ordrar',
    question: 'Vad händer om jag inte kan leverera?',
    answer: 'Kontakta restaurangen direkt via plattformen och informera om situationen. Du kan föreslå alternativa viner eller nya leveransdatum. Kontakta även support@winefeed.se om du behöver hjälp.',
  },
];

export default function IORHelpPage() {
  const [openItem, setOpenItem] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(FAQ_ITEMS.map(item => item.category))];

  const filteredItems = selectedCategory === 'all'
    ? FAQ_ITEMS
    : FAQ_ITEMS.filter(item => item.category === selectedCategory);

  const categoryIcons: Record<string, React.ElementType> = {
    'Producenter': Users,
    'Katalog': Upload,
    'Ärenden': FileText,
    'Prislistor': DollarSign,
    'Ordrar': Package,
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
      <div className="bg-gradient-to-br from-wine to-wine-hover rounded-xl p-6 text-white mb-8">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-wine rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
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
                  ? 'bg-wine text-white'
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
                      ? 'bg-wine text-white'
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
                  <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
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
    </div>
  );
}
