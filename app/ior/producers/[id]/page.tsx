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
  Pencil,
  MessageSquarePlus,
  Trash2,
  Loader2,
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
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-wine transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till producenter
        </Link>
      </div>

      {/* Producer header */}
      <div className="px-4 lg:px-6 mb-6">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-5">
            {/* Logo */}
            <div className="h-18 w-18 bg-gradient-to-br from-wine/10 to-wine/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-wine/20 shadow-inner">
              {producer.logoUrl ? (
                <img
                  src={producer.logoUrl}
                  alt={producer.name}
                  className="h-14 w-14 object-contain"
                />
              ) : (
                <Building2 className="h-9 w-9 text-wine/60" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">
                  {producer.name}
                </h1>
                {!producer.isActive && (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-600 border border-gray-300">
                    Inaktiv
                  </span>
                )}
                {stats && stats.overdueCasesCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">
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
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/ior/feedback/new?from=/ior/producers/${producerId}&producerId=${producerId}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg',
                    'text-gray-500 text-sm',
                    'hover:text-wine hover:bg-wine/5 transition-colors'
                  )}
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Feedback
                </Link>
                <Link
                  href={`/ior/producers/${producerId}/edit`}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg',
                    'border-2 border-gray-300 text-gray-700 font-medium text-sm',
                    'hover:bg-gray-50 hover:border-gray-400 transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
                  )}
                >
                  <Pencil className="h-4 w-4" />
                  Redigera
                </Link>
                <Link
                  href={`/ior/cases/new?producerId=${producerId}`}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg',
                    'bg-wine text-white font-medium text-sm',
                    'hover:bg-wine/90 transition-all shadow-sm hover:shadow',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Nytt meddelande
                </Link>
              </div>

              {/* Stats badges */}
              {stats && (
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-wine/10 rounded-full text-wine font-semibold border border-wine/20">
                    <Wine className="h-3.5 w-3.5" />
                    {stats.productCount} produkter
                  </span>
                  {stats.openCasesCount > 0 && (
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold border',
                      stats.overdueCasesCount > 0
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    )}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      {stats.openCasesCount} öppna
                      {stats.overdueCasesCount > 0 && (
                        <span className="font-bold">
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
        <div className="border-b-2 border-gray-200">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all rounded-t-lg',
                    isActive
                      ? 'border-wine text-wine bg-wine/5'
                      : 'border-transparent text-gray-500 hover:text-wine hover:bg-wine/5 hover:border-wine/30'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive && 'text-wine')} />
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
          <OverviewTab producer={producer} stats={stats} onDeleted={() => router.push('/ior/producers')} />
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

function OverviewTab({ producer, stats, onDeleted }: { producer: Producer; stats: ProducerStats | null; onDeleted: () => void }) {
  const [showDeleteProducer, setShowDeleteProducer] = useState(false);
  const [deletingProducer, setDeletingProducer] = useState(false);

  const handleDeleteProducer = async () => {
    setDeletingProducer(true);
    try {
      const response = await fetch(`/api/ior/producers/${producer.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onDeleted();
      } else {
        const data = await response.json();
        alert(data.error || 'Kunde inte ta bort producenten');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Ett fel uppstod');
    } finally {
      setDeletingProducer(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contact info */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-wine" />
          Kontaktuppgifter
        </h3>
        <dl className="space-y-3 text-sm">
          {producer.contactName && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wide">Kontaktperson</dt>
              <dd className="text-gray-900 mt-0.5 font-medium">{producer.contactName}</dd>
            </div>
          )}
          {producer.contactEmail && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wide">E-post</dt>
              <dd className="text-gray-900 mt-0.5">
                <a href={`mailto:${producer.contactEmail}`} className="text-wine hover:text-wine/80 font-medium">
                  {producer.contactEmail}
                </a>
              </dd>
            </div>
          )}
          {producer.contactPhone && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wide">Telefon</dt>
              <dd className="text-gray-900 mt-0.5 font-medium">{producer.contactPhone}</dd>
            </div>
          )}
          {producer.legalName && (
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wide">Juridiskt namn</dt>
              <dd className="text-gray-900 mt-0.5">{producer.legalName}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Notes */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-wine" />
          Anteckningar
        </h3>
        {producer.notes ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{producer.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">Inga anteckningar</p>
        )}
      </div>

      {/* Quick stats cards */}
      {stats && (
        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-wine/5 to-wine/10 border-2 border-wine/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-wine/20 rounded-lg">
                <Wine className="h-5 w-5 text-wine" />
              </div>
              <div>
                <p className="text-2xl font-bold text-wine">{stats.productCount}</p>
                <p className="text-sm text-wine/70 font-medium">Produkter</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-2 border-emerald-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-200 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{stats.activePriceLists}</p>
                <p className="text-sm text-emerald-600 font-medium">Aktiva prislistor</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-200 rounded-lg">
                <MessageSquare className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.openCasesCount}</p>
                <p className="text-sm text-amber-600 font-medium">Öppna ärenden</p>
              </div>
            </div>
          </div>
          <div className={cn(
            'rounded-xl p-4 shadow-sm border-2',
            stats.overdueCasesCount > 0
              ? 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-300'
              : 'bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2.5 rounded-lg',
                stats.overdueCasesCount > 0 ? 'bg-red-200' : 'bg-gray-200'
              )}>
                <AlertTriangle className={cn(
                  'h-5 w-5',
                  stats.overdueCasesCount > 0 ? 'text-red-700' : 'text-gray-500'
                )} />
              </div>
              <div>
                <p className={cn(
                  'text-2xl font-bold',
                  stats.overdueCasesCount > 0 ? 'text-red-700' : 'text-gray-500'
                )}>{stats.overdueCasesCount}</p>
                <p className={cn(
                  'text-sm font-medium',
                  stats.overdueCasesCount > 0 ? 'text-red-600' : 'text-gray-500'
                )}>Försenade</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="md:col-span-2 mt-8 border-2 border-red-200 rounded-xl overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b-2 border-red-200">
          <h3 className="font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Farozon
          </h3>
        </div>
        <div className="p-6 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Ta bort producent</p>
              <p className="text-sm text-gray-500 mt-1">
                Tar bort {producer.name} och alla {stats?.productCount || 0} produkter permanent.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteProducer(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-300 text-red-600 font-medium hover:bg-red-50 hover:border-red-400 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Ta bort producent
            </button>
          </div>
        </div>
      </div>

      {/* Delete producer confirmation modal */}
      {showDeleteProducer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Ta bort producent?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Detta kommer ta bort <strong>{producer.name}</strong> och alla{' '}
              <strong>{stats?.productCount || 0} produkter</strong> permanent. Åtgärden kan inte ångras.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteProducer(false)}
                disabled={deletingProducer}
                className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
              >
                Avbryt
              </button>
              <button
                onClick={handleDeleteProducer}
                disabled={deletingProducer}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {deletingProducer ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Tar bort...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Ja, ta bort
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Product {
  id: string;
  name: string;
  vintage?: number;
  wineType?: string;
  bottleSizeMl: number;
  appellation?: string;
  grapeVarieties?: string[];
  alcoholPct?: number;
  isActive: boolean;
}

const wineTypeLabels: Record<string, string> = {
  RED: 'Rött',
  WHITE: 'Vitt',
  ROSE: 'Rosé',
  ORANGE: 'Orange',
  SPARKLING: 'Mousserande',
  DESSERT: 'Dessertvin',
  FORTIFIED: 'Starkvin',
  OTHER: 'Övrigt',
};

function CatalogTab({ producerId }: { producerId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch(`/api/ior/producers/${producerId}/products?pageSize=100`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.items || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [producerId]);

  const handleDeleteCatalog = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/ior/producers/${producerId}?productsOnly=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setProducts([]);
        setTotal(0);
        setShowDeleteConfirm(false);
      } else {
        const data = await response.json();
        alert(data.error || 'Kunde inte rensa katalogen');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Ett fel uppstod');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b-2 border-gray-100 bg-gradient-to-r from-wine/5 to-transparent">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wine className="h-4 w-4 text-wine" />
            Produktkatalog
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{total} produkter totalt</p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Rensa katalog
            </button>
          )}
          <Link
            href={`/ior/producers/${producerId}/products/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-wine text-white text-sm font-medium hover:bg-wine/90 shadow-sm transition-all hover:shadow"
          >
            <Plus className="h-4 w-4" />
            Lägg till produkt
          </Link>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Rensa katalog?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Detta kommer ta bort alla <strong>{total} produkter</strong> permanent.
              Producenten behålls men katalogen töms helt. Åtgärden kan inte ångras.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
              >
                Avbryt
              </button>
              <button
                onClick={handleDeleteCatalog}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rensar...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Ja, rensa katalog
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center bg-gradient-to-b from-gray-50/50">
          <div className="p-4 bg-wine/10 rounded-full w-fit mx-auto mb-4">
            <Wine className="h-10 w-10 text-wine/50" />
          </div>
          <p className="text-gray-600 font-medium mb-2">Inga produkter ännu</p>
          <p className="text-gray-500 text-sm mb-6">Börja med att lägga till din första produkt</p>
          <Link
            href={`/ior/producers/${producerId}/products/new`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-wine text-white rounded-lg font-medium hover:bg-wine/90 shadow-sm transition-all hover:shadow"
          >
            <Plus className="h-4 w-4" />
            Lägg till produkt
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {products.map((product) => (
            <div
              key={product.id}
              className={cn(
                'flex items-center gap-4 p-4 hover:bg-wine/5 transition-colors cursor-pointer',
                !product.isActive && 'opacity-60'
              )}
            >
              <div className="p-2.5 bg-gradient-to-br from-wine/10 to-wine/20 rounded-lg border border-wine/10">
                <Wine className="h-5 w-5 text-wine" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">
                    {product.name}
                  </span>
                  {product.vintage && product.vintage > 0 && (
                    <span className="text-wine font-medium">{product.vintage}</span>
                  )}
                  {!product.isActive && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600 border border-gray-300">
                      Inaktiv
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {product.wineType && (
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                      {wineTypeLabels[product.wineType] || product.wineType}
                    </span>
                  )}
                  <span>{product.bottleSizeMl} ml</span>
                  {product.appellation && (
                    <span className="truncate text-gray-400">{product.appellation}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PricingTab({ producerId }: { producerId: string }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50/50 to-transparent">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          Prislistor
        </h3>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-gray-300 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all">
          <Plus className="h-4 w-4" />
          Skapa prislista
        </button>
      </div>
      <div className="p-8 text-center bg-gradient-to-b from-gray-50/50">
        <div className="p-4 bg-emerald-100 rounded-full w-fit mx-auto mb-4">
          <DollarSign className="h-10 w-10 text-emerald-500" />
        </div>
        <p className="text-gray-600 font-medium mb-2">Prislistor kommer snart</p>
        <p className="text-gray-500 text-sm">Implementeras i nästa iteration</p>
      </div>
    </div>
  );
}

function TradeTermsTab({ producerId }: { producerId: string }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-blue-50/50 to-transparent">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Handshake className="h-4 w-4 text-blue-600" />
          Handelsvillkor
        </h3>
      </div>
      <div className="p-8 text-center bg-gradient-to-b from-gray-50/50">
        <div className="p-4 bg-blue-100 rounded-full w-fit mx-auto mb-4">
          <Handshake className="h-10 w-10 text-blue-500" />
        </div>
        <p className="text-gray-600 font-medium mb-2">Handelsvillkor kommer snart</p>
        <p className="text-gray-500 text-sm">Implementeras i nästa iteration</p>
      </div>
    </div>
  );
}

function CommunicationTab({ producerId, producerName }: { producerId: string; producerName: string }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b-2 border-gray-100 bg-gradient-to-r from-amber-50/50 to-transparent">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-600" />
          Ärenden
        </h3>
        <Link
          href={`/ior/cases/new?producerId=${producerId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-wine text-white text-sm font-medium hover:bg-wine/90 shadow-sm transition-all hover:shadow"
        >
          <Plus className="h-4 w-4" />
          Nytt ärende
        </Link>
      </div>
      <div className="p-8 text-center bg-gradient-to-b from-gray-50/50">
        <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4">
          <MessageSquare className="h-10 w-10 text-amber-500" />
        </div>
        <p className="text-gray-600 font-medium mb-2">Ärendehistorik för {producerName}</p>
        <p className="text-gray-500 text-sm mb-6">Visa och hantera kommunikation</p>
        <Link
          href={`/ior/cases?producer=${producerId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-wine text-wine rounded-lg font-medium hover:bg-wine/5 transition-all"
        >
          Visa alla ärenden
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
