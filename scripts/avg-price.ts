import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: wines } = await sb
    .from('supplier_wines')
    .select('price_ex_vat_sek, color, country, supplier_id')
    .eq('is_active', true)
    .not('price_ex_vat_sek', 'is', null);
  if (!wines) return;

  const prices = wines.map(w => w.price_ex_vat_sek / 100).filter(p => p > 0).sort((a, b) => a - b);
  const sum = prices.reduce((s, p) => s + p, 0);
  const avg = sum / prices.length;
  const median = prices[Math.floor(prices.length / 2)];
  const p25 = prices[Math.floor(prices.length * 0.25)];
  const p75 = prices[Math.floor(prices.length * 0.75)];

  console.log(`Aktiva viner med pris: ${prices.length}`);
  console.log(`Snittpris ex moms:     ${avg.toFixed(0)} kr`);
  console.log(`Medianpris ex moms:    ${median.toFixed(0)} kr`);
  console.log(`25-percentil:          ${p25.toFixed(0)} kr`);
  console.log(`75-percentil:          ${p75.toFixed(0)} kr`);
  console.log(`Min / Max:             ${prices[0].toFixed(0)} / ${prices[prices.length - 1].toFixed(0)} kr`);

  const byColor: Record<string, number[]> = {};
  for (const w of wines) {
    if (!w.color || !w.price_ex_vat_sek) continue;
    byColor[w.color] = byColor[w.color] || [];
    byColor[w.color].push(w.price_ex_vat_sek / 100);
  }
  console.log('\nPer färg:');
  for (const [c, ps] of Object.entries(byColor).sort((a, b) => b[1].length - a[1].length)) {
    const a = ps.reduce((s, p) => s + p, 0) / ps.length;
    const sorted = [...ps].sort((x, y) => x - y);
    const m = sorted[Math.floor(sorted.length / 2)];
    console.log(`  ${c.padEnd(10)} n=${ps.length.toString().padStart(3)}  snitt ${a.toFixed(0)} kr  median ${m.toFixed(0)} kr`);
  }

  const bySupplier: Record<string, number[]> = {};
  for (const w of wines) {
    if (!w.supplier_id || !w.price_ex_vat_sek) continue;
    bySupplier[w.supplier_id] = bySupplier[w.supplier_id] || [];
    bySupplier[w.supplier_id].push(w.price_ex_vat_sek / 100);
  }
  const { data: suppliers } = await sb.from('suppliers').select('id, namn');
  const nameById = new Map((suppliers || []).map(s => [s.id, s.namn]));
  console.log('\nPer leverantör:');
  for (const [sid, ps] of Object.entries(bySupplier).sort((a, b) => b[1].length - a[1].length)) {
    const a = ps.reduce((s, p) => s + p, 0) / ps.length;
    const sorted = [...ps].sort((x, y) => x - y);
    const m = sorted[Math.floor(sorted.length / 2)];
    console.log(`  ${(nameById.get(sid) || sid).padEnd(28)} n=${ps.length.toString().padStart(3)}  snitt ${a.toFixed(0)} kr  median ${m.toFixed(0)} kr`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
