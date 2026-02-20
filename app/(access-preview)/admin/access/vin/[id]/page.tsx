/**
 * VINKOLL ACCESS - Wine Detail (Server Component)
 *
 * /admin/access/vin/[id]
 *
 * SSR with generateMetadata for SEO + JSON-LD Product schema.
 * Interactive lots/request form in separate client component.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, MapPin, Grape, Wine, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getWineById } from '@/lib/access-service';
import type { WineDetail } from '@/lib/access-types';
import LotsSection from './lots-section';

// ============================================================================
// Metadata
// ============================================================================

const WINE_TYPE_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rose: 'Rosé',
  sparkling: 'Mousserande',
  orange: 'Orange',
  fortified: 'Starkvin',
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const wine = await getWineById(id);

  if (!wine) {
    return { title: 'Vin ej funnet | Vinkoll Access' };
  }

  const title = [
    wine.name,
    wine.vintage,
    wine.producer.name,
  ].filter(Boolean).join(' — ');

  const description = [
    WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type,
    wine.grape,
    wine.region,
    wine.country,
  ].filter(Boolean).join(' | ') + '. Privatimportera via Vinkoll Access.';

  return {
    title: `${title} | Vinkoll Access`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(wine.image_url ? { images: [{ url: wine.image_url, width: 600, height: 800, alt: wine.name }] } : {}),
    },
  };
}

// ============================================================================
// JSON-LD Structured Data
// ============================================================================

function buildProductJsonLd(wine: WineDetail): object {
  const offers = wine.lots
    .filter(l => l.price_sek)
    .map(l => ({
      '@type': 'Offer',
      price: l.price_sek,
      priceCurrency: 'SEK',
      availability: 'https://schema.org/InStock',
      seller: l.importer ? { '@type': 'Organization', name: l.importer.name } : undefined,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: [wine.name, wine.vintage].filter(Boolean).join(' '),
    description: wine.description || `${WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type} vin från ${wine.producer.name}, ${wine.region || wine.country}`,
    image: wine.image_url || undefined,
    brand: {
      '@type': 'Organization',
      name: wine.producer.name,
    },
    category: 'Wine',
    additionalProperty: [
      wine.grape ? { '@type': 'PropertyValue', name: 'Druva', value: wine.grape } : null,
      wine.region ? { '@type': 'PropertyValue', name: 'Region', value: wine.region } : null,
      wine.country ? { '@type': 'PropertyValue', name: 'Land', value: wine.country } : null,
      wine.vintage ? { '@type': 'PropertyValue', name: 'Årgång', value: String(wine.vintage) } : null,
      wine.wine_type ? { '@type': 'PropertyValue', name: 'Typ', value: WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type } : null,
    ].filter(Boolean),
    ...(offers.length > 0 ? { offers: offers.length === 1 ? offers[0] : { '@type': 'AggregateOffer', lowPrice: Math.min(...offers.map(o => o.price!)), highPrice: Math.max(...offers.map(o => o.price!)), priceCurrency: 'SEK', offerCount: offers.length, offers } } : {}),
  };
}

function buildBreadcrumbJsonLd(wine: WineDetail): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Vinkoll Access', item: 'https://event.vinkoll.se/access' },
      { '@type': 'ListItem', position: 2, name: 'Viner', item: 'https://event.vinkoll.se/access/viner' },
      { '@type': 'ListItem', position: 3, name: [wine.name, wine.vintage].filter(Boolean).join(' ') },
    ],
  };
}

// ============================================================================
// Sommelier (server-side, no state needed)
// ============================================================================

const GRAPE_DESCRIPTIONS: Record<string, string> = {
  'merlot': 'sammetslen med toner av mörka körsbär, plommon och en antydan av choklad',
  'cabernet sauvignon': 'kraftfull med svarta vinbär, cederträ och fast tannin',
  'pinot noir': 'elegant med röda bär, kryddiga undertoner och silkig finish',
  'chardonnay': 'fyllig med citrus, smör och subtil ekkaraktär',
  'syrah': 'intensiv med blåbär, svartpeppar och rökiga inslag',
  'grenache': 'generös med röda frukter, örter och värme',
  'sangiovese': 'livlig med körsbär, tomat och kryddiga noter',
  'nebbiolo': 'komplex med rosor, tjära, körsbär och kraftfull tannin',
  'riesling': 'spänstigt med citrus, stenfrukt och mineralisk elegans',
  'sauvignon blanc': 'fräsch med gröna äpplen, krusbär och örter',
};

const REGION_PAIRINGS: Record<string, string[]> = {
  'bordeaux': ['Entrecote med rödvinssås', 'Grillat lamm med rosmarin', 'Lagrad ost som Comté'],
  'bourgogne': ['Coq au vin', 'Grillad kalvfilé', 'Brie de Meaux'],
  'beaujolais': ['Charkuteribricka', 'Grillad kyckling', 'Lättare pastarätter'],
  'rhône': ['Gryta på vilt', 'Provensalsk lammgryta', 'Kryddiga korvar'],
  'languedoc': ['Cassoulet', 'Grillat fläskkött', 'Medelhavsinspirerade grönsaker'],
  'alsace': ['Choucroute garnie', 'Asiatisk mat', 'Münsterost'],
  'toscana': ['Bistecca alla fiorentina', 'Pasta med vildsvinssås', 'Pecorino'],
  'piemonte': ['Tryffelrisotto', 'Braserat kött', 'Tajarin med smörsås'],
  'rioja': ['Grillat lamm', 'Manchego', 'Tapas med iberisk skinka'],
};

function getSommelierNote(wine: WineDetail): { description: string; pairings: string[] } {
  const grape = wine.grape?.toLowerCase() || '';
  const region = wine.region?.toLowerCase() || '';
  const isAged = wine.vintage && wine.vintage < 2010;

  let desc = '';
  const grapeKey = Object.keys(GRAPE_DESCRIPTIONS).find(g => grape.includes(g));
  const grapeDesc = grapeKey ? GRAPE_DESCRIPTIONS[grapeKey] : 'komplex och välbalanserad';

  if (isAged && wine.vintage) {
    const decades = Math.floor((new Date().getFullYear() - wine.vintage) / 10);
    const decadeWords: Record<number, string> = { 1: 'ett', 2: 'två', 3: 'tre', 4: 'fyra', 5: 'fem', 6: 'sex', 7: 'sju', 8: 'åtta', 9: 'nio' };
    const ageWord = decades >= 2 ? `${decadeWords[decades] || decades} decenniers` : `${new Date().getFullYear() - wine.vintage} års`;
    desc = `${ageWord} lagring har gett detta vin en djup, komplex karaktär. `;
    desc += `${grapeDesc.charAt(0).toUpperCase() + grapeDesc.slice(1)} — tanninerna har mjuknat och lämnat plats för en harmonisk elegans med lång eftersmak.`;
  } else {
    desc = `${grapeDesc.charAt(0).toUpperCase() + grapeDesc.slice(1)}. `;
    desc += 'Välgjort med fin balans och personlighet.';
  }

  if (wine.appellation && wine.appellation !== wine.region) {
    desc += ` Från ${wine.appellation} — en av ${wine.region || 'regionens'} mest ansedda appellationer.`;
  }

  const regionKey = Object.keys(REGION_PAIRINGS).find(r => region.includes(r));
  const pairings = regionKey ? REGION_PAIRINGS[regionKey] : [
    'Grillat rött kött', 'Lagrad hårdost', 'Viltgryta',
  ];

  return { description: desc, pairings };
}

// ============================================================================
// Page Component (Server)
// ============================================================================

export default async function WineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wine = await getWineById(id);

  if (!wine) {
    notFound();
  }

  const { description: sommelierDesc, pairings } = getSommelierNote(wine);
  const productJsonLd = buildProductJsonLd(wine);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(wine);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link href="/admin/access/viner" className="hover:text-foreground transition-colors">
            Viner
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium truncate">{wine.name}</span>
        </nav>

        {/* Wine info */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <div className="flex gap-6">
            {/* Wine image */}
            <div className="shrink-0 w-32 md:w-40">
              {wine.image_url ? (
                <img
                  src={wine.image_url}
                  alt={`${wine.name} ${wine.vintage || ''} — ${wine.producer.name}`}
                  className="w-full h-auto rounded-lg object-contain max-h-56"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-gradient-to-b from-[#722F37]/10 to-[#722F37]/5 rounded-lg flex items-center justify-center">
                  <Wine className="h-12 w-12 text-[#722F37]/30" />
                </div>
              )}
            </div>

            {/* Wine details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                    wine.wine_type === 'red' ? 'bg-red-100 text-red-800' :
                    wine.wine_type === 'white' ? 'bg-amber-100 text-amber-800' :
                    wine.wine_type === 'rose' ? 'bg-pink-100 text-pink-800' :
                    wine.wine_type === 'sparkling' ? 'bg-yellow-100 text-yellow-800' :
                    wine.wine_type === 'orange' ? 'bg-orange-100 text-orange-800' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type}
                  </span>
                  <h1 className="text-2xl font-bold text-foreground">{wine.name}</h1>
                  <p className="text-lg text-muted-foreground mt-1">{wine.producer.name}</p>
                </div>
                {wine.vintage && (
                  <span className="px-4 py-1.5 rounded-lg bg-stone-800 text-white text-2xl font-bold tabular-nums">{wine.vintage}</span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {wine.grape && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Grape className="h-3 w-3" /> Druva
                    </p>
                    <p className="text-sm font-medium text-foreground">{wine.grape}</p>
                  </div>
                )}
                {wine.region && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Region
                    </p>
                    <p className="text-sm font-medium text-foreground">{wine.region}</p>
                  </div>
                )}
                {wine.country && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Land</p>
                    <p className="text-sm font-medium text-foreground">{wine.country}</p>
                  </div>
                )}
                {wine.price_sek && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pris</p>
                    <p className="text-sm font-medium text-foreground">{wine.price_sek} kr</p>
                  </div>
                )}
              </div>

              {wine.description && (
                <p className="text-muted-foreground mt-6 leading-relaxed">{wine.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sommelier box */}
        <div className="bg-gradient-to-br from-[#722F37]/5 to-[#722F37]/10 border border-[#722F37]/15 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#722F37]/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-[#722F37]" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Mer om vinet</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-5">{sommelierDesc}</p>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Passar till</h3>
            <div className="flex flex-wrap gap-2">
              {pairings.map((pairing) => (
                <span
                  key={pairing}
                  className="px-3 py-1.5 bg-white/70 border border-[#722F37]/10 rounded-full text-sm text-foreground"
                >
                  {pairing}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive lots section (client component) */}
        <LotsSection wineId={wine.id} lots={wine.lots} />

        {/* Producer info */}
        {wine.producer.description && (
          <div className="mt-8 bg-muted/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Om {wine.producer.name}</h2>
            <p className="text-muted-foreground leading-relaxed">{wine.producer.description}</p>
          </div>
        )}
      </div>
    </>
  );
}
