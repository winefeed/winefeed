import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '/Users/markusnilsson/Downloads/Winefeed claude/.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: wines } = await sb.from('supplier_wines').select('name, vintage, wine_type, grape_variety, region, country, price_ex_vat_sek, supplier_id');
const { data: suppliers } = await sb.from('suppliers').select('id, namn');
const sMap = new Map(suppliers.map(s => [s.id, s.namn]));

console.log('Totalt: ' + wines.length + ' viner\n');

const bySupplier = {};
wines.forEach(w => {
  const s = sMap.get(w.supplier_id) || 'Okand';
  if (!bySupplier[s]) bySupplier[s] = [];
  bySupplier[s].push(w);
});

for (const [name, wl] of Object.entries(bySupplier)) {
  const regions = [...new Set(wl.map(w => w.region).filter(Boolean))];
  const countries = [...new Set(wl.map(w => w.country).filter(Boolean))];
  const grapes = [...new Set(wl.map(w => w.grape_variety).filter(Boolean))];
  const prices = wl.filter(w => w.price_ex_vat_sek).map(w => w.price_ex_vat_sek / 100);
  const avg = prices.length ? Math.round(prices.reduce((a,b) => a+b, 0) / prices.length) : 0;
  const mn = prices.length ? Math.round(Math.min(...prices)) : 0;
  const mx = prices.length ? Math.round(Math.max(...prices)) : 0;
  console.log(`${name} (${wl.length} viner, ${mn}–${mx} kr, snitt ${avg} kr)`);
  console.log(`  Länder: ${countries.join(', ') || '-'}`);
  console.log(`  Regioner: ${regions.join(', ') || '-'}`);
  console.log(`  Druvor: ${grapes.join(', ') || '-'}`);
  console.log('');
}
