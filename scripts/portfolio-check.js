const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const r1 = await sb.from('supplier_wines').select('name, vintage, color, grape, region, country, price_ex_vat_sek, supplier_id');
  const r2 = await sb.from('suppliers').select('id, namn');
  if (r1.error) { console.log('Wines error:', r1.error.message); return; }
  if (r2.error) { console.log('Suppliers error:', r2.error.message); return; }
  const wines = r1.data;
  const suppliers = r2.data;

  const sMap = {};
  suppliers.forEach(s => { sMap[s.id] = s.namn; });

  const bySupplier = {};
  wines.forEach(w => {
    const s = sMap[w.supplier_id] || 'Okand';
    if (!bySupplier[s]) bySupplier[s] = [];
    bySupplier[s].push(w);
  });

  console.log('Totalt: ' + wines.length + ' viner\n');

  Object.keys(bySupplier).forEach(name => {
    const wl = bySupplier[name];
    const rs = {}, cs = {}, gs = {};
    wl.forEach(w => {
      if (w.region) rs[w.region] = 1;
      if (w.country) cs[w.country] = 1;
      if (w.grape) gs[w.grape] = 1;
    });
    const prices = wl.filter(w => w.price_ex_vat_sek).map(w => w.price_ex_vat_sek / 100);
    const avg = prices.length ? Math.round(prices.reduce((a,b) => a+b, 0) / prices.length) : 0;
    const mn = prices.length ? Math.round(Math.min(...prices)) : 0;
    const mx = prices.length ? Math.round(Math.max(...prices)) : 0;
    console.log(name + ' (' + wl.length + ' viner, ' + mn + '-' + mx + ' kr, snitt ' + avg + ' kr)');
    console.log('  Lander: ' + (Object.keys(cs).join(', ') || '-'));
    console.log('  Regioner: ' + (Object.keys(rs).join(', ') || '-'));
    console.log('  Druvor: ' + (Object.keys(gs).join(', ') || '-'));
    console.log('');
  });
}
run();
