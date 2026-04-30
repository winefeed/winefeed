import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Brasri samples (most relevant — Bordeaux IOR-style)
  const { data: brasriWines } = await sb
    .from('supplier_wines')
    .select('sku, name, producer, vintage, country, region, appellation, color, grape, bottle_size_ml, price_ex_vat_sek, case_size, moq, stock_qty, is_active, location')
    .eq('supplier_id', 'a1111111-1111-1111-1111-111111111111')
    .order('producer')
    .limit(15);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('BRASRI — sample 15 viner (av 497)');
  console.log('═══════════════════════════════════════════════════════════');
  for (const w of brasriWines || []) {
    console.log(`SKU: ${w.sku}`);
    console.log(`  name:        ${w.name}`);
    console.log(`  producer:    ${w.producer}`);
    console.log(`  vintage:     ${w.vintage}`);
    console.log(`  country/region/appellation: ${w.country} / ${w.region} / ${w.appellation || '(null)'}`);
    console.log(`  color/grape: ${w.color} / ${w.grape || '(null)'}`);
    console.log(`  bottle/case/moq: ${w.bottle_size_ml}ml / case=${w.case_size} / moq=${w.moq}`);
    console.log(`  price_öre:   ${w.price_ex_vat_sek}  (= ${w.price_ex_vat_sek/100} kr ex moms)`);
    console.log(`  stock_qty:   ${w.stock_qty}  active=${w.is_active}  location=${w.location || '(null)'}`);
    console.log('');
  }

  // Check magnum-handling: hur många bordeaux har 1500ml?
  const { data: magnums } = await sb
    .from('supplier_wines')
    .select('sku, name, producer, vintage, bottle_size_ml, supplier_id')
    .eq('bottle_size_ml', 1500)
    .limit(10);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('MAGNUM-EXEMPEL (bottle_size_ml = 1500)');
  console.log('═══════════════════════════════════════════════════════════');
  for (const w of magnums || []) {
    console.log(`  ${w.sku.padEnd(20)} ${w.name.padEnd(50)} ${w.vintage}  ${w.producer}`);
  }
  console.log('');

  // Hur formateras namn? Med eller utan årgång?
  const { data: nameFormats } = await sb
    .from('supplier_wines')
    .select('name, vintage, producer')
    .eq('supplier_id', 'a1111111-1111-1111-1111-111111111111')
    .not('vintage', 'is', null)
    .limit(20);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('NAMN-FORMAT (har "name" årgången inkluderad?)');
  console.log('═══════════════════════════════════════════════════════════');
  let nameContainsVintage = 0;
  let nameWithoutVintage = 0;
  for (const w of nameFormats || []) {
    const hasVintage = w.name.includes(String(w.vintage));
    if (hasVintage) nameContainsVintage++; else nameWithoutVintage++;
  }
  console.log(`  Namn med årgång:  ${nameContainsVintage}`);
  console.log(`  Namn utan årgång: ${nameWithoutVintage}`);
  console.log(`  → standard: ${nameContainsVintage > nameWithoutVintage ? 'med årgång' : 'utan årgång'}`);
  console.log('');

  // Stock_qty / location patterns
  const { data: stockStats } = await sb
    .from('supplier_wines')
    .select('stock_qty, location, supplier_id')
    .eq('supplier_id', 'a1111111-1111-1111-1111-111111111111');

  const withStock = stockStats?.filter(s => s.stock_qty != null && s.stock_qty > 0).length || 0;
  const zeroStock = stockStats?.filter(s => s.stock_qty === 0).length || 0;
  const nullStock = stockStats?.filter(s => s.stock_qty == null).length || 0;
  const locations = new Map();
  for (const s of stockStats || []) {
    locations.set(s.location || '(null)', (locations.get(s.location || '(null)') || 0) + 1);
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('LAGER & LOKATION (Brasri)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  stock_qty > 0:   ${withStock}`);
  console.log(`  stock_qty = 0:   ${zeroStock}`);
  console.log(`  stock_qty NULL:  ${nullStock}`);
  console.log(`  Locations:`);
  for (const [loc, n] of locations) console.log(`    ${loc.padEnd(15)} ${n}`);
}

main().catch(err => { console.error(err); process.exit(1); });
