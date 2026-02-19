/**
 * PUBLIC CATALOG PAGE - Server Component
 *
 * Fetches catalog data directly from DB server-side.
 * No authentication required — token-based access.
 * NEVER exposes prices, MOQ, stock, notes, or SKU.
 */

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import CatalogView from '@/components/catalog/CatalogView';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ token: string }>;
};

async function getCatalog(token: string) {
  if (!UUID_REGEX.test(token)) return null;

  const adminClient = getSupabaseAdmin();

  // Look up supplier by catalog token + must be shared
  const { data: supplier, error: supplierError } = await adminClient
    .from('suppliers')
    .select('id, namn, type')
    .eq('catalog_token', token)
    .eq('catalog_shared', true)
    .single();

  if (supplierError || !supplier) return null;

  // Fetch ACTIVE wines — explicit select, NEVER prices/MOQ/stock/notes/SKU
  const { data: wines } = await adminClient
    .from('supplier_wines')
    .select('id, name, producer, vintage, region, country, grape, color, description, appellation, alcohol_pct, bottle_size_ml, organic, biodynamic, case_size')
    .eq('supplier_id', supplier.id)
    .eq('status', 'ACTIVE')
    .order('producer', { ascending: true })
    .order('name', { ascending: true });

  return {
    supplier: { name: supplier.namn, type: supplier.type },
    wines: wines || [],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const data = await getCatalog(token);
  if (!data) return { title: 'Katalog' };

  return {
    title: `${data.supplier.name} — Vinkatalog`,
    description: `Utforska ${data.wines.length} viner från ${data.supplier.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function CatalogPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getCatalog(token);

  if (!data) {
    notFound();
  }

  return (
    <CatalogView
      supplierName={data.supplier.name}
      supplierType={data.supplier.type}
      wines={data.wines}
    />
  );
}
