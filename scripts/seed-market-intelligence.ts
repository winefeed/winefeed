/**
 * Seed market intelligence data from Viva Wine Group 2025 annual report.
 *
 * Usage: npx tsx scripts/seed-market-intelligence.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const VIVA_TRENDS = [
  {
    key: 'nolo_beverages',
    signal: 'growth',
    detail: 'NoLo (no/low alcohol) is a growing category. Viva acquired Alpha Brands (Norway) specifically for this segment.',
    implication: 'Inkludera alkoholfria alternativ i rekommendationer om tillgängliga.',
  },
  {
    key: 'sustainability_and_packaging',
    signal: 'growth',
    detail: 'Eko/bio/natural certifierade viner alltmer efterfrågade. Lättviktsglas och BIB viktigare.',
    implication: 'Vikta eko/bio-certifieringar starkare. Visa förpackningsinfo.',
  },
  {
    key: 'consolidation_and_acquisitions',
    signal: 'structural',
    detail: 'Marknaden konsolideras. Viva förvärvade 3 bolag på 12 månader. Mindre importörer söker alternativa kanaler.',
    implication: 'Mindre importörer erbjuder ofta mer personlig service — bra för restauranger.',
  },
  {
    key: 'seasonal_patterns',
    signal: 'operational',
    detail: 'B2B-försäljning peakar Q2+Q4 — rosé sommartid, fylligare viner till jul.',
    implication: 'Säsongsanpassa rekommendationer.',
  },
  {
    key: 'consumer_sentiment',
    signal: 'negative',
    detail: 'Svag konsumentefterfrågan på alla europeiska vinmarknader under 2025.',
    implication: 'Restauranger är mer priskänsliga — prisvärdhet viktigare i matchning.',
  },
  {
    key: 'volume_decline_monopoly',
    signal: 'negative',
    detail: 'Nordiska monopolets försäljningsvolym minskade 3.7% Q4 2025.',
    implication: 'Importörer konkurrerar hårdare om färre platser — alternativa kanaler viktiga.',
  },
  {
    key: 'distribution_channel_expansion',
    signal: 'structural',
    detail: 'Vivas Delta Wines-förvärv öppnar restaurang-grossistkanal — direkt konkurrens.',
    implication: 'Marknadsledaren expanderar in i restaurangsegmentet.',
  },
  {
    key: 'climate_risk_to_production',
    signal: 'risk',
    detail: 'Klimatförändringar påverkar vinkvalitet och tillgänglighet.',
    implication: 'Vintagevariation och leveransstörningar kan påverka priser.',
  },
  {
    key: 'ai_and_automation',
    signal: 'growth',
    detail: 'Marknadsledaren investerar i AI och automation.',
    implication: 'Validerar AI-first approach för vinmatchning.',
  },
  {
    key: 'currency_and_pricing_pressure',
    signal: 'risk',
    detail: 'EUR/SEK-effekter och räntekostnader påverkar importpriser.',
    implication: 'Valutasvängningar påverkar vinpriser — transparens viktigt.',
  },
  {
    key: 'customer_concentration_risk',
    signal: 'structural',
    detail: 'Vivas topp-3 kunder (Systembolaget, Alko, Jumbo) står för >10% var av omsättningen.',
    implication: 'Monopolberoende importörer behöver alternativa restaurangkanaler.',
  },
];

const VIVA_SUBSIDIARIES = [
  { name: 'Tryffelsvinet', country: 'Sweden', description: 'Vinimportör, Årets Importör 2025 (Allt om Vin)' },
  { name: 'Delta Wines', country: 'Netherlands', description: 'Ledande vindistributör i Nederländerna' },
  { name: 'Vinguiden Nordic AB', country: 'Sweden', description: 'En av Sveriges största vinklubbar' },
  { name: 'Norwegian Beverage Group AS', country: 'Norway', description: 'Norsk dotterbolag' },
  { name: 'Alpha Brands AS', country: 'Norway', description: 'NoLo-drycker för norsk dagligvaruhandel' },
  { name: 'Viva Vin & Mat', country: 'Sweden', description: 'Vinklubb' },
];

async function main() {
  console.log('Seeding supplier_market_intelligence...');

  const { data, error } = await supabase
    .from('supplier_market_intelligence')
    .upsert({
      company_name: 'Viva Wine Group',
      report_year: 2025,
      trends: VIVA_TRENDS,
      subsidiaries: VIVA_SUBSIDIARIES,
      source_document: 'Viva Wine Group Year-End Report January-December 2025',
      extracted_at: '2026-02-19T00:00:00Z',
    }, {
      onConflict: 'company_name,report_year',
    })
    .select();

  if (error) {
    console.error('Failed to seed:', error);
    process.exit(1);
  }

  console.log('Seeded successfully:', data);

  // Verify
  const { data: check } = await supabase
    .from('supplier_market_intelligence')
    .select('company_name, report_year, trends, subsidiaries')
    .single();

  if (check) {
    console.log(`\nVerification:`);
    console.log(`  Company: ${check.company_name}`);
    console.log(`  Year: ${check.report_year}`);
    console.log(`  Trends: ${(check.trends as any[]).length} entries`);
    console.log(`  Subsidiaries: ${(check.subsidiaries as any[]).length} entries`);

    const growthTrends = (check.trends as any[]).filter((t: any) => t.signal === 'growth');
    console.log(`  Growth trends: ${growthTrends.map((t: any) => t.key).join(', ')}`);
  }
}

main().catch(console.error);
