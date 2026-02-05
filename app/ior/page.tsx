/**
 * IOR DASHBOARD
 *
 * Netflix-style dashboard with:
 * - Row 1: "Kräver åtgärd" carousel (overdue/high-priority cases)
 * - Row 2: "Mina producenter" carousel (ProducerCards)
 * - Row 3: "Katalog & priser" summary cards
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wine, FileText, Building2, DollarSign, Plus, CheckCircle } from 'lucide-react';
import { HorizontalCarousel, CarouselItem } from '@/components/ior/HorizontalCarousel';
import { ProducerCard } from '@/components/ior/ProducerCard';
import { ActionRequiredCard } from '@/components/ior/ActionRequiredCard';
import { SummaryCard, SummaryCardGrid } from '@/components/ior/SummaryCard';

interface DashboardData {
  actionRequiredCases: Array<{
    id: string;
    subject: string;
    producerId: string;
    producerName: string;
    producerCountry?: string;
    status: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    dueAt?: string;
    isOverdue: boolean;
    category?: string;
  }>;
  producers: Array<{
    id: string;
    name: string;
    country: string;
    region?: string;
    logoUrl?: string;
    productCount: number;
    openCasesCount: number;
    overdueCasesCount: number;
    isActive: boolean;
    lastActivityAt?: string;
  }>;
  stats: {
    totalProducers: number;
    activeProducers: number;
    totalProducts: number;
    activeProducts: number;
    activePriceLists: number;
    pendingPriceLists: number;
    openCases: number;
    overdueCases: number;
  };
}

export default function IORDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch('/api/ior/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Kunde inte ladda dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="py-8">
        <div className="animate-pulse space-y-8">
          <div className="px-4 lg:px-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-72 h-40 bg-gray-200 rounded-lg flex-shrink-0" />
              ))}
            </div>
          </div>
          <div className="px-4 lg:px-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-72 h-48 bg-gray-200 rounded-lg flex-shrink-0" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 px-4 lg:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="py-4 space-y-2">
      {/* Row 1: Kräver åtgärd */}
      <HorizontalCarousel
        title="Kräver åtgärd"
        subtitle={data.actionRequiredCases.length > 0
          ? `${data.actionRequiredCases.length} ärenden`
          : undefined}
        isEmpty={data.actionRequiredCases.length === 0}
        emptyState={
          <div className="flex items-center gap-4 p-6 bg-green-50 rounded-lg border border-green-200">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">Inget akut just nu</p>
              <p className="text-sm text-green-700 mt-0.5">
                Alla ärenden är under kontroll
              </p>
            </div>
          </div>
        }
        action={
          <Link
            href="/ior/cases?status=action_required"
            className="text-sm text-wine hover:text-wine/80 font-medium"
          >
            Visa alla
          </Link>
        }
      >
        {data.actionRequiredCases.map((caseItem) => (
          <CarouselItem key={caseItem.id}>
            <ActionRequiredCard
              id={caseItem.id}
              subject={caseItem.subject}
              producerId={caseItem.producerId}
              producerName={caseItem.producerName}
              producerCountry={caseItem.producerCountry}
              status={caseItem.status}
              priority={caseItem.priority}
              dueAt={caseItem.dueAt}
              isOverdue={caseItem.isOverdue}
              category={caseItem.category}
            />
          </CarouselItem>
        ))}
      </HorizontalCarousel>

      {/* Row 2: Mina producenter */}
      <HorizontalCarousel
        title="Mina producenter"
        subtitle={`${data.stats.activeProducers} aktiva av ${data.stats.totalProducers}`}
        isEmpty={data.producers.length === 0}
        emptyMessage="Inga producenter ännu. Lägg till din första producent för att komma igång."
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/ior/producers/new"
              className="flex items-center gap-1 text-sm text-wine hover:text-wine/80 font-medium"
            >
              <Plus className="h-4 w-4" />
              Lägg till
            </Link>
            <Link
              href="/ior/producers"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Visa alla
            </Link>
          </div>
        }
      >
        {data.producers.map((producer) => (
          <CarouselItem key={producer.id}>
            <ProducerCard
              id={producer.id}
              name={producer.name}
              country={producer.country}
              region={producer.region}
              logoUrl={producer.logoUrl}
              productCount={producer.productCount}
              openCasesCount={producer.openCasesCount}
              overdueCasesCount={producer.overdueCasesCount}
              isActive={producer.isActive}
              lastActivityAt={producer.lastActivityAt}
            />
          </CarouselItem>
        ))}
      </HorizontalCarousel>

      {/* Row 3: Katalog & priser */}
      <section className="py-4">
        <div className="px-4 lg:px-6 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Katalog & priser</h2>
        </div>
        <SummaryCardGrid>
          <SummaryCard
            title="Produkter i katalog"
            value={data.stats.totalProducts}
            subtitle={`${data.stats.activeProducts} aktiva`}
            icon={Wine}
            href="/ior/producers"
            variant="wine"
          />
          <SummaryCard
            title="Aktiva prislistor"
            value={data.stats.activePriceLists}
            icon={DollarSign}
            href="/ior/producers"
            variant="success"
            badge={data.stats.pendingPriceLists > 0 ? {
              value: data.stats.pendingPriceLists,
              label: 'utkast',
              variant: 'warning',
            } : undefined}
          />
          <SummaryCard
            title="Öppna ärenden"
            value={data.stats.openCases}
            icon={FileText}
            href="/ior/cases"
            variant="default"
            badge={data.stats.overdueCases > 0 ? {
              value: data.stats.overdueCases,
              label: 'försenade',
              variant: 'danger',
            } : undefined}
          />
          <SummaryCard
            title="Producenter"
            value={data.stats.totalProducers}
            subtitle={`${data.stats.activeProducers} aktiva`}
            icon={Building2}
            href="/ior/producers"
            variant="default"
          />
        </SummaryCardGrid>
      </section>
    </div>
  );
}
