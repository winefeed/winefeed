/**
 * IOR PRODUCER WORKSPACE
 *
 * Tabbed workspace for managing a single producer:
 * - Översikt (Overview)
 * - Katalog (Products)
 * - Prissättning (Price Lists)
 * - Handelsvillkor (Trade Terms)
 * - Kommunikation (Cases)
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Wine,
  Mail,
  Phone,
  Globe,
  FileText,
  DollarSign,
  Handshake,
  MessageSquare,
  LayoutDashboard,
  Plus,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Producer {
  id: string;
  name: string;
  legalName?: string;
  country: string;
  region?: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  onboardedAt?: string;
  notes?: string;
}

interface ProducerStats {
  productCount: number;
  activeProducts: number;
  priceListCount: number;
  activePriceLists: number;
  openCasesCount: number;
  overdueCasesCount: number;
}

type TabId = 'overview' | 'catalog' | 'pricing' | 'terms' | 'communication';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Översikt', icon: LayoutDashboard },
  { id: 'catalog', label: 'Katalog', icon: Wine },
  { id: 'pricing', label: 'Prissättning', icon: DollarSign },
  { id: 'terms', label: 'Handelsvillkor', icon: Handshake },
  { id: 'communication', label: 'Kommunikation', icon: MessageSquare },
];

export default function ProducerWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const producerId = params.id as string;

  const [producer, setProducer] = useState<Producer | null>(null);
  const [stats, setStats] = useState<ProducerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTab = (searchParams.get('tab') as TabId) || 'overview';

  useEffect(() => {
    async function fetchProducer() {
      try {
        const response = await fetch(`/api/ior/producers/${producerId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Producenten hittades inte');
          }
          throw new Error('Kunde inte ladda producent');
        }
        const data = await response.json();
        setProducer(data.producer);
        setStats(data.stats);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    fetchProducer();
  }, [producerId]);

  const setActiveTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.replace(`/ior/producers/${producerId}?${params}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-gray-200 rounded-lg" />
              <div>
                <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !producer) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <p className="text-red-700 font-medium">{error || 'Något gick fel'}</p>
          <Link
            href="/ior/producers"
            className="inline-flex items-center gap-2 mt-4 text-wine hover:text-wine/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till producenter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Breadcrumb */}
      <div className="px-4 lg:px-6 mb-4">
        <Link
          href="/ior/producers"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till producenter
        </Link>
      </div>

      {/* Producer header */}
      <div className="px-4 lg:px-6 mb-6">
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="h-16 w-16 bg-gradient-to-br from-wine/5 to-wine/10 rounded-lg flex items-center justify-center flex-shrink-0">
              {producer.logoUrl ? (
                <img
                  src={producer.logoUrl}
                  alt={producer.name}
                  className="h-12 w-12 object-contain"
                />
              ) : (
                <Building2 className="h-8 w-8 text-wine/50" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-gray-900">
                  {producer.name}
                </h1>
                {!producer.isActive && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                    Inaktiv
                  </span>
                )}
                {stats && stats.overdueCasesCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    <AlertTriangle className="h-3 w-3" />
                    {stats.overdueCasesCount} försenade ärenden
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {producer.region
                    ? `${producer.region}, ${producer.country}`
                    : producer.country}
                </span>
                {producer.contactEmail && (
                  <a
                    href={`mailto:${producer.contactEmail}`}
                    className="flex items-center gap-1 hover:text-wine"
                  >
                    <Mail className="h-4 w-4" />
                    {producer.contactEmail}
                  </a>
                )}
                {producer.contactPhone && (
                  <a
                    href={`tel:${producer.contactPhone}`}
                    className="flex items-center gap-1 hover:text-wine"
                  >
                    <Phone className="h-4 w-4" />
                    {producer.contactPhone}
                  </a>
                )}
                {producer.websiteUrl && (
                  <a
                    href={producer.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-wine"
                  >
                    <Globe className="h-4 w-4" />
                    Webbplats
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick stats + action */}
            <div className="flex flex-col items-end gap-4">
              {/* New message button */}
              <Link
                href={`/ior/cases/new?producerId=${producerId}`}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-wine text-white font-medium text-sm',
                  'hover:bg-wine/90 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Nytt meddelande
              </Link>

              {/* Stats badges */}
              {stats && (
                <div className="hidden md:flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-gray-600">
                    <Wine className="h-3.5 w-3.5" />
                    {stats.productCount} produkter
                  </span>
                  {stats.openCasesCount > 0 && (
                    <span className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                      stats.overdueCasesCount > 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      {stats.openCasesCount} öppna
                      {stats.overdueCasesCount > 0 && (
                        <span className="font-medium">
                          ({stats.overdueCasesCount} försenade)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 lg:px-6 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-wine text-wine'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 lg:px-6">
        {activeTab === 'overview' && (
          <OverviewTab producer={producer} stats={stats} />
        )}
        {activeTab === 'catalog' && (
          <CatalogTab producerId={producerId} />
        )}
        {activeTab === 'pricing' && (
          <PricingTab producerId={producerId} />
        )}
        {activeTab === 'terms' && (
          <TradeTermsTab producerId={producerId} />
        )}
        {activeTab === 'communication' && (
          <CommunicationTab producerId={producerId} producerName={producer.name} />
        )}
      </div>
    </div>
  );
}

// Tab components (simplified for v1)

function OverviewTab({ producer, stats }: { producer: Producer; stats: ProducerStats | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contact info */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Kontaktuppgifter</h3>
        <dl className="space-y-3 text-sm">
          {producer.contactName && (
            <div>
              <dt className="text-gray-500">Kontaktperson</dt>
              <dd className="text-gray-900 mt-0.5">{producer.contactName}</dd>
            </div>
          )}
          {producer.contactEmail && (
            <div>
              <dt className="text-gray-500">E-post</dt>
              <dd className="text-gray-900 mt-0.5">
                <a href={`mailto:${producer.contactEmail}`} className="hover:text-wine">
                  {producer.contactEmail}
                </a>
              </dd>
            </div>
          )}
          {producer.contactPhone && (
            <div>
              <dt className="text-gray-500">Telefon</dt>
              <dd className="text-gray-900 mt-0.5">{producer.contactPhone}</dd>
            </div>
          )}
          {producer.legalName && (
            <div>
              <dt className="text-gray-500">Juridiskt namn</dt>
              <dd className="text-gray-900 mt-0.5">{producer.legalName}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Notes */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Anteckningar</h3>
        {producer.notes ? (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{producer.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">Inga anteckningar</p>
        )}
      </div>

      {/* Quick stats cards */}
      {stats && (
        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-wine/10 rounded-lg">
                <Wine className="h-5 w-5 text-wine" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats.productCount}</p>
                <p className="text-sm text-gray-500">Produkter</p>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats.activePriceLists}</p>
                <p className="text-sm text-gray-500">Aktiva prislistor</p>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats.openCasesCount}</p>
                <p className="text-sm text-gray-500">Öppna ärenden</p>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats.overdueCasesCount}</p>
                <p className="text-sm text-gray-500">Försenade</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogTab({ producerId }: { producerId: string }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-medium text-gray-900">Produktkatalog</h3>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
          <Plus className="h-4 w-4" />
          Lägg till produkt
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Produktkatalogen laddas här. Implementeras i nästa iteration.
      </p>
    </div>
  );
}

function PricingTab({ producerId }: { producerId: string }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-medium text-gray-900">Prislistor</h3>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
          <Plus className="h-4 w-4" />
          Skapa prislista
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Prislistor laddas här. Implementeras i nästa iteration.
      </p>
    </div>
  );
}

function TradeTermsTab({ producerId }: { producerId: string }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="font-medium text-gray-900 mb-6">Handelsvillkor</h3>
      <p className="text-sm text-gray-500">
        Handelsvillkor per marknad laddas här. Implementeras i nästa iteration.
      </p>
    </div>
  );
}

function CommunicationTab({ producerId, producerName }: { producerId: string; producerName: string }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-medium text-gray-900">Ärenden</h3>
        <Link
          href={`/ior/cases/new?producerId=${producerId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-wine text-white text-sm font-medium hover:bg-wine/90"
        >
          <Plus className="h-4 w-4" />
          Nytt ärende
        </Link>
      </div>
      <p className="text-sm text-gray-500">
        Ärendehistorik för {producerName} laddas här.
      </p>
      <Link
        href={`/ior/cases?producer=${producerId}`}
        className="inline-flex items-center gap-2 mt-4 text-sm text-wine hover:text-wine/80"
      >
        Visa alla ärenden för denna producent
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
