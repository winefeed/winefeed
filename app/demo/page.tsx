import { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import DemoSearch from '@/components/demo/DemoSearch';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Demo — Sök bland viner | Winefeed',
  description:
    'Testa hur restauranger hittar viner på Winefeed. Sök bland riktiga viner från svenska importörer — utan att skapa konto.',
  openGraph: {
    title: 'Demo — Sök bland viner | Winefeed',
    description:
      'Testa hur restauranger hittar viner på Winefeed. Sök bland riktiga viner från svenska importörer.',
    type: 'website',
  },
};

export type DemoWine = {
  id: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  vintage: number | null;
  grape: string | null;
  color: string | null;
  description: string | null;
  appellation: string | null;
  alcohol_pct: number | null;
  bottle_size_ml: number | null;
  organic: boolean | null;
  biodynamic: boolean | null;
  supplier_name: string | null;
};

async function getWines(): Promise<DemoWine[]> {
  try {
    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient
      .from('supplier_wines')
      .select(
        'id, name, producer, country, region, vintage, grape, color, description, appellation, alcohol_pct, bottle_size_ml, organic, biodynamic, supplier:suppliers(namn)'
      )
      .eq('is_active', true)
      .not('color', 'is', null)
      .neq('color', 'spirit')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('Demo wine fetch error:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map((w) => {
      const sup = Array.isArray(w.supplier) ? w.supplier[0] : w.supplier;
      return {
        id: w.id,
        name: w.name,
        producer: w.producer,
        country: w.country,
        region: w.region,
        vintage: w.vintage,
        grape: w.grape,
        color: w.color,
        description: w.description,
        appellation: w.appellation,
        alcohol_pct: w.alcohol_pct,
        bottle_size_ml: w.bottle_size_ml,
        organic: w.organic,
        biodynamic: w.biodynamic,
        supplier_name: (sup as { namn?: string })?.namn ?? null,
      };
    });
  } catch (err) {
    console.error('Demo page error:', err);
    return [];
  }
}

export default async function DemoPage() {
  const wines = await getWines();

  return <DemoSearch wines={wines} />;
}
